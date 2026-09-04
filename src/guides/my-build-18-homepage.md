---
title: Homepage
subtitle: One bookmark for the whole build — every service on a single fast page
collection: My Build
order: 18
accent: spruce
---

By now the build answers at a dozen addresses, and nobody in a local-first household should have to remember any of them. **Homepage** puts everything on one fast page: a tile per service, a live up/down dot on each, an optional strip of host stats across the top. No accounts, no database, nothing to log into — just a few **YAML (YAML Ain't Markup Language)** files you edit once. Set it as the start page on the family's devices and the server finally has a front door.

This is one more small service **LXC (Linux Container)** on the Proxmox host, alongside AdGuard, Nginx Proxy Manager, Nextcloud, and Vaultwarden — with Uptime Kuma joining on the next page. Build it after the services above exist, so its tiles point at things that are actually running.

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
This happens *while the script runs*. On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once any of these pages saves defaults), pick **Advanced Install**. Every dialog it can show, in order, with this build's answer:

- **TELEMETRY & DIAGNOSTICS** (first community-script run only, and it appears **before** the menu) → decline — nothing in this build phones home
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login; a **Verify Root Password** box repeats a non-blank entry
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the prefills as offered — currently **2 cores, 6 GB RAM** (older script versions offered 4 GB; the number tracks what `pnpm build` needs, so the script's current prefill wins over any figure printed here)
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.55/24`**, gateway **`192.168.1.1`** — never DHCP
- **IPv6** → **Fully Disabled** — this LAN runs IPv4
- **MTU, DNS search domain, DNS server, MAC address, VLAN** → all blank — blank inherits the host's settings, which are right
- **Tags** → keep the offered tag
- **SSH KEY SOURCE** → **none / No keys**, then **SSH ACCESS** → **No** — the container's **Console** in Proxmox covers every shell need
- **FUSE SUPPORT** → **No**
- **TUN/TAP SUPPORT** → **No** — Tailscale runs on the Proxmox host, not in containers
- **NESTING SUPPORT** → **Yes**, the offered default — Debian 13's systemd can start degraded without it
- **GPU PASSTHROUGH** → **No**, the default — nothing here touches the card
- **KEYCTL** → not shown for unprivileged containers; the wizard forces it on internally
- **APT CACHER PROXY, HTTP/HTTPS PROXY, HOST CA INHERITANCE** → **No / blank**, all three
- **CONTAINER TIMEZONE** → leave as offered; empty inherits the host's
- **CONTAINER PROTECTION** → **No** — a dashboard rebuilds in minutes, the page-5 rule for skipping it
- **DEVICE NODE CREATION** → **No**, the default
- **MOUNT FILESYSTEMS** → leave **empty**
- **POST-INSTALL HOOK (HOST)** → leave **empty**
- **VERBOSE MODE** → **No**, then review **CONFIRM SETTINGS** and press **Create LXC**
- **Which storage pool?** (two radiolists — container, then template — shown only when more than one pool qualifies; this host's stock local/local-lvm split auto-selects silently) → **local-lvm** for the container, **local** for the template
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available"** (if it appears) → **Ignore** — numbered **2**, or **3** in the four-option variant — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

> [!INPUT] homepage-console-user | Homepage console username | | root

> [!SECRET] homepage-root | Homepage container root password
> Set at the wizard's **Set Root Password** prompt; logs into the container's **Console** in Proxmox as `root`.

The static address matters doubly here: the installer bakes it into Homepage's safety allow-list, and it recurs everywhere below. Then settle in — the script announces "Installing Homepage (Patience)" and means it. It downloads the latest release's source and compiles the page on the container's own CPU, which can take a quarter of an hour. It finishes by printing the address: `http://192.168.1.55:3000`.

> [!INPUT] homepage-ip | Homepage container IP | 192.168.1.55

> [!WARNING]
> The static IP matters more than usual here. Homepage ships a safety feature called **host validation**, and the installer writes this exact address into the allow-list. If the container's IP ever wandered, the page would answer every visit with "Host validation failed" instead of your dashboard. The `.55` static sits in the `.2–.99` zone the router's pool can never touch — exactly why the zone exists.

> [!DETAILS] What the script actually builds
> Node.js and the pnpm package manager; the source of the latest Homepage release unpacked to `/opt/homepage`; then a full `pnpm install` and `pnpm build` — the compile step is why the RAM prefill is generous (6 GB at this writing) and the install is slow. It runs as a systemd service named `homepage` on port 3000, seeds starter config into `/opt/homepage/config/`, and writes one more file worth remembering: `/opt/homepage/.env`, containing `HOMEPAGE_ALLOWED_HOSTS=localhost:3000,`-your-IP-`:3000`. That is the allow-list from the warning above, and it comes back when you wire in a proxy name.

### Confirm it loaded, then set it to start at boot
First, browse to `http://192.168.1.55:3000` and confirm the default page with its sample tiles loads — that proves the install succeeded, and everything below is editing that into your own page. Then make it permanent: a front door that vanishes after a power cut teaches the family to stop using it. Select the container in the left tree, open **Options**, and set **Start at boot** to Yes — or from the node Shell:

```bash
pct set 107 -onboot 1
```

(`107` is this build's next free ID after Vaultwarden's `106`; confirm against the left tree.)

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
        description: The monitor of record (built on the next page)
        siteMonitor: http://192.168.1.57:3001

- Apps:
    - Home Assistant:
        icon: home-assistant.png
        href: http://192.168.1.51:8123
        description: Automations, locks, sensors
        siteMonitor: http://192.168.1.51:8123
    - Frigate:
        icon: frigate.png
        href: https://192.168.1.52:8971
        description: Cameras and recordings
        siteMonitor: https://192.168.1.52:8971
    - Nextcloud:
        icon: nextcloud.png
        href: https://cloud.example.com
        description: Files and photo backup
        siteMonitor: https://192.168.1.58
    - Vaultwarden:
        icon: vaultwarden.png
        href: https://vault.example.com
        description: The synced secret store
        siteMonitor: http://192.168.1.56:8000
```

Save, click the refresh icon, and the page is suddenly worth bookmarking. One exception on purpose: the Uptime Kuma tile's dot sits red until the next page builds it. And two tiles break the direct-address pattern deliberately: **Vaultwarden**'s `href` is its proxy name because its login only works through `https://vault.example.com` (its `siteMonitor` watches the plain HTTP (Hypertext Transfer Protocol) port 8000 the service actually listens on), and **Nextcloud**'s is `https://cloud.example.com` because that is the address its page standardises every client on — the raw address answers with a certificate warning. Both keep `siteMonitor` on the direct address, so the dots keep telling the truth.

> [!NOTE]
> The `siteMonitor` lines give each tile a live up/down dot with a response time — Homepage quietly sends each address a request and reports what came back. Two things to know: it is a glance, not an alarm — Uptime Kuma, built on the next page, is the thing that actually notifies you — and it skips certificate checking entirely, which is why the self-signed Proxmox and Nextcloud can be watched here without any ignore-certificate toggle. A green dot proves the service answers, not that its certificate is healthy.

> [!DETAILS] How the icons work
> Bare names like `proxmox.png` come from the community **Dashboard Icons** set, which has an icon for nearly everything self-hosted (`.png`, `.svg`, and `.webp` all work). No icon there? Prefix `mdi-` for any Material Design icon (`mdi-flask-outline`) or `si-` for a brand logo from Simple Icons (`si-github`), optionally with a color suffix like `mdi-flask-#5b8f7a`. A full URL to any image works too.

> [!DETAILS] Pointing at the pretty names instead
> Once Nginx Proxy Manager gives your services real names, the `href` lines can use `https://proxmox.example.com` and friends — every click lands on a padlock instead of a certificate warning, and nobody has to remember a port number. The trade-off: every tile then depends on the proxy and the AdGuard DNS (Domain Name System) rewrite staying healthy, so the dashboard's links break precisely when the proxy is the thing that broke. Direct addresses keep it honest; pretty names make it friendlier. Either way, keep the `siteMonitor` lines on direct addresses so the dots keep telling the truth.

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
> The others, one line each: `homeassistant` wants a long-lived access token from your Home Assistant profile page; `adguard` reuses the dashboard login (`type: adguard`, `url`, plus `username` and `password`); `truenas` an API key (add `version: 2` on TrueNAS Scale 25.04 or newer, which this build runs); `uptimekuma` the slug of a status page; `frigate` the admin login (`username` and `password` — this build's 8971 requires auth, and the credential-free internal port 5000 is fenced to Home Assistant and Kuma only), plus `enableRecentEvents: true` for a list of latest detections; `npm` the admin email and password; `nextcloud` the NC-Token from its **Settings → System** page. Exact recipes live at [gethomepage.dev/widgets](https://gethomepage.dev/widgets/).

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
Add one more proxy host in Nginx Proxy Manager, the same routine used for the other services — **Hosts → Proxy Hosts → Add Proxy Host**:

- **Domain Names** → `home.example.com`
- **Scheme** → `http`
- **Forward Hostname / IP** → `192.168.1.55`
- **Forward Port** → `3000`
- **Websockets Support** → **on**
- **SSL tab → SSL Certificate** → the `*.example.com` wildcard, and **Force SSL** → **on**

The wildcard `*.example.com` DNS rewrite in AdGuard already answers for any new name, so there is nothing to add there. But there *is* one step unique to Homepage — teaching it to answer to the new name. In the container's console, edit `/opt/homepage/.env`:

The allow-list is comma-separated with no spaces — add the new name to the end:

```ini
HOMEPAGE_ALLOWED_HOSTS=localhost:3000,192.168.1.55:3000,home.example.com
```

```bash
systemctl restart homepage
```

Then `https://home.example.com` greets you with a padlock and your tiles.

> [!WARNING]
> Skip the `.env` edit and the new name answers with "Host validation failed. See logs for more details." That is not the proxy misbehaving — it is Homepage checking the browser's Host header against its allow-list, a deliberate safety feature. Add the host exactly as the error logs it, restart the service, done.

### Give the watcher a watcher
Uptime Kuma is built on the next page. Once it exists, give it an HTTP monitor pointed at the direct address `http://192.168.1.55:3000` — the install's allow-list already admits that address, so the monitor works untouched, and the page that watches everything is itself watched. The next page's monitor list includes exactly this entry, so working in order covers it.

### Update on purpose
When you choose to take a new release, type `update` in the container's console. It fetches the newest source, rebuilds (patience again), and preserves your config files and `.env` — with one artifact to expect: if `.env` carries no auth lines, the updater appends a few **commented-out `HOMEPAGE_AUTH_*` template lines** to it. Leave them commented. They belong to Homepage v2's optional login gate, which stays off unless deliberately filled in — the no-accounts design of this page holds. Take a Proxmox snapshot first — the same habit used for the rest of these containers — so rollback is instant if a release misbehaves.

### Make it the start page
The actual point: on the family's devices, set `https://home.example.com` — or the plain `http://192.168.1.55:3000` — as the browser's start page, or at least the first bookmark on the bar. The build now opens like an appliance.

> [!NOTE]
> Away from home, the dashboard works through the Tailscale tunnel exactly as-is: subnet routing delivers you to `192.168.1.55:3000`, which the allow-list already admits. The tiles' direct-address links just work; the pretty names also need your phone's DNS pointed back at AdGuard over the tunnel, which the remote-access setup already covers.
