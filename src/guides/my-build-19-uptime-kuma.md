---
title: Uptime Kuma
subtitle: One dashboard that watches the whole rack and pings your phone when something dies
collection: My Build
order: 19
accent: violet
---

By now this box runs the things the household leans on every day: AdGuard answering DNS (Domain Name System) for every device, Nextcloud holding the photos, Frigate watching the cameras, Home Assistant driving the locks and leak valve, TrueNAS keeping the ZFS (Zettabyte File System) mirror, plus Vaultwarden, Homepage, and Nginx Proxy Manager. The only "monitoring" so far is someone in the house noticing a thing stopped working. **Uptime Kuma** is the smoke detector for the rack: it checks each service on a schedule, draws the results on one dashboard, and pushes an alert to your iPhone the moment something stops answering.

It is the lightest guest on the i7-8700K — a single Node.js application with an embedded SQLite database — so it fits in an unprivileged LXC (Linux Container) with 1 CPU core, 1 GB RAM, and a 4 GB disk. Crucially, it checks from *inside* the `192.168.1.x` LAN (local area network), which is exactly right: it sees every service the way your Apple devices on the couch do, and nothing here needs a single router port-forward.

> [!NOTE]
> Build this near the end of the collection, after the services it watches exist. It touches no hardware, so it belongs in an unprivileged container — the secure default on this Proxmox VE (Proxmox Virtual Environment) host.

## Create the container

### Run the install script

1. In the Proxmox web interface at `https://192.168.1.50:8006`, click the node (the ASUS ROG Maximus X Hero server) in the left tree.
2. Click **Shell**.
3. Read the script below, then paste it in and press Return.
4. On the **Community-Scripts Options** menu, pick **Advanced Install**.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/uptimekuma.sh)"
```

> [!NOTE]
> The Shell runs on the Proxmox host itself, not inside a container or a VM (virtual machine). Advanced Install is where the static IP in the next step gets set; every other prompt keeps its prefilled default.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build. These community helper scripts are well regarded, but the habit stands regardless of source.

> [!DETAILS] What the script sets up
> It builds an **unprivileged** container on Debian 13, installs Node.js and Chromium, downloads the latest Uptime Kuma 2.x release into `/opt/uptime-kuma`, builds its production dependencies, and writes a systemd service named `uptime-kuma` that starts with the container and restarts itself if it crashes. It records the installed version in `/root/.uptime-kuma`, which the update command reads later. Port **3001** is Uptime Kuma's own default; the script leaves it alone.

> [!DETAILS] Prefer no scripts? Or Docker?
> You can build a plain unprivileged Debian container and install by hand from the project README, but on this build the native LXC above is the default — no Docker layer to manage, and updates are one command. The app is identical either way; this collection runs services as LXCs, not as containers-inside-a-VM.

### Choose Advanced — every dialog answered
On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once any of these pages saves defaults), pick **Advanced Install**. Every dialog it can show, in order, with this build's answer:

- **TELEMETRY & DIAGNOSTICS** (first community-script run only, and it appears **before** the menu) → decline — nothing in this build phones home
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login; a **Verify Root Password** box repeats a non-blank entry
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the prefills the script offers
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.57/24`**, gateway **`192.168.1.1`** — never DHCP
- **IPv6** → **Fully Disabled** — this LAN runs IPv4
- **MTU, DNS search domain, DNS server, MAC address, VLAN** → all blank — blank inherits the host's settings, which are right
- **Tags** → keep the offered tag
- **SSH KEY SOURCE** → **none / No keys**
- **SSH ACCESS** → **No** — the container's **Console** in Proxmox covers every shell need
- **FUSE SUPPORT** → **No**
- **TUN/TAP SUPPORT** → **No** — Tailscale runs on the Proxmox host, not in containers
- **NESTING SUPPORT** → **Yes**, the offered default — Debian 13's systemd can start degraded without it
- **GPU PASSTHROUGH** → **No**, the default — nothing here touches the card
- **KEYCTL** → not shown for unprivileged containers; the wizard forces it on internally
- **APT CACHER PROXY, HTTP/HTTPS PROXY, HOST CA INHERITANCE** → **No / blank**, all three
- **CONTAINER TIMEZONE** → leave as offered; empty inherits the host's
- **CONTAINER PROTECTION** → **No** — a monitor rebuilds in minutes, the page-5 rule for skipping it
- **DEVICE NODE CREATION** → **No**, the default
- **MOUNT FILESYSTEMS** → leave **empty**
- **POST-INSTALL HOOK (HOST)** → leave **empty**
- **VERBOSE MODE** → **No**
- Review **CONFIRM SETTINGS**, then press **Create LXC**
- **Which storage pool?** (two radiolists — container, then template — shown only when more than one pool qualifies; this host's stock local/local-lvm split auto-selects silently) → **local-lvm** for the container, **local** for the template
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available"** (if it appears) → **Ignore** — numbered **2**, or **3** in the four-option variant — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

> [!INPUT] kuma-console-user | Uptime Kuma console username | | root

> [!SECRET] kuma-root | Uptime Kuma container root password
> Set at the wizard's **Set Root Password** prompt; logs into the container's **Console** in Proxmox as `root`.

A monitor that wanders to a new address after a power cut is worse than none — the static is the point.

### Start it at boot

- **Options → Start at boot** → **Yes** — select the container in the left tree; or from the node Shell, swapping `108` for the ID shown next to the container's name:

```bash
pct set 108 -onboot 1
```

> [!INPUT] kuma-ip | Uptime Kuma container IP | 192.168.1.57

> [!NOTE]
> This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief power blips never reach the container. Start-at-boot covers the longer outages that drain the battery and force a clean shutdown — exactly when you most want the monitor back.

### Create your admin account
The script prints the address when it finishes — `http://192.168.1.57:3001`. There are no default credentials.

1. At **"Which database would you like to use?"**, pick **SQLite** — described on the screen itself as "A simple database file, recommended for small-scale deployments" (the MariaDB alternative targets Docker installs).
2. On the **Create your admin account** form, leave the prefilled **Language** dropdown as is.
3. Fill in **Username**, **Password**, and **Repeat Password**.

> [!NOTE]
> This login will know about everything you run and send alerts on your behalf, so give it a strong password and store both in Vaultwarden.

> [!INPUT] kuma-user | Uptime Kuma admin username

> [!SECRET] kuma-password | Uptime Kuma admin password

> [!NOTE]
> For a second factor: **Settings → Security**, press the **2FA Settings** button, and **Enable 2FA** sits inside the dialog it opens — codes from an authenticator app.

## Watch everything you built

### Add a monitor per service
For each row below:

1. Click **Add New Monitor** (top left of the dashboard).
2. Set the **Monitor Type**, the **Friendly Name**, and the address.
3. Tick any option listed.
4. Press **Save**.

| Friendly Name | Monitor Type | URL | Options |
|---|---|---|---|
| Proxmox | HTTP(s) | `https://192.168.1.50:8006` | tick **Ignore TLS/SSL errors for HTTPS websites** — self-signed certificate |
| Home Assistant | HTTP(s) | `http://192.168.1.51:8123` | — |
| TrueNAS | HTTP(s) | `http://192.168.1.20` | — |
| Frigate | HTTP(s) | `https://192.168.1.52:8971` | tick **Ignore TLS/SSL errors for HTTPS websites** — self-signed |
| Nextcloud | HTTP(s) | `https://192.168.1.58` | tick **Ignore TLS/SSL errors for HTTPS websites** — self-signed on the direct address |
| Vaultwarden | HTTP(s) | `http://192.168.1.56:8000` | — |
| Homepage | HTTP(s) | `http://192.168.1.55:3000` | — |
| Nginx Proxy Manager | HTTP(s) | `http://192.168.1.54:81` | — |

AdGuard gets a different monitor type, because what the house depends on is port 53, not the dashboard:

| Friendly Name | Monitor Type | Hostname | Resolver Server(s) | Port |
|---|---|---|---|---|
| AdGuard DNS | DNS | `apple.com` | `192.168.1.53` | `53` |

> [!NOTE]
> The **Resolver Server(s)** field is the one that matters on the DNS monitor: it prefills a public resolver (`1.1.1.1`) and would happily pass with AdGuard dead. Frigate's `8971` is the authenticated UI port; `5000` is the internal one reserved for the Home Assistant integration. Nginx Proxy Manager is watched on its admin port `81`, because port `80` hits the proxy's public side, not its admin UI.

> [!INPUT] adguard-ip | AdGuard container IP | 192.168.1.53

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> The Frigate container sits behind the Proxmox firewall fence built on the Cameras & Frigate page. The `8971` monitor above rides the fence's LAN-open rule like any browser; on top of that the fence specifically admits Kuma's address (`.57`) to port `5000` and answers pings, so every monitor style works from here. If a Frigate check ever times out, confirm Kuma still holds `.57` before blaming Frigate.

> [!INPUT] nextcloud-ip | Nextcloud container IP | 192.168.1.58

> [!INPUT] vaultwarden-ip | Vaultwarden container IP | 192.168.1.56

> [!INPUT] homepage-ip | Homepage container IP | 192.168.1.55

> [!INPUT] proxy-ip | Nginx Proxy Manager container IP | 192.168.1.54

> [!NOTE]
> The rest of the Add-monitor form is prefills — keep them all, except the one:
> - **Heartbeat Interval** → keep `60` seconds — every monitor here checks once a minute
> - **Retries** → defaults to `0`, meaning the first failed check marks the service down and alerts immediately — set **1 or 2**, so a momentary blip rides out in a pending state first; on a home network with one Wi-Fi doorbell and a 5 MP Wi-Fi camera, that small value cuts real noise
> - **Retry Interval** → appears once Retries is above 0 — keep `60`
> - **Request Timeout** → keep `48` seconds
> - **Resend Notification if Down X times consecutively** → keep `0` — alert once, not on repeat

> [!DETAILS] Choosing between Ping, TCP Port, and HTTP(s)
> The types form a ladder. **Ping** proves the machine answers on the network; **TCP Port** proves something is listening on a port; **HTTP(s)** proves the actual service responds properly — by default it accepts status codes 200–299 and follows up to 10 redirects. Prefer the highest rung a service offers: a frozen app can still answer pings. The type list goes well beyond these — keyword, JSON, push, and Docker checks — but these three plus the DNS type cover everything this collection built.

### Watch the cameras too
The Reolink Video Doorbell and the RLC-510WA are the two cameras on Wi-Fi — the likeliest to drop unnoticed, and a doorbell that stopped recording is exactly the kind of silent failure this dashboard exists to catch.

1. Add a **Ping** monitor for each — the doorbell, the RLC-510WA, and one per EmpireTech turret at its static IP.
2. Leave the Ping form's advanced prefills as they are — packet size `56`, a 2-second per-ping timeout, `3` pings per check.

> [!NOTE]
> Wired cameras drop far less, but a per-camera ping is what tells you *which* one died if footage goes missing. Ping fits here because the cameras speak RTSP (Real-Time Streaming Protocol) and http-flv into Frigate rather than serving a plain web page, so a successful ping is the cleanest "it is still on the network" signal.

> [!INPUT] doorbell-ip | Reolink doorbell IP | 192.168.1.70

> [!INPUT] camera-ip | Reolink RLC-510WA IP | 192.168.1.71

> [!TIP]
> A separate **HTTP(s)** monitor on Frigate (above) tells you the NVR (Network Video Recorder) software is alive; the per-camera Ping monitors tell you which *camera* dropped if footage goes missing. Together they point straight at the culprit instead of leaving you guessing.

### Give the family a status page
Your dashboard sits behind your login; a status page is the version everyone else in the household can check.

1. Open **Status Pages → New Status Page**, **Name** `Kuzco's House`, **Slug** `home` (the form shows the `/status/` prefix live; a taken slug errors with "The slug is already taken.").
2. In the editor that opens, attach each monitor with the **Add a monitor** selector.
3. Leave the editor's **Refresh Interval** at `300` seconds.
4. Press **Save**.

Then share the address: `http://192.168.1.57:3001/status/home`. Day to day, reach it remotely over Tailscale like everything else here — no port-forward.

> [!NOTE]
> Slugs accept lowercase letters, digits, and dashes — starting and ending alphanumeric, no doubled dashes. The slug `default` is special — `/status` with no slug points to it. Status pages lag the live dashboard slightly: the server caches them for five minutes, and each viewer's page re-fetches on the editor's Refresh Interval (the 300-second default). For "is it down, or is it just me", that is plenty.

### Give it a name behind the proxy
If the Reverse Proxy page's eight hosts went in as one sitting, `status.kuzco.org` already exists and forwards here — skip straight to the toggle below. Otherwise add it now in **Nginx Proxy Manager** (`http://192.168.1.54:81`) — **Hosts → Proxy Hosts → Add Proxy Host**:

- **Domain Names** → `status.kuzco.org`
- **Scheme** → `http`
- **Forward Hostname / IP** → `192.168.1.57`
- **Forward Port** → `3001`
- **Websockets Support** → **on**
- **SSL tab → SSL Certificate** → the `*.kuzco.org` wildcard, and **Force SSL** → **on**

Then, in the **Uptime Kuma UI** (`http://192.168.1.57:3001`), open **Settings → Reverse Proxy** and switch **Trust Proxy** (under **HTTP Headers**) to **on** — the one step unique to Kuma.

> [!NOTE]
> Without this, every visitor arriving through the proxy is logged and rate-limited as the proxy's own `.54` address; with it, Kuma believes the real client address the proxy forwards. This is the step the Reverse Proxy page's service-side table points here for.

> [!TIP]
> With names in play, one deliberate monitor earns its place: an **HTTP(s)** monitor pointed at a proxied name — `https://home.kuzco.org` is a good pick — which exercises the AdGuard rewrite, the proxy, and the certificate in a single check. Every *other* monitor stays on direct addresses on purpose, so an alert never leaves you guessing whether the service died or the proxy did.

## Keep it honest

### Make alerts find your phone
A red bar on a dashboard nobody has open is not an alert. Go to **Settings → Notifications**, click **Set Up Notification**:

- **Notification Type** → **ntfy** — the easy first one; install the ntfy app on your iPhone and subscribe to a topic
- **Friendly Name** → the auto-filled "My ntfy Alert (1)" is fine — it names the notifier in Kuma, not the message
- **ntfy Topic** → that same topic — make it long and random; on the default server, knowing the topic name *is* the access
- **Server URL** → keep the prefilled **`https://ntfy.sh`** — the phone app must subscribe to the topic on this same server
- **Priority** (and **Priority when down**) → keep the defaults
- **Authentication Method** → **None** — the random topic name is the access control here
- **Test** → sends one to the phone; prove it lands, then **Save**
- **Default enabled** → ticked
- **Apply on all existing monitors** → ticked

Every monitor — including ones you add later — now pushes straight to your pocket.

> [!DETAILS] Reaching you other ways
> The **Notification Type** list is long. The other well-worn options: **Telegram** (a bot you create that messages you directly), **Email (SMTP)** (sends through any mail account's SMTP (Simple Mail Transfer Protocol) server, with an **SMTP Security** option for TLS (Transport Layer Security)), and **Webhook** (an HTTP POST of the alert to any **Webhook URL** — the glue option for anything not on the list).

> [!DETAILS] Wiring alerts into Home Assistant
> Since HA already drives this house, you can route Kuma's alerts through it: choose the built-in **Home Assistant** notification type, give it the HA URL and a **Long-Lived Access Token**, and it calls a notify service (the name defaults to `notify`, and alerts arrive titled "Uptime Kuma") so they can fan out to the Nest speakers as spoken TTS (text-to-speech) announcements over Cast once the Voice — Siri & Local Assist page wires up TTS (a HomePod mini cannot be a target — Home Assistant cannot push audio to it). The reverse also exists — Home Assistant 2025.8 added an official **Uptime Kuma** core integration that polls this instance every 30 seconds and creates per-monitor sensors — but for plain "tell me when it breaks", ntfy or this notify path is enough. If you find older write-ups pointing at a HACS (Home Assistant Community Store) integration, skip it: that project was archived in August 2025 and its author recommends the core integration.

> [!WARNING]
> All of Kuma's notifiers push *outward* from the container — to an ntfy topic, the Telegram API (application programming interface), a mail server, a webhook, or Home Assistant. None of them needs an inbound port-forward into your network. Keep it that way; this build opens no ports, and remote access runs over Tailscale.

### Know the one thing it cannot see
One honest limit, baked into the architecture: Kuma runs on the very server it watches. If the whole i7-8700K dies — PSU (power supply unit) failure, kernel panic, someone trips over the cable — the monitor dies with everything it monitors, and no alert fires. There is no in-app cure — distributed monitoring is a long-standing feature request the maintainer has left deliberately unimplemented; one instance is the design.

For this LAN-only build with no port-forwards, the workaround that fits is a second Uptime Kuma on separate always-on hardware — a Raspberry Pi, say — running a single monitor pointed at this one at `http://192.168.1.57:3001`. The UPS and the NUT (Network UPS Tools) shutdown handling set up on the UPS & Safe Shutdown page cover the *power-blip* case, but only a second box catches a hard crash of the main server.

> [!WARNING]
> If you do run a second instance, it must have its own database — at most one Uptime Kuma per SQLite file. Two full installs, each watching the other; never two pointed at one data folder.

### Update on purpose, back up the one folder

1. Take a Proxmox snapshot first — the snapshot-before-changes habit from earlier.
2. From inside the container, open its **Console** in Proxmox.
3. Run:

```bash
update
```

> [!NOTE]
> This compares your installed version against the latest release, stops the service, lays the new version over `/opt/uptime-kuma` without touching your data, and starts it again.

> [!WARNING]
> Do not re-run the install one-liner on the Proxmox *host* to update — on the host, that command begins the create-a-new-container flow. Inside the container, the short `update` command — pre-installed by the script — is what updates in place.

Everything that matters — monitors, their history, notification settings, the SQLite database — lives in `/opt/uptime-kuma/data`. The Proxmox vzdump job set up on the next page (Proxmox Backups) will capture the whole container in one pass, so this monitor joins the same on-site backup routine as every other guest. (Those guest archives stay on the NAS; only the irreplaceable files dataset goes offsite to Backblaze B2, not the container backups.) If you ever copy that folder by hand, stop the service first (`systemctl stop uptime-kuma`) so the database file is consistent. The project's own migration guide repeats "backup your `data` directory" three times in a row — take the hint.
