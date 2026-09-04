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
> Installing from afar, over Tailscale on a flaky link? A dropped session kills the script with it. Stalled during the settings dialogs, nothing was created — `pct list` to confirm, then simply re-run. But a drop during the long build phase leaves a half-made container (`pct destroy` its ID, re-run). On an unreliable connection, run the whole install inside tmux (`apt install tmux -y`, then `tmux`, then the script) — after a disconnect, reopen the Shell and `tmux attach` resumes as if nothing happened.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used throughout this build. These are the well-regarded successor to the tteck scripts, but the habit stands regardless of source.

### Choose Advanced and pin a static IP
This happens *while the script runs*. On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once any of these pages saves defaults), pick **Advanced Install**. Every dialog it can show, in order, with this build's answer:

- **TELEMETRY & DIAGNOSTICS** (first community-script run only, and it appears **before** the menu) → decline — nothing in this build phones home
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login; a **Verify Root Password** box repeats a non-blank entry
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the prefills: **2 cores, 4 GB RAM, 6 GB disk** — the RAM serves `pnpm build`, the disk holds its node_modules and build output; if a future script offers different numbers, its prefill wins
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
> Node.js and the pnpm package manager; the source of the latest Homepage release unpacked to `/opt/homepage`; then a full `pnpm install` and `pnpm build` — the compile step is why the RAM default is a generous 4 GB and the install is slow. It runs as a systemd service named `homepage` on port 3000, seeds starter config into `/opt/homepage/config/`, and writes one more file worth remembering: `/opt/homepage/.env`, containing `HOMEPAGE_ALLOWED_HOSTS=localhost:3000,`-your-IP-`:3000`. That is the allow-list from the warning above, and it comes back when you wire in a proxy name.

### Confirm it loaded, then set it to start at boot
1. Browse to `http://192.168.1.55:3000`. The default page with its sample tiles proves the install succeeded — everything below edits that into your own page.
2. In the Proxmox left tree select the container, open **Options**, and set **Start at boot** → **Yes**.

The same setting from the node Shell instead, if you prefer (`107` is this build's next free ID after Vaultwarden's `106`; confirm against the left tree):

```bash
pct set 107 -onboot 1
```

> [!NOTE]
> A front door that vanishes after a power cut teaches the family to stop using it. This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief blips never reach the container; start-at-boot covers the longer outages that drain the battery and force a clean shutdown.

## Make it yours

### Meet the config files
All configuration lives in `/opt/homepage/config/` inside the container, edited from the container's **Console** in Proxmox. Four files matter:

- `services.yaml` — the tiles
- `widgets.yaml` — the strip across the top
- `bookmarks.yaml` — plain links
- `settings.yaml` — title and theme

How every edit below lands:

- The step's one-liner empties the shipped sample and opens the file, so the paste lands clean
- Save and exit with `Ctrl+O`, `Enter`, `Ctrl+X`
- Reload the page in the browser — no service restart, ever
- `settings.yaml` changes specifically want the small **refresh icon** in the page's bottom-right corner, which regenerates the page

### Lay out your services
Empty and open the services file:

```bash
: > /opt/homepage/config/services.yaml && nano /opt/homepage/config/services.yaml
```

Paste the build itself — two groups, one tile per service:

```yaml
- Infrastructure:
    - Proxmox:
        icon: proxmox.png
        href: https://proxmox.kuzco.org
        description: The hypervisor itself
        siteMonitor: https://192.168.1.50:8006
    - TrueNAS:
        icon: truenas-scale.png
        href: https://nas.kuzco.org
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
        href: https://status.kuzco.org
        description: The monitor of record (built on the next page)
        siteMonitor: http://192.168.1.57:3001

- Apps:
    - Home Assistant:
        icon: home-assistant.png
        href: https://ha.kuzco.org
        description: Automations, locks, sensors
        siteMonitor: http://192.168.1.51:8123
    - Frigate:
        icon: frigate.png
        href: https://frigate.kuzco.org
        description: Cameras and recordings
        siteMonitor: https://192.168.1.52:8971
    - Nextcloud:
        icon: nextcloud.png
        href: https://cloud.kuzco.org
        description: Files and photo backup
        siteMonitor: https://192.168.1.58
    - Vaultwarden:
        icon: vaultwarden.png
        href: https://vault.kuzco.org
        description: The synced secret store
        siteMonitor: http://192.168.1.56:8000
```

Save and exit, then click the refresh icon — the page is suddenly worth bookmarking.

> [!NOTE]
> One rule decides every `href`: the proxy name wherever the Reverse Proxy page made one — a padlock and no port number for the household — and the plain address only where no name exists (AdGuard Home and Nginx Proxy Manager). Vaultwarden could never take its address anyway: its login needs the secure context only the proxied name provides. Home Assistant's name works once the Reverse Proxy page's trusted-proxy step is done (Home Assistant 2026.8 or newer); until then `http://192.168.1.51:8123` is the link. Every `siteMonitor` stays on the direct address, so the dots keep telling the truth even when the proxy itself is what broke. And one dot stays red on purpose: Uptime Kuma's, until the next page builds it.

> [!NOTE]
> The `siteMonitor` lines give each tile a live up/down dot with a response time — Homepage quietly sends each address a request and reports what came back. Two things to know: it is a glance, not an alarm — Uptime Kuma, built on the next page, is the thing that actually notifies you — and it skips certificate checking entirely, which is why the self-signed Proxmox and Nextcloud can be watched here without any ignore-certificate toggle. A green dot proves the service answers, not that its certificate is healthy.

> [!DETAILS] How the icons work
> Bare names like `proxmox.png` come from the community **Dashboard Icons** set, which has an icon for nearly everything self-hosted (`.png`, `.svg`, and `.webp` all work). No icon there? Prefix `mdi-` for any Material Design icon (`mdi-flask-outline`) or `si-` for a brand logo from Simple Icons (`si-github`), optionally with a color suffix like `mdi-flask-#5b8f7a`. A full URL to any image works too.

> [!DETAILS] Pointing at the raw addresses instead
> The trade-off in the names: every link depends on Nginx Proxy Manager and the AdGuard DNS (Domain Name System) rewrite staying healthy, so the links break precisely when the proxy is the thing that broke — while the dashboard itself stays reachable at `http://192.168.1.55:3000`, and the dots still tell the truth, because `siteMonitor` never left the direct addresses. If you would rather the links survive a proxy outage too, swap each `href` for its tile's `siteMonitor` value; Vaultwarden is the one tile that cannot, since its login needs the secure context only the proxied name provides.

### The strip across the top
`widgets.yaml` fills the page header. Empty and open it:

```bash
: > /opt/homepage/config/widgets.yaml && nano /opt/homepage/config/widgets.yaml
```

A search box and a clock are the two that earn their place:

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
> Any tile can grow a `widget:` block showing live numbers — at the cost of pasting a credential into `services.yaml`. The most rewarding one is Proxmox: VM and container counts plus real host CPU and RAM. It needs a dedicated **read-only API (application programming interface) token**, never the root password. In the Proxmox UI:
>
> 1. **Datacenter → Permissions → Users → Add** — user `api`, realm Linux PAM.
> 2. **API Tokens → Add** — user `api@pam`, Token ID `homepage`, Privilege Separation ticked. Copy the secret the dialog shows — it appears once — into Vaultwarden and the field below.
> 3. **Permissions → Add** — the **PVEAuditor** role at path `/`, Propagate ticked — once for the user *and* once for the token.
> 4. Extend the Proxmox tile in `services.yaml`:
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
Two small files finish the job. `bookmarks.yaml` holds plain links — the router's admin page is the classic, the thing nobody can ever find when they need it. Empty and open it:

```bash
: > /opt/homepage/config/bookmarks.yaml && nano /opt/homepage/config/bookmarks.yaml
```

Then paste:

```yaml
- Household:
    - Router:
        - abbr: RT
          href: http://192.168.1.1
```

And `settings.yaml` names the page. Empty and open it:

```bash
: > /opt/homepage/config/settings.yaml && nano /opt/homepage/config/settings.yaml
```

Then paste:

```yaml
title: Home
theme: dark
```

Save, click the refresh icon, done.

## Wire it into the build

### Give it a name behind the proxy
Add one more proxy host in Nginx Proxy Manager, the same routine used for the other services — **Hosts → Proxy Hosts → Add Proxy Host**:

- **Domain Names** → `home.kuzco.org`
- **Scheme** → `http`
- **Forward Hostname / IP** → `192.168.1.55`
- **Forward Port** → `3000`
- **Websockets Support** → **on**
- **SSL tab → SSL Certificate** → the `*.kuzco.org` wildcard, and **Force SSL** → **on**

The wildcard `*.kuzco.org` DNS rewrite in AdGuard already answers for any new name, so there is nothing to add there. One step is unique to Homepage — teaching it to answer to the new name. In the container's console, open its environment file:

```bash
nano /opt/homepage/.env
```

The allow-list is comma-separated with no spaces — add the new name to the end of the line, then save and exit:

```ini
HOMEPAGE_ALLOWED_HOSTS=localhost:3000,192.168.1.55:3000,home.kuzco.org
```

Restart:

```bash
systemctl restart homepage
```

Then `https://home.kuzco.org` greets you with a padlock and your tiles.

> [!WARNING]
> Skip the `.env` edit and the new name answers with "Host validation failed. See logs for more details." That is not the proxy misbehaving — it is Homepage checking the browser's Host header against its allow-list, a deliberate safety feature. Add the host exactly as the error logs it, restart the service, done.

### Give the watcher a watcher
Uptime Kuma is built on the next page. Once it exists, give it an HTTP monitor pointed at the direct address `http://192.168.1.55:3000` — the install's allow-list already admits that address, so the monitor works untouched, and the page that watches everything is itself watched. The next page's monitor list includes exactly this entry, so working in order covers it.

### Update on purpose
1. Take a Proxmox snapshot first — the same habit as the rest of these containers, so rollback is instant if a release misbehaves.
2. Type `update` in the container's console. It fetches the newest source and rebuilds (patience again), preserving your config files and `.env`.
3. Expect one artifact: if `.env` carried no auth lines, the updater appends a few **commented-out `HOMEPAGE_AUTH_*` template lines**. Leave them commented — they belong to Homepage v2's optional login gate, which stays off unless deliberately filled in; the no-accounts design of this page holds.

### Make it the start page
The actual point: on the family's devices, set `https://home.kuzco.org` — or the plain `http://192.168.1.55:3000` — as the browser's start page, or at least the first bookmark on the bar. The build now opens like an appliance.

> [!NOTE]
> Away from home, the dashboard works through the Tailscale tunnel exactly as-is: subnet routing delivers you to `192.168.1.55:3000`, which the allow-list already admits. The tiles' direct-address links just work; the pretty names also need your phone's DNS pointed back at AdGuard over the tunnel, which the remote-access setup already covers.
