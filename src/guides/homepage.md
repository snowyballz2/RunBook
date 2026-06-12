---
title: Homepage
subtitle: One bookmark for the whole build — every service on a single page
collection: Proxmox Home Server
order: 16
accent: azure
---

Fifteen guides in, the build answers at a dozen addresses — and nobody should have to remember any of them. Homepage puts everything on one fast page: a tile per service, up/down dots, optional live stats. No accounts, no database, nothing to log into — just a few YAML files you edit once. Set it as the start page on the family's browsers and the server finally has a front door.

## Put it up

### Run the install script
Same routine as *AdGuard Home* and *Uptime Kuma*: in the Proxmox web UI, click your node, then **Shell**, and run the community-scripts helper — reading it first, the download-read-run habit from the *Install Proxmox* guide:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/homepage.sh)"
```

Pick **Advanced** and press Enter through the prefilled defaults — 2 cores, 4 GB RAM, 6 GB disk, an unprivileged Debian 13 container — except networking: set a **static IP**, say `192.168.1.55`. Then settle in: the script announces "Installing Homepage (Patience)" and means it — it downloads the latest release's source code and compiles the page on the container's own CPU, which can take a quarter of an hour. It ends with the address: `http://<IP>:3000`.

> [!INPUT] homepage-ip | Homepage container IP | 192.168.1.55

> [!NOTE]
> The static IP matters more than usual here. Homepage ships a safety feature called host validation, and the installer bakes this exact address into the allow-list — if the container's IP ever wandered, the page would answer every visit with "Host validation failed" instead of your dashboard.

> [!DETAILS] What the script builds
> Node.js 22 and the pnpm package manager; the source of the latest Homepage release (v1.13 at the time of writing) unpacked to `/opt/homepage`; then a full `pnpm install` and `pnpm build` — the compile step is why the RAM default is a generous 4 GB and the install slow. It runs as a systemd service named `homepage` on port 3000, seeds starter config into `/opt/homepage/config/`, and writes one more file worth remembering: `/opt/homepage/.env`, containing `HOMEPAGE_ALLOWED_HOSTS=localhost:3000,<your-IP>:3000` — the allow-list from the note above. It comes back in the proxy step.

### Open it and make it permanent
Browse to `http://192.168.1.55:3000` — a default page with sample tiles loads immediately; everything from here is editing it into *your* page. First, the *Containers* guide habit: in Proxmox, select the container, open **Options**, and enable **Start at boot**. A front door that vanishes after a power cut teaches the family to stop using it.

## Make it yours

### Meet the config files
All configuration lives in `/opt/homepage/config/` inside the container — open the container's **Console** in Proxmox and edit with `nano`. The four that matter: `services.yaml` (the tiles), `widgets.yaml` (the strip across the top of the page), `bookmarks.yaml` (plain links), and `settings.yaml` (title and theme). After saving, reload the page in the browser — `settings.yaml` changes specifically want the small **refresh icon** in the page's bottom-right corner, which regenerates the page. No service restart either way.

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
        description: Storage and shares
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
        href: http://kuma-ip:3001
        description: The monitor of record
        siteMonitor: http://kuma-ip:3001

- Apps:
    - Home Assistant:
        icon: home-assistant.png
        href: http://192.168.1.51:8123
        description: Automations and dashboards
        siteMonitor: http://192.168.1.51:8123
    - Nextcloud:
        icon: nextcloud.png
        href: https://192.168.1.52
        description: Files and photo backup
        siteMonitor: https://192.168.1.52
    - Frigate:
        icon: frigate.png
        href: http://frigate-ip:5000
        description: Cameras and recordings
        siteMonitor: http://frigate-ip:5000
```

Save, click the refresh icon, and the page is suddenly worth bookmarking.

> [!NOTE]
> The `siteMonitor` lines give a tile a live up/down dot with response time — Homepage quietly sends each address a request and reports what happened. Two things to know: it's a glance, not an alarm — *Uptime Kuma* remains the thing that notifies you — and it skips certificate checking entirely, which is why the self-signed Proxmox and Nextcloud can be watched here without the ignore-TLS toggle Kuma needed. A green dot proves the service answers, not that its certificate is healthy.

> [!DETAILS] How the icons work
> Bare names like `proxmox.png` come from the community **Dashboard Icons** set, which has an icon for nearly everything self-hosted (`.png`, `.svg`, and `.webp` all work). No icon there? Prefix `mdi-` for any Material Design icon (`mdi-flask-outline`) or `si-` for brand logos from Simple Icons (`si-github`), optionally with a color suffix like `mdi-flask-#f0d453`. A full URL to any image works too.

> [!DETAILS] Pointing at the pretty names instead
> If the *Reverse Proxy* guide gave your services real names, the `href` lines can use `https://proxmox.example.com` and friends — every click lands on a padlock instead of a certificate warning, and the family stays off Frigate's wide-open port 5000 (that guide deliberately proxied Frigate through its authenticated port instead). The trade-off: every tile then depends on the proxy and the DNS rewrite being healthy, so the dashboard's links break precisely when the proxy is the thing that broke. Direct addresses keep it honest; pretty names make it friendlier. Pick one deliberately — and either way, keep the `siteMonitor` lines on direct addresses, so the dots keep telling the truth.

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
> You'll also see a `resources` widget in the samples — skip it. It reports the CPU and memory of the Homepage container itself, not the server. The real host numbers come from the Proxmox tile widget in the expandable below.

> [!DETAILS] Live stats inside the tiles
> Any tile can grow a `widget:` block showing live numbers — at the cost of pasting a credential into `services.yaml`. The most rewarding one is Proxmox: VM and container counts plus real host CPU and RAM. Create a dedicated read-only API token first — in the Proxmox UI: **Datacenter → Permissions → Users → Add** (user `api`, realm Linux PAM), then **API Tokens → Add** (user `api@pam`, Token ID `homepage`, Privilege Separation checked), then under **Permissions → Add** grant the **PVEAuditor** role at path `/` with Propagate checked — once for the user *and* once for the token. Copy the secret the token dialog shows, then extend the Proxmox tile:
>
> ```yaml
>         widget:
>           type: proxmox
>           url: https://192.168.1.50:8006
>           username: api@pam!homepage
>           password: the-token-secret
> ```
>
> AdGuard's is simpler — it reuses the dashboard login: `type: adguard`, `url`, plus your `username` and `password`. The rest, one line each: `homeassistant` wants a long-lived access token from your HA profile page; `truenas` an API key (add `version: 2` on 25.04 or newer); `uptimekuma` just the slug of the status page from the *Uptime Kuma* guide; `frigate` needs nothing at all — and gains a list of its latest detections if you add `enableRecentEvents: true`; `npm` the admin email and password; `nextcloud` the NC-Token from its **Settings → System** page. Exact recipes for all of them live at [gethomepage.dev/widgets](https://gethomepage.dev/widgets/).

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

Save, refresh icon, done.

## Wire it into the build

### Give it a name behind the proxy
One more proxy host in NPM, the routine from the *Reverse Proxy* guide: **Hosts → Proxy Hosts → Add Proxy Host**, domain `home.example.com`, Scheme `http`, forwarding to `192.168.1.55` port `3000`, **Websockets Support** on, then the wildcard certificate and **Force SSL** on the SSL tab. The wildcard DNS rewrite from that guide already answers for any new name, so there is nothing to add in AdGuard. But there *is* one step unique to Homepage — teaching it to answer to the new name. In the container's console, edit `/opt/homepage/.env`:

```ini
# /opt/homepage/.env — add the name to the allow-list (comma-separated, no spaces)
HOMEPAGE_ALLOWED_HOSTS=localhost:3000,192.168.1.55:3000,home.example.com
```

```bash
systemctl restart homepage
```

Then `https://home.example.com` greets you with a padlock and your tiles.

> [!NOTE]
> Skip the `.env` edit and the new name answers with "Host validation failed. See logs for more details." That's not the proxy misbehaving — it's Homepage checking the browser's Host header against its allow-list, a deliberate safety feature since v1.0. Add the host exactly as the error logs it, restart the service, done.

### Give the watcher a watcher
One more HTTP(s) monitor in *Uptime Kuma*, pointed at `http://192.168.1.55:3000` — the direct address, the *Reverse Proxy* guide's advice for monitors. The install's allow-list already admits that address, so the monitor works untouched.

### Update on purpose
Same pattern as *Uptime Kuma*: when you choose to take a new release, type `update` in the container's console. It fetches the newest source, rebuilds (patience again), and preserves your config files and `.env`. Snapshot first, the *Containers* habit.

### Make it the start page
The actual point: on the family's devices, set `https://home.example.com` — or the plain `http://192.168.1.55:3000` — as the browser's start page, or at least the first bookmark on the bar. The build now opens like an appliance.

> [!NOTE]
> Away from home, the dashboard works through the *Remote Access* guide's tunnel exactly as-is: subnet routing delivers you to `192.168.1.55:3000`, which the allow-list already admits. The tiles' links follow the same rule — direct addresses just work, while the pretty names also need your phone's DNS to reach AdGuard remotely, the wiring the *Reverse Proxy* guide's Tailscale expandable covers.
