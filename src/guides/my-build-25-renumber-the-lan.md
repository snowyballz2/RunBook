---
title: Renumber the LAN
subtitle: Move the whole house from 192.168.1.x to 192.168.213.x in one evening — every device keeps its last number
collection: My Build
order: 25
accent: rose
---

The Start Here page names the cost of the range this build began on: `192.168.1.x` is the most common home network on earth, and away from home any Wi-Fi using it beats the Tailscale subnet route, so the house is unreachable while cellular works. The complete fix is a range nobody else uses. This page moves everything to **`192.168.213.0/24`** — unpredictable enough that no router defaults to it, still in the `192.168` family — and it does so by changing only the *third* number: `192.168.1.50` becomes `192.168.213.50`, `.53` stays `.53`, the cameras keep `.70`–`.76`. That is what makes the move a substitution rather than a redesign.

> [!WARNING]
> Run this once, at home, with the Mac on the LAN, and only after the Proxmox Backups page has produced an archive you have seen and every guest has a fresh snapshot. Nothing here is one-way — the router change is two fields, the guests roll back from snapshots — but the middle of the evening has every static device unreachable until it is moved, so this is not a page to start at 11 p.m. or from a hotspot.

## Prepare

### The new numbers
Only the prefix changes. Every value below follows from the addressing plan on the Start Here page:

| Old | New | What |
|---|---|---|
| `192.168.1.1` | `192.168.213.1` | Fios router (CR1000A), gateway and DHCP |
| `.101`–`.254` | `192.168.213.101`–`.254` | DHCP pool — the static zone `.2`–`.99` stays reserved |
| `192.168.1.50` | `192.168.213.50` | Proxmox host |
| `.20` | `192.168.213.20` | TrueNAS |
| `.51` | `192.168.213.51` | Home Assistant |
| `.52` `.53` `.54` `.55` `.56` `.57` `.58` | same last numbers | Frigate, AdGuard, NPM, Homepage, Vaultwarden, Kuma, Nextcloud |
| `.59` `.60` | same | Ollama and faster-whisper, if the Voice page is built |
| `.61` | `192.168.213.61` | Caséta Pro bridge |
| `.70`–`.76` | same | the seven cameras |
| `.98` | `192.168.213.98` | the cameras' dead-end gateway — still not a device |

### Snapshots and a way back
1. In Proxmox, for every guest: select it → **Snapshots** → **Take Snapshot**, name `pre-renumber`.
2. In the router, note the current LAN address and DHCP range — the rollback is retyping those two fields.
3. Keep this page open on the phone as well as the Mac: the Mac loses the web UI for a minute at every address change.

### Give the Mac a foot in both ranges
Once the router moves, the Mac's own address moves with it, and every device still sitting on an old static address becomes unreachable — unless the Mac also holds an old-range address. Find the interface name first:

```bash
networksetup -listallhardwareports
```

Then add a second address on it (`en0` below is the usual Wi-Fi interface; use the one the listing shows for the connection you are on):

```bash
sudo ifconfig en0 alias 192.168.1.200 255.255.255.0
```

> [!NOTE]
> The alias lasts until the Mac sleeps or reconnects — re-run the command if an old-range device stops answering mid-evening. Remove it at the end with `sudo ifconfig en0 -alias 192.168.1.200`.

## Move the network

### The router
The CR1000A shares its interface with the G3100 family. On the router at `http://192.168.1.1`:

1. Go to **My Network → Network Connections → Network (Home/Office) → Settings**.
2. Set **IP Address** → `192.168.213.1`, **Subnet Mask** → `255.255.255.0`.
3. On the same page (or under **Advanced → Network Settings → IPv4 Address Distribution** if your firmware keeps the pool there), set the DHCP range → `192.168.213.101` to `192.168.213.254`.
4. **Apply**. The router re-applies or reboots; every DHCP device follows on its next lease.
5. Toggle the Mac's Wi-Fi off and on; confirm it now holds a `192.168.213.x` address and the router answers at `http://192.168.213.1`.
6. Re-add the old-range alias from the step above if the toggle dropped it.
7. Point the router's DNS at AdGuard's new address, `192.168.213.53`, on the same router page the AdGuard page used — the entry will still read `.53` on the old prefix until you change it.

> [!NOTE]
> The router's own address may not sit inside the DHCP pool, which is why the pool and the address change together. If the page refuses one order, do the pool first, then the address.

### The Proxmox host
From the Mac, the host still answers at `https://192.168.1.50:8006` through the alias. In the node **Shell**, open the network file:

```bash
nano /etc/network/interfaces
```

Change the two lines under `vmbr0` — the address and the gateway:

```ini
        address 192.168.213.50/24
        gateway 192.168.213.1
```

Save and exit, then the hosts file:

```bash
nano /etc/hosts
```

Change the `192.168.1.50` entry for `pve` to `192.168.213.50`, save and exit, and apply:

```bash
ifreload -a
```

The web UI drops. Reconnect at `https://192.168.213.50:8006`.

### The host's other addresses
Still on the host, four things carry the old numbers:

1. NUT's listener — open the file, change the `LISTEN 192.168.1.50 3493` line to `LISTEN 192.168.213.50 3493`, save and exit:

```bash
nano /etc/nut/upsd.conf
```

2. Restart it:

```bash
systemctl restart nut-server nut-monitor
```

3. The two firewall rules on **Node `pve` → Firewall**: the NUT rule's **Source** → `192.168.213.51`; the Frigate port-5000 fence's sources → the new Home Assistant and Kuma addresses. Edit each, change the field, save.
4. The Tailscale subnet route:

```bash
tailscale set --advertise-routes=192.168.213.0/24
```

5. On the [Machines page](https://login.tailscale.com/admin/machines), select **pve** → **Subnets** → **Edit**: tick `192.168.213.0/24`, untick the old route, **Save**.
6. On the [DNS page](https://login.tailscale.com/admin/dns), under **Global nameservers**, replace `192.168.1.53` with `192.168.213.53`.
7. **Datacenter → Storage → nas-backups → Edit**: **Server** → `192.168.213.20`. (It errors until TrueNAS moves, a few steps down — save it anyway.)

### The containers — AdGuard first
Each LXC changes in the Proxmox UI: select the container → **Network** → double-click **net0** → **IPv4/CIDR** and **Gateway** → **OK** → then **Reboot** the container. In this order, because the rest resolve names through the first:

1. **103 AdGuard** → `192.168.213.53/24`, gateway `192.168.213.1`.
2. **104 Nginx Proxy Manager** → `192.168.213.54/24`.
3. **102 Frigate** → `192.168.213.52/24`.
4. **105 NextcloudPi** → `192.168.213.58/24`.
5. **106 Vaultwarden** → `192.168.213.56/24`.
6. **107 Homepage** → `192.168.213.55/24`.
7. **108 Uptime Kuma** → `192.168.213.57/24`.
8. The Voice page's Ollama and faster-whisper containers, if they exist → `.59` and `.60`.

### Home Assistant
1. At `http://192.168.1.51:8123` (through the alias), go to **Settings → System → Network**, expand the interface, and set **IP address** → `192.168.213.51/24`, **Gateway** → `192.168.213.1`, **DNS** → `192.168.213.1`. **Save**.
2. Reconnect at `http://192.168.213.51:8123`.
3. **Settings → System → Network → HTTP server → Trusted proxies**: replace `192.168.1.54` with `192.168.213.54`; keep `127.0.0.1`. Save, and confirm within five minutes when asked.
4. **Settings → Devices & services**: open each of **Frigate** (host `192.168.213.52`, port `5000`), **Reolink** (once per camera, `192.168.213.70` and `.71`), and **Network UPS Tools** (host `192.168.213.50`) — use **⋮ → Reconfigure** where the integration offers it; otherwise delete the entry and add it again with the new address.
5. **Settings → System → Backups → the TrueNAS network storage** → **Server** → `192.168.213.20`.
6. On each phone, in the companion app, **Settings → Companion app → (your server)** → **Internal URL** → `http://192.168.213.51:8123`. The external `.ts.net` address is untouched — it never depended on the LAN.

### TrueNAS
Repeat the Virtual Machines page's *Give it its permanent address* steps with the new numbers, through the alias at `http://192.168.1.20`: alias `192.168.213.20/24`, default gateway `192.168.213.1`, and the same DNS nameserver choice as before. The Test Changes countdown works exactly as it did the first time.

### The cameras
Each camera keeps its number and gains the new prefix, through the old-range alias:

1. The five turrets, at `http://192.168.1.72` through `.76`: **Network Settings → TCP/IP** — **IP Address** → `192.168.213.7x`, **Default Gateway** → `192.168.213.98`, **Preferred DNS** → `192.168.213.98`. Save; the camera re-addresses.
2. The Reolink pair, at `http://192.168.1.70` and `.71`: **Device Settings → Network → General** — **IP** → `192.168.213.70` / `.71`, **Gateway** → `192.168.213.98`. Save.
3. Frigate's config, from the node Shell — one substitution across every camera URL and the MQTT host, then a restart:

```bash
pct exec 102 -- sed -i 's/192\.168\.1\./192.168.213./g' /config/config.yml
```

```bash
pct reboot 102
```

### Every service that stores an address
1. **AdGuard** at `http://192.168.213.53`: **Filters → DNS rewrites** → edit the `*.kuzco.org` rewrite → `192.168.213.54`.
2. **Nginx Proxy Manager** at `http://192.168.213.54:81`: **Hosts → Proxy Hosts** → each of the eight hosts → **Edit** → **Forward Hostname / IP** → the same last number on the new prefix → **Save**.
3. **Homepage** — the allow-list and every monitor and widget address, from the node Shell:

```bash
pct exec 107 -- sed -i 's/192\.168\.1\./192.168.213./g' /opt/homepage/.env /opt/homepage/config/services.yaml
```

```bash
pct exec 107 -- systemctl restart homepage
```

4. **Uptime Kuma** at `http://192.168.213.57:3001`: each of the nine monitors → **Edit** → the URL, or the DNS monitor's **Resolver Server** → the new prefix → **Save**.
5. **Nextcloud**, in **Proxmox → 105 (nextcloudpi) → Console** — list the trusted entries and note which index holds `192.168.1.58`:

```bash
sudo -E -u www-data php /var/www/nextcloud/occ config:system:get trusted_domains
```

Set that index (`1` below — use the one the listing showed):

```bash
sudo -E -u www-data php /var/www/nextcloud/occ config:system:set trusted_domains 1 --value=192.168.213.58
```

Then the proxy entry the Reverse Proxy page added — find its index the same way and set it:

```bash
sudo -E -u www-data php /var/www/nextcloud/occ config:system:get trusted_proxies
```

```bash
sudo -E -u www-data php /var/www/nextcloud/occ config:system:set trusted_proxies 2 --value=192.168.213.54
```

6. **Vaultwarden** — nothing: it lives by its name.
7. **The Caséta Pro bridge**, in the Lutron app: **Settings → Advanced → Integration → Network Settings** → `192.168.213.61`, gateway `192.168.213.1`, DNS `192.168.213.53`. Then reload the Lutron Caséta integration in Home Assistant; remove and re-add it if the lights stay unavailable.
8. **SMB shares** — on the Mac, **Finder → Go → Connect to Server** → `smb://192.168.213.20/files`; on the Windows PC, map the drive letter again to `\\192.168.213.20\files`.
9. Remove the Mac's old-range alias:

```bash
sudo ifconfig en0 -alias 192.168.1.200
```

## Prove it

One check per service, in the order things depend on each other:

1. AdGuard resolves: browse to `http://proxmox.kuzco.org` — the rewrite now points at the new proxy address.
2. Every proxied name loads with its padlock: `proxmox.`, `ha.`, `nas.`, `frigate.`, `cloud.`, `vault.`, `home.`, `status.`.
3. Frigate shows all seven cameras live.
4. Home Assistant: the Frigate cards, the NUT sensor, and a lock command all answer.
5. Uptime Kuma is green across the board; Homepage's dots agree.
6. Nextcloud and Bitwarden sync on the phone.
7. The TrueNAS share opens from the Mac and the PC.
8. From the phone on cellular, `http://192.168.213.51:8123` loads through Tailscale — the new subnet route is approved and working.
9. From the phone on a Wi-Fi that uses `192.168.1.x` — the whole point — the house answers.

## Bring the collection along
Every page in this collection, and the app's Addressing Plan view, carries the old prefix. That is a single substitution in the RunBook repository — `192.168.1.` to `192.168.213.` — done as one maintenance commit the same evening, so the guides describe the house as it now is. The two sentences on the Start Here page that recount the *old* range stay as history.

> [!NOTE]
> Snapshots taken before the move are now the only thing on this host that remember `192.168.1.x`. Keep the `pre-renumber` snapshots a week, then delete them from each guest's **Snapshots** tab — the Maintenance page's thin-pool note explains why they should not linger.
