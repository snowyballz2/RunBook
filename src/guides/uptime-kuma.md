---
title: Uptime Kuma
subtitle: Know when something dies before the family does
collection: Proxmox Home Server
order: 11
accent: azure
---

## What you are building

### Understand the job
This collection now runs the house's DNS, files, photos, cameras, and automations — and so far the only monitoring is someone shouting that a thing stopped working. Uptime Kuma is the smoke detector for the rack: it checks each service on a schedule, draws the results on one dashboard, and sends an alert the moment something stops answering.

> [!DETAILS] Knowing what's under the hood
> A single Node.js application with an embedded SQLite database — small enough that the container below gets by on 1 CPU core and 1 GB of RAM. The 2.x line is the stable one now (2.0 went stable in October 2025); a fresh install today gets 2.4.0. It checks from *inside* your network, which is exactly right: it sees your services the way your devices do.

## Create it

### Run the install script
In the Proxmox web interface, click your node, then **Shell**, and run the community-scripts helper — reading it first, the download-read-run habit from the *Install Proxmox* guide:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/uptimekuma.sh)"
```

Accept the defaults — an **unprivileged** container with **1 core, 1 GB RAM, and a 4 GB disk** on Debian 13. Monitoring is cheap; this is the lightest container in the collection.

> [!DETAILS] Prefer Docker instead?
> Upstream's primary documented install is Docker — one verbatim command from the project README, run on any Docker host (a Debian VM per the *Virtual machines* guide):
>
> ```bash
> docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:2
> ```
>
> The native LXC above stays this collection's default — no Docker layer to manage, and updates are one command. The app is identical either way.

> [!DETAILS] Knowing what the script sets up
> It installs Node.js 22 and Chromium, downloads the latest Uptime Kuma release (2.4.0 at the time of writing) into `/opt/uptime-kuma`, builds the production dependencies, and writes a systemd service named `uptime-kuma` that starts with the container and restarts itself if it crashes. It records the installed version in `/root/.uptime-kuma` — the update mechanism reads that later. Port **3001** is Uptime Kuma's own default; the script leaves it alone.

### Create your admin account
The script prints the address when it finishes — `http://<ip>:3001`. There are no default credentials: the first visit shows a **Create your admin account** form with **Username**, **Password**, and **Repeat Password**. This login will know about everything you run and send alerts on your behalf, so give it a strong password.

> [!INPUT] kuma-user | Uptime Kuma admin username

> [!SECRET] kuma-password | Uptime Kuma admin password

> [!NOTE]
> If you want a second factor on it, that exists too: the **Security** section of Settings has an **Enable 2FA** option, using codes from an authenticator app.

### Reserve its IP and start it at boot
Two habits from earlier guides: pin the container's IP with a DHCP reservation on your router (the *AdGuard Home* habit), and enable **Options → Start at boot** in Proxmox (the *Containers* habit). A monitor that vanishes after a power cut, or wanders to a new address, is worse than none — you'd trust a dashboard that isn't there.

> [!INPUT] kuma-ip | Uptime Kuma container IP

## Watch everything you built

### Add a monitor for everything you built
Create a monitor per service: click **Add New Monitor** (top left of the dashboard), pick a monitor type, name it, give it an address, save, repeat. Work down the rack:

- **Proxmox itself** — type **HTTP(s)**, URL `https://server-ip:8006`. The web UI's certificate is self-signed, so tick **Ignore TLS/SSL errors for HTTPS websites** — otherwise this monitor reports down from day one.
- ***AdGuard Home*** — what the house actually depends on is port 53, not the dashboard. A **TCP Port** monitor on `adguard-ip` port `53` proves the DNS listener answers; the **DNS** monitor type goes one better and checks that a real lookup resolves. Add an **HTTP(s)** monitor for the dashboard at `http://adguard-ip` as well.
- ***Nextcloud*** — type **HTTP(s)**, URL `https://nextcloud-ip`. Same self-signed certificate you accepted in the browser, same **Ignore TLS/SSL errors** toggle.
- ***Home Assistant OS*** — type **HTTP(s)**, URL `http://homeassistant-ip:8123`.
- ***TrueNAS*** — type **HTTP(s)**, at the address you use to reach its web UI. If yours serves HTTPS with a self-signed certificate, tick the toggle here too.
- ***Frigate*** — type **HTTP(s)**, URL `http://frigate-ip:5000`.

> [!NOTE]
> Each new monitor checks every 60 seconds, and **Retries** defaults to 0 — the first failed check marks the service down and sends a notification. Setting Retries to 1 or 2 (it retries every 60 seconds) rides out a momentary blip before alerting; the monitor shows a pending state while it retries.

> [!DETAILS] Choosing between Ping, TCP Port, and HTTP(s)
> The types form a ladder. **Ping** proves the machine answers on the network; **TCP Port** proves something is listening on a port; **HTTP(s)** proves the actual service responds properly — by default it accepts status codes 200-299 and follows up to 10 redirects. Prefer the highest rung a service offers: a frozen app can still answer pings. The type list goes well beyond these — keyword and JSON checks, push monitors, Docker containers, and more — but these three, plus the DNS type from the AdGuard bullet, cover everything this collection built.

### Give the family a status page
Your dashboard sits behind your login; a status page is the version everyone else can check. Open **Status Pages** → **New Status Page**, give it a **Name** and a **Slug**, add your monitors to it, and share the address: `http://<kuma-ip>:3001/status/<slug>`.

> [!NOTE]
> Slugs accept lowercase letters, digits, and dashes (no consecutive dashes). The slug `default` is special — `/status` with no slug points to it. And status pages refresh on a roughly five-minute cache, so they lag your live dashboard slightly; for "is it down or is it me", that's plenty.

## Keep it honest

### Make alerts find you
A red bar on a dashboard nobody has open is not an alert. Go to **Settings → Notifications**, click **Set Up Notification**, and pick a **Notification Type** — an easy first one is **ntfy**: the ntfy app on your phone subscribes to a topic, you give Kuma that same **ntfy Topic**, and alerts push straight to your pocket. Tick **Default enabled** and **Apply on all existing monitors** so every monitor — including the ones you add later — uses it.

> [!NOTE]
> All of Kuma's notifiers push *outward* from the container — to the Telegram API, your mail server, an ntfy topic, a webhook. Nothing here needs a port-forward into your network. Keep it that way.

> [!DETAILS] Reaching you other ways
> The **Notification Type** list is long. The other well-worn options: **Telegram** (a bot you create that messages you directly), **Email (SMTP)** (sends through any mail account's SMTP server, with an **SMTP Security** option for TLS), and **Webhook** (an HTTP POST of the alert to any **Webhook URL** — the glue option for anything not on the list).

> [!DETAILS] Wiring it into Home Assistant, both directions
> Two separate mechanisms, often confused. *Kuma pushing alerts to HA*: choose the built-in **Home Assistant** notification type, give it your HA URL and a **Long-Lived Access Token**, and it calls a notify service (the name defaults to `notify`) — alerts arrive titled "Uptime Kuma". *HA pulling Kuma's data in*: Home Assistant 2025.8 added an official **Uptime Kuma** core integration that polls your instance every 30 seconds using its URL and an API key, creating per-monitor sensors — status, response time, certificate expiry days, uptime percentages — plus an update entity for Kuma's own version. If you find older write-ups pointing at a HACS integration (HACS being the community store from the *Frigate* guide), skip it: that project was archived in August 2025 and its author recommends the core integration.

### Know what it cannot see
One honest limit, baked into the architecture: Kuma runs on the very server it watches. If the whole machine dies — power supply, kernel panic, someone trips over the cable — the monitor dies with everything it monitors, and no alert fires. This is a known open issue upstream with no in-app cure; the maintainer's own words are that it's "not a distributed system," and his recommendation is to monitor the monitor from somewhere else.

For a LAN-only build with no port-forwards (keep that habit), the workaround that fits is a second Uptime Kuma on separate hardware — a Raspberry Pi or any other always-on box — running one monitor pointed at this one: `http://kuma-ip:3001`. The maintainer's other suggestion, a free-tier external service, only works for things reachable from the internet, which nothing in this collection is.

> [!WARNING]
> If you do run a second instance, it must have its own database — at most one instance per SQLite file, per the maintainer. Two full installs, each watching the other; never two pointed at one data folder.

### Update on purpose, back up the one folder
Take a snapshot first — the snapshot habit from the *Containers* guide — then update **from inside the container**: open its **Console** in Proxmox and type `update`. It compares your installed version against the latest release, stops the service, lays the new version over `/opt/uptime-kuma` without touching your data, and starts it again.

> [!WARNING]
> Do not re-run the install one-liner on the Proxmox *host* to update — on the host, that command begins the create-a-new-container flow. The same command behaves differently by location: pasted inside the container, it updates in place. The `update` command is exactly that, pre-installed for you.

> [!DETAILS] Watching what the update actually does
> `update` re-checks Node.js 22 and Chromium, reads the version recorded in `/root/.uptime-kuma`, and skips cleanly if you're already current. Otherwise: stop the `uptime-kuma` service, fetch the new release tarball over the existing `/opt/uptime-kuma` (copied over, not wiped — which is why your data survives), reinstall dependencies, and restart.

Everything that matters — monitors, their history, notification settings, the SQLite database — lives in the data folder inside the install directory, `/opt/uptime-kuma/data`. The Proxmox backup job from the *Proxmox Backups* guide captures the whole container in one pass; if you ever copy that folder by hand, stop the service first (`systemctl stop uptime-kuma`) so the database file is consistent. The project's own migration guide repeats "backup your `data` directory" three times in a row. Take the hint.
