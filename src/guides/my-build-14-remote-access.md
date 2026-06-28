---
title: Remote Access
subtitle: Tailscale on the Proxmox host — reach the whole build from anywhere, no port-forwards
collection: My Build
order: 14
accent: azure
---

Everything you have built so far answers only at home: the Proxmox web UI, Home Assistant, TrueNAS, Frigate, the AdGuard and Nextcloud and Vaultwarden LXCs (Linux containers), Homepage, Uptime Kuma — all of it lives on the `192.168.1.x` LAN (local area network) and stops at the front door. This guide fixes that for the entire build at once by putting **Tailscale on the Proxmox host** and turning that host into a *subnet router* for the whole home network.

The payoff fits this all-Apple, local-first household exactly: one mesh VPN (virtual private network), built from outbound connections only, with **no router port-forwards, ever.** Your network stays as closed to the internet as it is right now. Every guest stays on its normal LAN IP, and every one of them becomes reachable from your iPhone, MacBook, or HomePod-adjacent travels — through the single subnet route this host advertises.

> [!NOTE]
> This page assumes Proxmox VE (Proxmox Virtual Environment) is installed on the 500 GB NVMe (Non-Volatile Memory Express) drive, the i7-8700K server is on Ethernet through the Netgear GS308EPP switch with a static IP, and you can already log in to the web UI from a browser on the LAN.

> [!DETAILS] Why no ports get opened
> A port-forward is a router rule that sends anyone on the internet who knocks on a port straight to your server — a door held open to the whole internet, around the clock. Tailscale inverts that: every device makes only *outbound* connections and finds its peers with NAT (Network Address Translation) traversal, falling back to Tailscale's DERP relays only when a direct path is impossible. The result is that Proxmox and every guest behind it are reachable solely by devices signed in to your private tailnet, and the router's settings never change. Once the host is connected, `tailscale status` in the host shell lists each peer and whether the path to it is `direct` or `relayed` — your first check if remote access ever feels slow.

## Put the host on a tailnet

### Create your Tailscale account
Tailscale calls your private network a *tailnet*; it is created the moment you first sign in. Go to [tailscale.com](https://tailscale.com/) and sign up — the Personal plan is $0, free forever. There is no Tailscale password to invent: you sign in with an identity you already own. For this household, **Apple** is the natural choice — it is the same account behind Apple Home, the Home Key locks, and the HomePod mini — but Google, Microsoft, GitHub, or a passkey work too.

> [!TIP]
> Pick the account you are most certain you will still control in five years; it *is* your Tailscale identity, and the same account goes on every device here. Signing in with one account everywhere is the whole trick — that is what puts the host, your iPhone, and your MacBook on the same network.

### Install Tailscale on the Proxmox host
Tailscale's documented path for Proxmox is to install directly on the host — Proxmox VE 9 is Debian 13 "Trixie" underneath, so the standard Debian packages are correct. Open the host shell in the web UI (select the **pve** node, then **Shell**) and run the commands below. They are Tailscale's official Debian Trixie instructions with `sudo` removed, because this shell is already root.

```bash
# 1. Add Tailscale's signing key:
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null

# 2. Add the package repository:
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list

# 3. Install:
apt-get update
apt-get install tailscale
```

> [!DETAILS] Why this method, and not the install script
> Note what those two `curl` commands do *not* do: execute anything. One downloads a signing key, the other a one-line repo definition (open the `.list` URL in a browser and read it — it is genuinely one line), and then apt installs a normally signed package. Nothing is piped into a root shell, which is why this is the default here.
>
> Tailscale also offers an official one-liner that detects the OS and does the same setup:
>
> ```bash
> curl -fsSL https://tailscale.com/install.sh | sh
> ```
>
> It works fine — but it is still a script piped into a root shell, so apply the download-read-run habit used elsewhere in this build: fetch it to a file, read it, then run it.
>
> ```bash
> curl -fsSL https://tailscale.com/install.sh -o tailscale-install.sh
> less tailscale-install.sh
> sh tailscale-install.sh
> ```

> [!DETAILS] Why the host, not a container or VM
> It is tempting to drop Tailscale into one of the service LXCs, but the host is the right home for it here. Install it on the host and remote access is up the moment the i7-8700K is — independent of whether any guest is running, and able to route to *all* of them at once. A container-bound install ties your only way in to one container that has to stay up, and on this build the host is what you most need to reach when something has gone wrong. (Frigate, Home Assistant OS, and TrueNAS each keep their own normal LAN IPs; the subnet route below reaches every one of them without installing Tailscale inside any of them.)

> [!DETAILS] Running Proxmox VE 8 instead of 9
> PVE 9 is built on Debian 13 "Trixie" — hence `trixie` above. If this host is on PVE 8 (Debian 12 "Bookworm"), swap the two repo lines for the `bookworm` variants, then run the same `apt-get update` and `apt-get install tailscale`:
>
> ```bash
> curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
> curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list
> ```

### Connect the host to your tailnet
In the same shell, bring Tailscale up:

```bash
tailscale up
```

The output prints a URL. Open it in the browser on your MacBook (the server has no desktop of its own), sign in with the account from the first step, and the host joins your tailnet. Confirm with `tailscale ip -4`, which prints the host's new `100.x` Tailscale address.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50

> [!SECRET] proxmox-root-password | Proxmox root password

> [!DETAILS] What the host just received
> Every tailnet device gets a stable address in the `100.x.y.z` range that stays the same no matter where the device physically moves. So the host now has two addresses: the `192.168.1.x` LAN IP you set during install, and a `100.x` address other tailnet devices reach from anywhere. The next phase extends that reach to every guest in the rack.

### Stop the host's key from expiring
By default a tailnet device must re-authenticate every 180 days, and a server that silently drops off the network while you are travelling defeats the entire point. On the [Machines page](https://login.tailscale.com/admin/machines) of the admin console, find the **pve** row, open the **…** menu at the far right, and select **Disable Key Expiry**.

> [!WARNING]
> Tailscale recommends disabling key expiry on trusted servers and subnet routers — this host is about to be both. A subnet router whose key expires *stops routing*, cutting off every guest behind it. Your iPhone and MacBook can keep the 180-day default; re-authenticating there is a ten-second sign-in. Never run `tailscale up --force-reauth` over the Tailscale link itself — it can drop the connection mid-command, and then you are locked out until you are home.

## Route the whole LAN through the host

### Enable IP forwarding
Right now the tailnet reaches exactly one machine. A subnet router turns the host into a gateway that announces the entire `192.168.1.0/24` network, so every guest's normal LAN IP becomes reachable remotely — forward, advertise, approve. First, forwarding: a gateway has to pass packets between two networks, which Linux refuses to do until told. In the host shell:

```bash
echo 'net.ipv4.ip_forward = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
sysctl -p /etc/sysctl.d/99-tailscale.conf
```

> [!DETAILS] What those three lines do
> The first two write one kernel setting each — forward IPv4 packets, forward IPv6 packets — into a small config file under `/etc/sysctl.d/`, so the settings survive reboots. The third applies them immediately, no reboot needed. These are Tailscale's exact subnet-router commands, minus `sudo`.

### Advertise your home subnet
Still in the host shell, tell Tailscale which network the host can hand out. This build's LAN is `192.168.1.0/24` — take the host IP, keep the first three numbers, and end with `.0/24`:

```bash
tailscale set --advertise-routes=192.168.1.0/24
```

> [!DETAILS] Adapting the example to your network
> The `/24` is the standard home network mask. Worked examples:
>
> - Host at `192.168.1.50` → `--advertise-routes=192.168.1.0/24`
> - Host at `192.168.0.50` → `--advertise-routes=192.168.0.0/24`
> - Host at `10.0.0.50` → `--advertise-routes=10.0.0.0/24`
>
> Prefer `tailscale set` over passing `--advertise-routes` to `tailscale up`: `tailscale up` expects you to re-specify *every* setting each time, an easy way to accidentally undo something, while `set` changes the one route.

### Approve the route in the admin console
Advertised routes do nothing until an admin — you — approves them, so a stray device can never quietly announce itself as a gateway. Open the [Machines page](https://login.tailscale.com/admin/machines), select **pve** (its row now shows a **Subnets** badge), go to the **Subnets** section and select **Edit**; in the panel, tick `192.168.1.0/24` under **Subnet routes** and select **Save**.

> [!NOTE]
> Your other Apple devices need nothing extra: macOS, iOS, and tvOS automatically pick up new subnet routes. Only Linux clients opt in manually, with `tailscale set --accept-routes` — relevant only if you later run a Linux laptop on the tailnet.

## Prove it from your iPhone

### Put Tailscale on your phone
A phone on cellular data is the cleanest test: a device that is definitely not on your network, reaching addresses that should only exist on your network. Install Tailscale from the App Store (iOS 15 or later), open it, choose **Get Started**, and **Log in** with the same account you used for the host. iOS will ask permission to add a VPN configuration — accepting that prompt is what switches the connection on.

### Reach every service from anywhere
Turn off Wi-Fi so the phone is genuinely on cellular, confirm the Tailscale app shows connected, then browse to each service on its normal LAN address — no Tailscale install needed on any of them, because the subnet route carries them all:

- **Proxmox** — `https://192.168.1.50:8006` (the same self-signed certificate warning as on the LAN; **Advanced**, then **Proceed**).
- **Home Assistant** — the HA (Home Assistant) dashboard at the HA VM's IP.
- **TrueNAS** — the storage UI at the TrueNAS VM's IP.
- **Frigate, AdGuard, Nextcloud, Vaultwarden, Homepage, Uptime Kuma** — each at its own LXC IP, exactly as on the couch.

Served to a phone nowhere near the house, through zero opened ports.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52

> [!NOTE]
> One honest limitation: every remote path runs through this single host. If the i7-8700K is powered off, crashed, or wedged mid-boot while you are away, remote access is down with it. Tailscale can fail over between two subnet routers, but that needs a second always-on machine; on a one-server build, a dead host means a trip home — or a housemate and the power button. The CyberPower UPS (uninterruptible power supply) and NUT (Network UPS Tools) shutdown handling cover the *power-blip* case, not a hard crash.

> [!DETAILS] MagicDNS and the day-to-day habit
> The [Machines page](https://login.tailscale.com/admin/machines) now lists both devices, and MagicDNS (on by default for new tailnets) gives each a name like `pve.<tailnet>.ts.net`, drawn from its hostname — so `https://pve.<tailnet>.ts.net:8006` also reaches the web UI. Day to day, keep using the LAN IPs: thanks to the subnet route, they are the addresses that reach the host *and* every guest, both at home and away, with nothing to remember per service.

> [!DETAILS] Optional extras — exit node and a clean certificate
> Two add-ons, neither required and nothing later depends on them:
>
> - **Exit node** — `tailscale set --advertise-exit-node` on the host, approved on the Machines page like the subnet route. Selected on your iPhone, it routes *all* the phone's traffic through home — handy on hostile hotel Wi-Fi, off by default, separate from the subnet route.
> - **Quiet the Proxmox certificate warning over Tailscale** — Tailscale Serve fronts the web UI with a valid certificate. Run it in the host shell:
>
>   ```bash
>   tailscale serve --bg https+insecure://localhost:8006
>   ```
>
>   Tailscale's "on a Proxmox host" guide also documents a second route — installing a Tailscale-issued HTTPS certificate directly into Proxmox, kept current with a cron job. Serve is the simpler, self-contained option and is plenty here.

> [!DETAILS] Confirming this stays free
> Everything here runs on Tailscale's free Personal plan: $0 forever, up to 6 users, unlimited devices for those users — subnet routing and **Disable Key Expiry** included. If you read elsewhere that the free plan is "3 users / 100 devices," that is the old limit; the current Personal plan allows 6 users with free, unlimited user devices.
