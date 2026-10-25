---
title: Valheim Server
subtitle: An optional game server on the rack — one container, and a clear choice between Tailscale sharing and a router port-forward for how friends get in
collection: My Build
order: 27
accent: violet
---

A Valheim dedicated server is a small, headless Linux program: it wants a fast core or two, about 3 GB of RAM at idle, a few gigabytes of disk, and two UDP ports. The i7-8700K boosts to 4.7 GHz on a single core, which is exactly what the game rewards, and the 32 GB of RAM has the room once TrueNAS and Home Assistant have taken their 8 GB each. It runs as one more unprivileged container, built by the community Docker helper, so the nightly backup job already covers it.

Everything on this page is optional. Skip it and nothing else in the build changes.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host the container lives on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell and the container's Console.

> [!DETAILS] Instructions to send a friend
> Two ready-to-send messages, one per option. Copy the block, paste it into a text to the friend, and send the address and the password in a separate message — the address is the tailnet one from Option A or the public one from Option B, both recorded on this page.
>
> **Joining over Tailscale (Option A):**
>
> ```text
> Here's how to join my Valheim server. It's a one-time setup of about five minutes, then joining is normal. You need Valheim on Steam on a Windows PC — console and Game Pass versions can't join this server.
>
> 1. Download Tailscale for Windows from tailscale.com/download/windows and run the installer — it's a normal .exe. If Windows asks whether to let it make changes, say Yes.
> 2. After it installs, find the Tailscale icon in the system tray, bottom right next to the clock — if it's hidden, click the little up arrow there. Right-click it and choose Log in.
> 3. A browser page opens asking you to sign in. Pick whichever you already have — Google, Microsoft, Apple or GitHub — and go through its sign-in. The free Personal plan is all this needs; don't pay for anything. When it says the device is connected, you can close the page.
> 4. Now open the invite link I'm sending you, in that same browser. It shows a machine called "valheim" being shared with you — click Accept. It then shows up in the Tailscale tray menu under the other machines.
> 5. Leave Tailscale connected whenever you play — the tray icon is the on/off switch, and it's fine to leave it on all the time.
> 6. Make sure Steam has updated Valheim — it does this on its own, but the server runs the latest version and an old game shows "Incompatible version".
> 7. In Valheim, go to the Join Game tab and click Join IP at the bottom. Type the address I send you followed by :2456 — it looks like 100.64.0.5:2456 — and click Connect.
> 8. When it asks for a password, enter the one I send you. It's case-sensitive.
>
> First join takes a minute while the world loads. Your character is saved on your own PC; the world lives on my server. Tailscale only ever shows you that one machine — nothing else in my house — and I can switch it off from my side.
>
> If it says it can't connect: check the tray icon says Tailscale is connected and that "valheim" is in its list, then text me — I may need to restart the server.
> ```
>
> **Joining by address (Option B):**
>
> ```text
> Here's how to join my Valheim server. Nothing to install — you need Valheim on Steam on a Windows PC; console and Game Pass versions can't join this server.
>
> 1. Make sure Steam has updated Valheim — it does this on its own, but the server runs the latest version and an old game shows "Incompatible version".
> 2. In Valheim, go to the Join Game tab and click Join IP at the bottom.
> 3. Type the address I send you followed by :2456 — it looks like 203.0.113.10:2456 — and click Connect.
> 4. When it asks for a password, enter the one I send you. It's case-sensitive.
>
> First join takes a minute while the world loads. Your character is saved on your own PC; the world lives on my server.
>
> The server is only open to the internet for the evening, so if it says it can't connect another day, I've closed it again — just ask and I'll open it.
> ```
>
> Two things on your side that the messages rely on: the invite link comes from the *Share it with a friend* steps under Option A, where **Reusable link** lets one link serve several friends and an unused link expires after 30 days; and a friend who already has a Tailscale account accepts the share from it — any account works, it does not have to match the email you invited.

## Pick how friends get in
One decision shapes a prompt in the next section, so make it first.

> [!NOTE]
> **Option A — Tailscale.** The container joins your tailnet and you *share* that one machine with each friend's Tailscale account. Nothing on the router opens, it works from anywhere, and the Remote Access page's rule — no router port-forwards, ever — stays intact. Each friend needs a free Tailscale account and the app on their gaming PC.
>
> **Option B — a port-forward.** The router sends UDP 2456 and 2457 from the internet to the container. Anyone with your public address and the server password can join, with nothing to install. It is the common way Valheim servers are run, and it is the first inbound door this build opens.
>
> Build the container the same way for both; the two options are separate sections below. Pick one — or both, on demand: build for Option A, and for the one friend who will not install Tailscale, do Option B's router steps for that evening and delete the rule afterwards. The container needs no change, the Tailscale friends keep playing while the port is open, and the exposure lasts exactly as long as the forwarding rule exists. The container's TUN/TAP answer below only matters for Option A, so answer Yes if you might ever use it.

## Build the container

### Run the Docker helper
In **Proxmox → pve → Shell**:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/docker.sh)"
```

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build. This helper builds an unprivileged Debian 13 container and installs the Docker engine in it; the game server is a Docker image that goes in afterwards.

### Choose Advanced — every dialog answered
This helper asks one question before the usual menu:

1. **Choose the container OS** → **Debian** — the Alpine choice is smaller, but every other container here is Debian, and the Maintenance walk assumes it.
2. On the **Community-Scripts Options** menu, pick **Advanced Install**.

The prompts, in order:

- **Container type** → **Unprivileged**, as offered
- **Set Root Password** → set one, recorded below
- **Container ID** → accept the offered next-free number — `109` on this build unless the Voice page's containers came first; it is the ID every command below uses
- **Hostname** → `valheim`
- **Disk size** → `32` — the game server download is about 1 GB, but the hourly world backups accumulate beside it for a week at a time, and a long-played world runs to a hundred megabytes a copy. The number is a ceiling on the thin pool, not space taken: the container uses only what it writes, so 32 costs nothing over 16 until the backups need it
- **CPU cores** → `4`
- **RAM** → `6144` — a cap, not a reservation; the server idles near 3 GB
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.62/24`**, gateway **`192.168.1.1`** — never DHCP
- **IPv6** → **Fully Disabled**
- **MTU, DNS search domain, DNS server, MAC address, VLAN** → all blank
- **Tags** → keep the offered tag
- **SSH KEY SOURCE** → **none / No keys**
- **SSH ACCESS** → **No**
- **FUSE SUPPORT** → **No**
- **TUN/TAP SUPPORT** → **Yes** — Tailscale inside the container needs the TUN device for Option A, and it is harmless for Option B, so Yes keeps both open
- **NESTING SUPPORT** → **Yes** — Docker needs it
- **GPU PASSTHROUGH** → **No**
- **Use APT Cacher-NG proxy?** → **No** — it would route package downloads through an apt-cacher-ng server, and nothing on this network runs one
- **HTTP/HTTPS proxy?** → **No** — the same question for a web proxy; the house has none, and Nginx Proxy Manager is the other direction, inbound to your services
- **Container protection?** → **No** — it sets the guest's **Protection** flag, which makes Proxmox refuse to remove or destroy the container until you clear it under **Options**. Worth a Yes on something irreplaceable; this world is backed up hourly and the container nightly, and no other guest in the build carries it
- **Expose Docker TCP socket (insecure)?** — the install's own question, after the container exists → **n**

> [!INPUT] valheim-ct-id | Valheim container ID | 109

> [!INPUT] valheim-ip | Valheim container IP | 192.168.1.62

> [!SECRET] valheim-root-password | Valheim container root password

### Write the server's settings
In **Proxmox → 109 (valheim) → Console**, logged in as `root`.

1. Create the two folders the server keeps its files in:

```bash
mkdir -p /root/valheim-server/config /root/valheim-server/data
```

2. Write the start script — swap **`VALHEIM-PASS`** for the join password first:

```bash
cat > /root/valheim-run.sh <<'EOF'
docker run -d \
  --name valheim-server \
  --cap-add=sys_nice \
  --stop-timeout 120 \
  --restart always \
  -p 2456-2457:2456-2457/udp \
  -v /root/valheim-server/config:/config \
  -v /root/valheim-server/data:/opt/valheim \
  -e SERVER_NAME="Kuzco" \
  -e WORLD_NAME="Kuzco" \
  -e SERVER_PASS="VALHEIM-PASS" \
  -e SERVER_PUBLIC=false \
  -e TZ=America/New_York \
  -e BACKUPS_MAX_AGE=7 \
  ghcr.io/community-valheim-tools/valheim-server
EOF
```

> [!WARNING]
> Valheim's own rules for the join password: at least **five** characters, and it must not appear inside the server name or the world name. `SERVER_PUBLIC=false` keeps the server out of Steam's public browser — friends join by address, which both options below provide.

> [!INPUT] valheim-server-name | Valheim server name | Kuzco

> [!INPUT] valheim-world-name | Valheim world name | Kuzco

> [!SECRET] valheim-password | Valheim join password

3. Start it:

```bash
bash /root/valheim-run.sh
```

4. Watch the first start — it downloads the server from Steam, about 1 GB:

```bash
docker logs -f valheim-server
```

5. When a line reads `Game server connected`, press **Ctrl+C** — that leaves the log view; the server keeps running.

> [!DETAILS] What the start script sets
> The lines that matter, one job each:
>
> - **The restart rule, `--restart always`** — brings the server back after a container reboot.
> - **The stop timeout, `--stop-timeout 120`** — gives it two minutes to save the world on a stop.
> - **The priority capability, `--cap-add=sys_nice`** — lets it raise its own scheduling priority.
> - **The two `-v` lines** — keep the world, its backups and the server install on the container's disk, outside the Docker image, so an image update never touches them.
> - **The backup age, `BACKUPS_MAX_AGE`** — the image writes a world backup every hour under `/root/valheim-server/config/backups`, kept for the seven days this sets.
>
> The image checks Steam for a game update every fifteen minutes and applies one only when nobody is connected. The rest of its settings are documented at `github.com/community-valheim-tools/valheim-server-docker`.

### Prove it from the LAN
On a PC with Valheim installed, at home:

1. Select a character.
2. On the **Join Game** tab, click **Join IP**.
3. Enter `192.168.1.62:2456`.
4. Click **Connect**.
5. Enter the join password.

A loading screen into a fresh world means the server is running. Everything from here is about reaching it from outside.

## Option A — share it over Tailscale

> [!NOTE]
> The host already routes the whole LAN into your tailnet, but a shared machine never carries its subnet routes into the friend's tailnet — Tailscale's docs are explicit. So the container gets its own Tailscale client, and that one machine is what you share. Sharing is available on every plan and does not use your plan's user seats.

### Confirm the TUN device
The helper's **TUN/TAP SUPPORT → Yes** answer should have written two lines into the container's config. On the node **Shell**:

```bash
grep -c tun /etc/pve/lxc/109.conf
```

`2` means it did. `0` means the answer was missed — add the lines by hand:

> [!DETAILS] Adding the TUN device by hand
> Tailscale's own instructions for an unprivileged Proxmox container are these two lines in `/etc/pve/lxc/109.conf`, followed by a container restart:
>
> ```bash
> echo 'lxc.cgroup2.devices.allow: c 10:200 rwm' >> /etc/pve/lxc/109.conf
> echo 'lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file' >> /etc/pve/lxc/109.conf
> pct reboot 109
> ```

### Install Tailscale in the container
In **Proxmox → 109 (valheim) → Console**, fetch the installer, read it, then run it — the Remote Access page's habit:

```bash
curl -fsSL https://tailscale.com/install.sh -o tailscale-install.sh
less tailscale-install.sh
sh tailscale-install.sh
```

Then bring it up:

```bash
tailscale up
```

The output prints a URL:

1. Open it in a browser on the Mac.
2. Sign in with the same account the Remote Access page used — the container joins your tailnet as `valheim`.
3. Back in the Console, print its tailnet address:

```bash
tailscale ip -4
```

> [!INPUT] valheim-tailscale-ip | Valheim container tailnet IP (100.x) | 100.101.102.104
> The address friends join by. It never changes, and it survives the Renumber the LAN page untouched.

### Stop its key from expiring
A shared machine that silently drops off the tailnet is a server nobody can join. On the [Machines page](https://login.tailscale.com/admin/machines) of the admin console:

1. Find the **valheim** row.
2. Open the **…** menu at the far right.
3. Select **Disable Key Expiry**.

### Share it with a friend
Still on the Machines page:

1. Find the **valheim** row.
2. Open the **…** menu.
3. Select **Share**.
4. Select the **Copy invite link** tab.
5. Turn on **Reusable link** if more than one friend will use it.
6. Click **Copy share link**.
7. Send the friend the link.
8. Send the join password separately.

What the friend does, once:

1. Install Tailscale on the gaming PC.
2. Sign in — a free personal account is enough.
3. Open the link.
4. Click **Accept** — `valheim` appears in their Tailscale machine list.
5. In Valheim, on the **Join Game** tab, click **Join IP**.
6. Enter the tailnet address recorded above, followed by `:2456`.
7. Click **Connect**.
8. Enter the join password.

> [!DETAILS] What a share does and does not give away
> The friend's tailnet sees exactly one machine: the container. Not the host, not the LAN behind it, not the subnet route — this tailnet's own policy still applies to shared users, and the build left it at the permissive default, so every port on the container is reachable, which is only the game. An unused invite link expires after 30 days. To take a share back: the **valheim** row → **Share** → the friend's entry → **Revoke invite** — they lose the machine at once.

## Option B — forward the two ports on the router

> [!WARNING]
> This is the first inbound door in the build. It is a narrow one — two UDP ports to one container, gated by the game's own password, and the router's firewall still drops everything else — but the rest of the house's security has leaned on *no* inbound doors. The container holds nothing but the game, which is why it is the only thing a hole is pointed at.

In a browser on the Mac — the steps follow Verizon's own guide for the CR1000A:

1. Browse to `http://192.168.1.1`.
2. Sign in with the router's admin password — on the sticker on the router, unless you changed it.
3. Click **Advanced**.
4. In the left pane, select **Security & Firewall**.
5. Click **Port Forwarding**.
6. Application name → `Valheim`.
7. Inbound ports → `2456` to `2457`.
8. Outbound ports → the same, `2456` to `2457`.
9. Forwarding destination address → `192.168.1.62`.
10. Protocol → **UDP**.
11. Schedule → **Always**.
12. Click **Add to list**.
13. Click **Apply Changes**.

> [!SECRET] router-admin-password | Fios router (CR1000A) admin password

Then find the address friends will use. In **Proxmox → 109 (valheim) → Console**:

```bash
curl -4 https://ifconfig.me
```

> [!INPUT] home-public-ip | Home public IP (Fios) | 203.0.113.10
> Verizon can change this address, though it rarely does. If it moves, friends need the new one — or the router's **Dynamic DNS** page, in the manual's Network Settings section, can keep a hostname pointed at it.

What the friend does:

1. In Valheim, on the **Join Game** tab, click **Join IP**.
2. Enter the public address followed by `:2456`.
3. Click **Connect**.
4. Enter the join password.

## Keep it healthy

### Add it to Uptime Kuma
At `http://192.168.1.57:3001`:

1. Click **Add New Monitor**.
2. **Monitor Type** → **Ping**.
3. **Friendly Name** → `Valheim`.
4. **Hostname** → `192.168.1.62`.
5. Click **Save**.

### Stop and start it
In **Proxmox → 109 (valheim) → Console** — a stop saves the world first and takes up to two minutes:

```bash
docker stop valheim-server
```

```bash
docker start valheim-server
```

### Change a setting later
1. Edit the start script:

```bash
nano /root/valheim-run.sh
```

2. Save with **Ctrl+O**, then **Enter**.
3. Close the editor with **Ctrl+X**.
4. Replace the running server with one built from the edited script:

```bash
docker stop valheim-server && docker rm valheim-server && bash /root/valheim-run.sh
```

### Updates

> [!NOTE]
> Three layers update three ways. The game updates itself — the fifteen-minute Steam check in the container, applied only while nobody is connected — so a Valheim patch never strands friends on a mismatched version. The container's Debian layer updates in the Maintenance page's walk like every other guest. The server image itself changes rarely, and only matters when its project page announces a release worth having.

Pull the new image and rebuild the server from the same start script:

```bash
docker pull ghcr.io/community-valheim-tools/valheim-server && docker stop valheim-server && docker rm valheim-server && bash /root/valheim-run.sh
```

> [!NOTE]
> Where the files live: the container's 16 GB disk is a slice of `local-lvm`, the **500 GB NVMe** that holds Proxmox itself and every guest's disk — so the server install, the world under `/root/valheim-server/config/worlds_local`, and the hourly zips are all on the NVMe. Neither IronWolf is involved day to day: the mirror pair only receives the nightly copy below, and the footage drive is Frigate's alone.
>
> Backups come from two directions:
>
> - **The hourly world backup, under `/root/valheim-server/config/backups`** — the image writes one every hour as a zip, kept seven days. Restoring one means stopping the server, unzipping that file, and copying the world's `.db` and `.fwl` back into `/root/valheim-server/config/worlds_local`.
> - **The nightly container backup, on the `nas-backups` share** — the Proxmox Backups page's nightly job copies the whole container, world included, there — the TrueNAS mirror of the two IronWolf drives.
>
> If the LAN is ever renumbered, the Renumber the LAN page carries this container's new address; Option B's router rule needs the new destination too, while Option A's tailnet address never changes. When nobody can join, the When Something Breaks page has the ladder.
