---
title: Homepage
subtitle: One bookmark for the whole build — every service on a single fast page
collection: My Build
order: 17
accent: spruce
---

By now the build answers at a dozen addresses, and nobody in an all-Apple, local-first household should have to remember any of them. **Homepage** puts everything on one fast page: a tile per service, a live up/down dot on each, an optional strip of host stats across the top. No accounts, no database, nothing to log into — just a few **YAML (YAML Ain't Markup Language)** files you edit once. Set it as the start page on the family's devices and the server finally has a front door.

This is one more small service **LXC (Linux Container)** on the Proxmox host, alongside AdGuard, Nginx Proxy Manager, Nextcloud, Vaultwarden, and Uptime Kuma. Build it last, once the others exist, so its tiles point at things that are actually running.

## Create the container

### Run the install script
The quickest path is the Proxmox community helper script, the same routine used for AdGuard and the other service containers. In the Proxmox web interface, click the node (the Maximus X Hero server) in the left tree, then click **Shell** — this runs on the Proxmox host itself, not inside a container or a VM (virtual machine). Paste this and press Return:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/homepage.sh)"
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used throughout this build. These are the well-regarded successor to the tteck scripts, but the habit stands regardless of source.

### Choose Advanced and pin a static IP
This happens *while the script runs*. When it asks **Default or Advanced**, pick **Advanced** and press Enter through the prefilled defaults — 2 cores, 4 GB RAM, an unprivileged Debian container — with one exception: the network. Set a **static IP** instead of DHCP (Dynamic Host Configuration Protocol), and record it; the installer bakes this exact address into Homepage's safety allow-list, and you will reuse it everywhere below. Then settle in — the script announces "Installing Homepage (Patience)" and means it. It downloads the latest release's source and compiles the page on the container's own CPU, which can take a quarter of an hour. It finishes by printing the address: `http://`-the-IP-`:3000`.

> [!INPUT] homepage-ip | Homepage container IP | 192.168.1.55

> [!WARNING]
> The static IP matters more than usual here. Homepage ships a safety feature called **host validation**, and the installer writes this exact address into the allow-list. If the container's IP ever wandered, the page would answer every visit with "Host validation failed" instead of your dashboard. Keep the address outside the router's DHCP range so it can never be handed out elsewhere.

> [!DETAILS] What the script actually builds
> Node.js and the pnpm package manager; the source of the latest Homepage release unpacked to `/opt/homepage`; then a full `pnpm install` and `pnpm build` — the compile step is why the RAM default is a generous 4 GB and the install is slow. It runs as a systemd service named `homepage` on port 3000, seeds starter config into `/opt/homepage/config/`, and writes one more file worth remembering: `/opt/homepage/.env`, containing `HOMEPAGE_ALLOWED_HOSTS=localhost:3000,`-your-IP-`:3000`. That is the allow-list from the warning above, and it comes back when you wire in a proxy name.

### Set it to start at boot
A front door that vanishes after a power cut teaches the family to stop using it. Select the container in the left tree, open **Options**, and set **Start at boot** to Yes — or from the node Shell:

```bash
pct set 108 -onboot 1        # swap in the container's actual ID
```

> [!NOTE]
> This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief power blips never reach the container. Start-at-boot covers the longer outages that drain the battery and force a clean shutdown.

## Make it yours

### Meet the config files
All configuration lives in `/opt/homepage/config/` inside the container — open the container's **Console** in Proxmox and edit with `nano`. Four files matter: `services.yaml` (the tiles), `widgets.yaml` (the strip across the top), `bookmarks.yaml` (plain links), and `settings.yaml` (title and theme). After saving, reload the page in the browser; `settings.yaml` changes specifically want the small **refresh icon** in the page's bottom-right corner, which regenerates the page. No service restart either way.

```bash
nano /opt/homepage/config/services.yaml
```

### Lay out your services
Replace the sample content of `services.yaml` with the build itself — two groups, one tile per service. Swap in your own addresses:

```yaml
- Infrastructure:
    - Proxmox:
        icon: proxmox.png
        href: https://192.168.1.50:8006
        description: The hypervisor itself
        siteMonitor: https://192.168.1.50:8006
    - TrueNAS:
        icon: truenas-scale.png
        href: http://192.168.1.20
        description: ZFS mirror and SMB shares
        siteMonitor: http://192.168.1.20
    - AdGuard Home:
        icon: adguard-home.png
        href: http://192.168.1.53
        description: DNS and ad blocking
        siteMonitor: http://192.168.1.53
    - Nginx Proxy Manager:
        icon: nginx-proxy-manager.png
        href: http://192.168.1.54:81
        description: Names and certificates
        siteMonitor: http://192.168.1.54:81
    - Uptime Kuma:
        icon: uptime-kuma.png
        href: http://192.168.1.57:3001
        description: The monitor of record
        siteMonitor: http://192.168.1.57:3001

- Apps:
    - Home Assistant:
        icon: home-assistant.png
        href: http://192.168.1.51:8123
        description: Automations, locks, sensors
        siteMonitor: http://192.168.1.51:8123
    - Frigate:
        icon: frigate.png
        href: http://192.168.1.52:8971
        description: Cameras and recordings
        siteMonitor: http://192.168.1.52:8971
    - Nextcloud:
        icon: nextcloud.png
        href: https://192.168.1.58
        description: Files and photo backup
        siteMonitor: https://192.168.1.58
    - Vaultwarden:
        icon: vaultwarden.png
        href: https://192.168.1.56
        description: The synced secret store
        siteMonitor: https://192.168.1.56
```

Save, click the refresh icon, and the page is suddenly worth bookmarking.

> [!NOTE]
> The `siteMonitor` lines give each tile a live up/down dot with a response time — Homepage quietly sends each address a request and reports what came back. Two things to know: it is a glance, not an alarm — Uptime Kuma remains the thing that actually notifies you — and it skips certificate checking entirely, which is why the self-signed Proxmox, Nextcloud, and Vaultwarden can be watched here without any ignore-certificate toggle. A green dot proves the service answers, not that its certificate is healthy.

> [!DETAILS] How the icons work
> Bare names like `proxmox.png` come from the community **Dashboard Icons** set, which has an icon for nearly everything self-hosted (`.png`, `.svg`, and `.webp` all work). No icon there? Prefix `mdi-` for any Material Design icon (`mdi-flask-outline`) or `si-` for a brand logo from Simple Icons (`si-github`), optionally with a color suffix like `mdi-flask-#5b8f7a`. A full URL to any image works too.

> [!DETAILS] Pointing at the pretty names instead
> Once Nginx Proxy Manager gives your services real names, the `href` lines can use `https://proxmox.home.lan` and friends — every click lands on a padlock instead of a certificate warning, and the family stays off Frigate's wide-open port 5000. The trade-off: every tile then depends on the proxy and the AdGuard DNS (Domain Name System) rewrite staying healthy, so the dashboard's links break precisely when the proxy is the thing that broke. Direct addresses keep it honest; pretty names make it friendlier. Either way, keep the `siteMonitor` lines on direct addresses so the dots keep telling the truth.

### The strip across the top
`widgets.yaml` fills the page header. A search box and a clock are the two that earn their place:

```yaml
- search:
    provider: duckduckgo
    focus: true

- datetime:
    text_size: xl
    format:
      timeStyle: short
```

> [!NOTE]
> You will also see a `resources` widget in the samples — skip it. It reports the CPU and memory of the Homepage container itself, not the server. The real host numbers come from the Proxmox tile widget in the expandable below.

> [!DETAILS] Live stats inside the tiles
> Any tile can grow a `widget:` block showing live numbers — at the cost of pasting a credential into `services.yaml`. The most rewarding one is Proxmox: VM and container counts plus real host CPU and RAM. Create a dedicated **read-only API (application programming interface) token** first, never the root password — in the Proxmox UI: **Datacenter → Permissions → Users → Add** (user `api`, realm Linux PAM), then **API Tokens → Add** (user `api@pam`, Token ID `homepage`, Privilege Separation checked), then under **Permissions → Add** grant the **PVEAuditor** role at path `/` with Propagate checked — once for the user *and* once for the token. Copy the secret the token dialog shows, store it in Vaultwarden, and extend the Proxmox tile:
>
> ```yaml
>         widget:
>           type: proxmox
>           url: https://192.168.1.50:8006
>           username: api@pam!homepage
>           password: paste-the-token-secret
> ```
>
> The others, one line each: `homeassistant` wants a long-lived access token from your Home Assistant profile page; `adguard` reuses the dashboard login; `truenas` an API key; `uptimekuma` the slug of a status page; `frigate` needs nothing at all and gains a list of latest detections if you add `enableRecentEvents: true`; `npm` the admin email and password. Exact recipes live at [gethomepage.dev/widgets](https://gethomepage.dev/widgets/).

> [!SECRET] homepage-proxmox-token | Proxmox API token secret (api@pam!homepage)

### Bookmarks and the name on the door
Two small files finish the job. `bookmarks.yaml` holds plain links — the router's admin page is the classic, the thing nobody can ever find when they need it:

```yaml
- Household:
    - Router:
        - abbr: RT
          href: http://192.168.1.1
```

And `settings.yaml` names the page:

```yaml
title: Home
theme: dark
```

Save, click the refresh icon, done.

## Wire it into the build

### Give it a name behind the proxy
Add one more proxy host in Nginx Proxy Manager, the same routine used for the other services: **Hosts → Proxy Hosts → Add Proxy Host**, domain `home.home.lan`, Scheme `http`, forwarding to the Homepage IP on port `3000`, **Websockets Support** on, then the certificate and **Force SSL** on the SSL tab. The wildcard DNS rewrite in AdGuard already answers for any new name, so there is nothing to add there. But there *is* one step unique to Homepage — teaching it to answer to the new name. In the container's console, edit `/opt/homepage/.env`:

```ini
# /opt/homepage/.env — add the name to the allow-list (comma-separated, no spaces)
HOMEPAGE_ALLOWED_HOSTS=localhost:3000,192.168.1.55:3000,home.home.lan
```

```bash
systemctl restart homepage
```

Then `https://home.home.lan` greets you with a padlock and your tiles.

> [!WARNING]
> Skip the `.env` edit and the new name answers with "Host validation failed. See logs for more details." That is not the proxy misbehaving — it is Homepage checking the browser's Host header against its allow-list, a deliberate safety feature. Add the host exactly as the error logs it, restart the service, done.

### Give the watcher a watcher
Add one more HTTP monitor in Uptime Kuma, pointed at the direct address `http://192.168.1.55:3000`. The install's allow-list already admits that address, so the monitor works untouched — and now the page that watches everything is itself watched.

### Update on purpose
When you choose to take a new release, type `update` in the container's console. It fetches the newest source, rebuilds (patience again), and preserves your config files and `.env`. Take a Proxmox snapshot first — the same habit used for the rest of these containers — so rollback is instant if a release misbehaves.

### Make it the start page
The actual point: on the family's devices, set `https://home.home.lan` — or the plain `http://192.168.1.55:3000` — as the browser's start page, or at least the first bookmark on the bar. The build now opens like an appliance.

> [!NOTE]
> Away from home, the dashboard works through the Tailscale tunnel exactly as-is: subnet routing delivers you to `192.168.1.55:3000`, which the allow-list already admits. The tiles' direct-address links just work; the pretty names also need your phone's DNS pointed back at AdGuard over the tunnel, which the remote-access setup already covers.
