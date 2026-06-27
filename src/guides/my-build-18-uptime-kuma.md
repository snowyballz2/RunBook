---
title: Uptime Kuma
subtitle: One dashboard that watches the whole rack and pings your phone when something dies
collection: My Build
order: 18
accent: violet
---

By now this box runs the things the household leans on every day: AdGuard answering DNS (Domain Name System) for every device, Nextcloud holding the photos, Frigate watching the cameras, Home Assistant driving the locks and leak valve, TrueNAS keeping the ZFS (Zettabyte File System) mirror, plus Vaultwarden, Homepage, and Nginx Proxy Manager. The only "monitoring" so far is someone in the house noticing a thing stopped working. **Uptime Kuma** is the smoke detector for the rack: it checks each service on a schedule, draws the results on one dashboard, and pushes an alert to your iPhone the moment something stops answering.

It is the lightest guest on the i7-8700K — a single Node.js application with an embedded SQLite database — so it fits in an unprivileged LXC (Linux Container) with 1 CPU core, 1 GB RAM, and a 4 GB disk. Crucially, it checks from *inside* the `192.168.1.x` LAN (local area network), which is exactly right: it sees every service the way your Apple devices on the couch do, and nothing here needs a single router port-forward.

> [!NOTE]
> Build this near the end of the collection, after the services it watches exist. It touches no hardware, so it belongs in an unprivileged container — the secure default on this Proxmox VE (Proxmox Virtual Environment) host.

## Create the container

### Run the install script
In the Proxmox web interface at `https://`-the-host-IP-`:8006`, click the node (the ASUS ROG Maximus X Hero server) in the left tree, then click **Shell** — this runs on the Proxmox host itself, not inside a container or a VM (virtual machine). Read the script first, then paste and press Return:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/uptimekuma.sh)"
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build. These community helper scripts are well regarded, but the habit stands regardless of source.

> [!DETAILS] What the script sets up
> It builds an **unprivileged** container on Debian 13, installs Node.js and Chromium, downloads the latest Uptime Kuma 2.x release into `/opt/uptime-kuma`, builds its production dependencies, and writes a systemd service named `uptime-kuma` that starts with the container and restarts itself if it crashes. It records the installed version in `/root/.uptime-kuma`, which the update command reads later. Port **3001** is Uptime Kuma's own default; the script leaves it alone.

> [!DETAILS] Prefer no scripts? Or Docker?
> You can build a plain unprivileged Debian container and install by hand from the project README, but on this build the native LXC above is the default — no Docker layer to manage, and updates are one command. The app is identical either way; this collection runs services as LXCs, not as containers-inside-a-VM.

### Pin a static IP and start it at boot
Two habits from earlier in the build. First, give it a **static IP** rather than DHCP (Dynamic Host Configuration Protocol) — set it during the script's Advanced prompts, or pin it with a reservation on the router. A monitor that wanders to a new address after a power cut is worse than none. Second, in the left tree select the container, open **Options**, and set **Start at boot** to Yes:

```bash
pct set 110 -onboot 1        # swap in the container's actual ID
```

> [!INPUT] kuma-ip | Uptime Kuma container IP | 192.168.1.57

> [!NOTE]
> This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief power blips never reach the container. Start-at-boot covers the longer outages that drain the battery and force a clean shutdown — exactly when you most want the monitor back.

### Create your admin account
The script prints the address when it finishes — `http://`-the-IP-`:3001`. There are no default credentials. The first visit asks which database to use; pick **SQLite**, the simple single-file choice that suits a home install. Then the **Create your admin account** form appears with **Username**, **Password**, and **Repeat Password**. This login will know about everything you run and send alerts on your behalf, so give it a strong password and store both in Vaultwarden.

> [!INPUT] kuma-user | Uptime Kuma admin username

> [!SECRET] kuma-password | Uptime Kuma admin password

> [!NOTE]
> For a second factor, the **Security** section of Settings has an **Enable 2FA** option using codes from an authenticator app.

## Watch everything you built

### Add a monitor per service
Click **Add New Monitor** (top left of the dashboard), pick a monitor type, name it, give it an address, save, repeat. Work down the rack — these are the guests this collection built:

- **Proxmox itself** — type **HTTP(s)**, URL `https://`-the-host-IP-`:8006`. The web UI's certificate is self-signed, so tick **Ignore TLS/SSL errors for HTTPS websites** — otherwise this monitor reports down from day one.
- **AdGuard** — what the house actually depends on is port 53, not the dashboard. A **DNS** monitor pointed at the AdGuard container's IP proves a real lookup resolves; add an **HTTP(s)** monitor for the dashboard at `http://`-the-AdGuard-IP as well.
- **Home Assistant** — type **HTTP(s)**, URL `http://`-the-HA-IP-`:8123`.
- **TrueNAS** — type **HTTP(s)**, at the address you use to reach its web UI; tick **Ignore TLS/SSL errors** if it serves HTTPS with a self-signed certificate.
- **Frigate** — type **HTTP(s)**, URL `http://`-the-Frigate-IP-`:8971` (the authenticated UI port — 5000 is the internal one reserved for the Home Assistant integration).
- **Nextcloud** — type **HTTP(s)**, at the Nextcloud LXC address; tick the toggle for its self-signed certificate.
- **Vaultwarden, Homepage, Nginx Proxy Manager** — one **HTTP(s)** monitor each, at their own LXC addresses.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> [!INPUT] adguard-ip | AdGuard container IP | 192.168.1.53
> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51
> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> [!INPUT] nextcloud-ip | Nextcloud container IP | 192.168.1.58

> [!NOTE]
> Each new monitor checks every 60 seconds, and **Retries** defaults to 0 — the first failed check marks the service down and alerts immediately. Setting Retries to 1 or 2 rides out a momentary blip before alerting; the monitor shows a pending state while it retries. On a home network with one Wi-Fi doorbell and a 5 MP Wi-Fi camera, a small retry value cuts down on noise from brief radio hiccups.

> [!DETAILS] Choosing between Ping, TCP Port, and HTTP(s)
> The types form a ladder. **Ping** proves the machine answers on the network; **TCP Port** proves something is listening on a port; **HTTP(s)** proves the actual service responds properly — by default it accepts status codes 200–299 and follows up to 10 redirects. Prefer the highest rung a service offers: a frozen app can still answer pings. The type list goes well beyond these — keyword, JSON, push, and Docker checks — but these three plus the DNS type cover everything this collection built.

### Watch the cameras too
The Reolink Video Doorbell and the RLC-510WA are the two devices most likely to drop off Wi-Fi unnoticed, and a doorbell that stopped recording is exactly the kind of silent failure this dashboard exists to catch. Add a **Ping** monitor for each at its camera IP — Ping is right here because the cameras speak RTSP (Real-Time Streaming Protocol) and http-flv into Frigate rather than serving a plain web page, so a successful ping is the cleanest "it is still on the network" signal.

> [!INPUT] doorbell-ip | Reolink doorbell IP | 192.168.1.70
> [!INPUT] camera-ip | Reolink RLC-510WA IP | 192.168.1.71

> [!TIP]
> A separate **HTTP(s)** monitor on Frigate (above) tells you the NVR (Network Video Recorder) software is alive; the per-camera Ping monitors tell you which *camera* dropped if footage goes missing. Together they point straight at the culprit instead of leaving you guessing.

### Give the family a status page
Your dashboard sits behind your login; a status page is the version everyone else in the all-Apple household can check. Open **Status Pages → New Status Page**, give it a **Name** and a **Slug**, add your monitors, and share the address: `http://`-the-Kuma-IP-`:3001/status/`-your-slug. Day to day, reach it remotely over Tailscale like everything else here — no port-forward.

> [!NOTE]
> Slugs accept lowercase letters, digits, and dashes. The slug `default` is special — `/status` with no slug points to it. Status pages refresh on a roughly five-minute cache, so they lag the live dashboard slightly; for "is it down, or is it just me", that is plenty.

## Keep it honest

### Make alerts find your phone
A red bar on a dashboard nobody has open is not an alert. Go to **Settings → Notifications**, click **Set Up Notification**, and pick a **Notification Type**. An easy first one is **ntfy**: install the ntfy app on your iPhone, subscribe to a topic, give Kuma that same **ntfy Topic**, and alerts push straight to your pocket. Tick **Default enabled** and **Apply on all existing monitors** so every monitor — including ones you add later — uses it.

> [!DETAILS] Wiring alerts into Home Assistant
> Since HA already drives this house, you can route Kuma's alerts through it: choose the built-in **Home Assistant** notification type, give it the HA URL and a **Long-Lived Access Token**, and it calls a notify service so alerts can fan out to the Nest speakers and HomePod mini as spoken TTS (text-to-speech) announcements over Cast. The reverse also exists — Home Assistant ships an official **Uptime Kuma** integration that polls this instance and creates per-monitor sensors — but for plain "tell me when it breaks", ntfy or this notify path is enough.

> [!WARNING]
> All of Kuma's notifiers push *outward* from the container — to an ntfy topic, the Telegram API (application programming interface), a mail server, a webhook, or Home Assistant. None of them needs an inbound port-forward into your network. Keep it that way; this build opens no ports, and remote access runs over Tailscale.

### Know the one thing it cannot see
One honest limit, baked into the architecture: Kuma runs on the very server it watches. If the whole i7-8700K dies — PSU (power supply unit) failure, kernel panic, someone trips over the cable — the monitor dies with everything it monitors, and no alert fires. There is no in-app cure; the maintainer's own words are that it is "not a distributed system."

For this LAN-only build with no port-forwards, the workaround that fits is a second Uptime Kuma on separate always-on hardware — a Raspberry Pi, say — running a single monitor pointed at this one at `http://`-the-Kuma-IP-`:3001`. The UPS and its NUT (Network UPS Tools) shutdown handling cover the *power-blip* case, but only a second box catches a hard crash of the main server.

> [!WARNING]
> If you do run a second instance, it must have its own database — at most one Uptime Kuma per SQLite file. Two full installs, each watching the other; never two pointed at one data folder.

### Update on purpose, back up the one folder
Take a Proxmox snapshot first — the snapshot-before-changes habit from earlier — then update **from inside the container**: open its **Console** in Proxmox and type `update`. It compares your installed version against the latest release, stops the service, lays the new version over `/opt/uptime-kuma` without touching your data, and starts it again.

> [!WARNING]
> Do not re-run the install one-liner on the Proxmox *host* to update — on the host, that command begins the create-a-new-container flow. The same command behaves differently by location: pasted inside the container, `update` updates in place. It is pre-installed for you.

Everything that matters — monitors, their history, notification settings, the SQLite database — lives in `/opt/uptime-kuma/data`. The Proxmox vzdump job that already backs this box up to the TrueNAS share (and onward to Backblaze B2) captures the whole container in one pass, so this monitor is covered by the same routine as everything else. If you ever copy that folder by hand, stop the service first (`systemctl stop uptime-kuma`) so the database file is consistent.
