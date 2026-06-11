---
title: Nextcloud
subtitle: Your own Google Drive and photo backup, on hardware you control
collection: Proxmox Home Server
order: 10
accent: azure
---

## What you are building

### Understand the trade
Nextcloud gives your household what Google Drive, Google Photos, and iCloud sell — file sync, automatic phone photo backup, calendars, shared folders — except every byte stays on the server you built. The honest trade: Google's admins stop being your problem because *you* become the admin, which is why this guide spends as much time on backups and updates as on installing.

> [!DETAILS] Knowing what's under the hood
> A real Nextcloud install is a small stack, not one program: a web server with PHP, a proper database (the docs recommend MariaDB or PostgreSQL — SQLite is "only recommended for testing and minimal-instances"), and memory caching (the docs' recommended caches are APCu and Redis). The default path below installs **NextCloudPi (NCP)** — a long-running community appliance, listed on nextcloud.com's own install page, that assembles that stack on Debian and adds an admin panel for the chores: certificates, backups, updates. You manage one panel instead of five services.

## Create it

### Run the install script
In the Proxmox web interface, click your node, then **Shell**, and run the community-scripts helper — and read it first, the download-read-run habit from the *Install Proxmox* guide:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/nextcloudpi.sh)"
```

Accept the defaults — an **unprivileged** container with **2 cores, 2 GB RAM, and an 8 GB disk** on Debian 12 (at the time of writing NCP ships Nextcloud 33 on PHP 8.3).

> [!WARNING]
> Partway through, the script stops and asks permission: "This script will run an external installer from a third-party source", warning that the code is "NOT maintained or audited" by the community-scripts repository, then waits at **Do you want to continue? [y/N]**. That third-party source is the official NextCloudPi installer from the `nextcloud/nextcloudpi` repository — the whole point of running this script — so answer **y**; anything else aborts. It does mean two scripts deserve your read-first habit, and that you can't walk away expecting an unattended install.

> [!NOTE]
> If you go hunting the catalog for a plain "nextcloud" script, it doesn't exist — the community-scripts repo carries exactly two Nextcloud entries: this NextCloudPi one, and an Alpine variant covered in the last expandable below.

> [!DETAILS] Installing with no scripts at all — the TurnKey template
> Proxmox's own template catalog includes a TurnKey Nextcloud appliance, fully point-and-click: click a storage (e.g. **local**) → **CT Templates** → **Templates**, and download **debian-12-turnkey-nextcloud** (18.1-1) from the turnkeylinux section — or `pveam update && pveam available --section turnkeylinux` from the host shell. Build a container from it as in the *Containers* guide; first boot walks you through TurnKey's own initialization screens (root, database, and Nextcloud admin passwords) before Nextcloud appears. The trade-offs are real: it is still Debian-12-based while Debian 13 is current, the bundled Nextcloud version is frozen at image-build time and later upgrades are entirely your job, and Proxmox forum threads note TurnKey template releases have slowed. Choose it only if "no shell commands" matters more than freshness.

> [!DETAILS] Going fully official — Nextcloud AIO in a Docker VM
> Nextcloud AIO's README opens with "The official Nextcloud installation method", and nextcloud.com/install lists it first: a Docker image maintained by Nextcloud GmbH bundling the whole stack — Nextcloud, PostgreSQL, Redis and APCu caching, the high-performance push backend, Talk. You would run it in a Debian VM with Docker, then open `https://<vm-ip>:8080` to set up. The catch that keeps it out of this guide's mainline: **AIO requires exactly one domain with working HTTPS, even for LAN-only use** — there is no bare-IP, no-TLS mode, and its local-access docs call Tailscale "the recommended way" to satisfy that at home. If you already own a domain or are happy to adopt Tailscale, AIO is a first-class choice; if "browse to an IP and go" is the goal, NCP is the friendlier path.

> [!DETAILS] Squeezing into 1 GB — the Alpine variant
> The catalog's other entry, `alpine-nextcloud.sh`, builds plain Nextcloud from Alpine 3.23 packages in a 2-core, **1 GB RAM, 2 GB disk** container — the lightest footprint here, with costs to match: the admin login (`ncAdmin` plus a generated password) hides in `~/nextcloud.creds` inside the container, the certificate is self-signed for 365 days and renewed by hand, and the Nextcloud version is tied to Alpine's packaging — updates come from `apk upgrade` and the script's own menu, not Nextcloud's built-in updater. Fine for an experiment on starved hardware; not the relaxed household choice. (The catalog also carries `vm/nextcloud-vm.sh`, a heavier full-Debian-VM build, if a VM is your preference.)

### Reserve its IP and start it at boot
The script finishes by printing the container's address as `http://<IP>` — no port, and no passwords yet; those come in the browser. Before opening it, pin that IP with a DHCP reservation on your router (the *AdGuard Home* habit), because it is about to be baked into your bookmarks and every device's sync client. Then enable **Options → Start at boot** in Proxmox, the *Containers* guide habit, so the family cloud survives a power cut.

> [!INPUT] nextcloud-ip | Nextcloud container IP | 192.168.1.52

## First login

### Open the activation page
Browse to the printed address. Plain `http://` immediately redirects to HTTPS, and your browser objects to the self-signed certificate — the same warning you clicked through for Proxmox itself on port 8006. Proceed past it; you will meet it exactly once more.

> [!NOTE]
> NCP's docs mention `https://nextcloudpi.local` — an mDNS name that may not resolve to this unprivileged container from another machine. The IP always works, and lives on the container's **Summary** tab if you lose it.

### Save both passwords, then Activate
The activation page generates two random passwords for a user named **ncp** — one for the NCP admin panel on port 4443, one for Nextcloud itself — and shows them once. Save both below (or use the **Print** button / your password manager), then click **Activate**: the page opens `https://<IP>:4443` (the second certificate warning), landing you in the NCP panel.

> [!INPUT] nextcloud-user | Nextcloud / NCP username | | ncp
> The same `ncp` user signs in to both — only the passwords differ.

> [!SECRET] ncp-panel-password | NCP admin panel password (port 4443)

> [!SECRET] nextcloud-password | Nextcloud password

> [!NOTE]
> Older write-ups say the Nextcloud user is `admin`; current NCP uses **ncp** for both logins — only the passwords differ. If you lose one later, the upstream installer's own words apply: "You may review or reset them anytime by using nc-admin and nc-passwd" — both reachable via `sudo ncp-config` in the container's console.

> [!DETAILS] Getting to know the 4443 panel
> `https://<IP>:4443` (login `ncp` plus the panel password) is where NCP keeps its admin tools, mirrored on the console as `sudo ncp-config`. The one the upstream installer specifically advertises: "You can run letsencrypt to get rid of the warning if you have a (sub)domain available" — a real certificate, point-and-click, if you ever give this box a public name. For a LAN-only build, living with the self-signed warning is a legitimate choice for now — your router blocks unsolicited inbound traffic, and nothing here requires a port-forward. Don't create one.

### Sign in to Nextcloud itself
Back at `https://<IP>/`, log in as **ncp** with the *Nextcloud* password. There is no first-run wizard — NCP already created the account and the stack behind it — so you land straight in your files.

> [!DETAILS] Fixing "Access through untrusted domain"
> Reach Nextcloud by any name or address it doesn't know and it stops with exactly that heading, telling you to edit the `trusted_domains` setting in config/config.php. It's a security check ("Specifying trusted domains prevents host header poisoning"), not breakage. From the container's console, list what it currently trusts:
>
> ```bash
> cd /var/www/nextcloud
> sudo -E -u www-data php occ config:system:get trusted_domains
> ```
>
> Then add your new name at the next free index — if the list shows entries 0 through 2, the next is 3:
>
> ```bash
> sudo -E -u www-data php occ config:system:set trusted_domains 3 --value=cloud.example.com
> ```

## Make it yours

### Put it on every device
Get the desktop client from [nextcloud.com/install](https://nextcloud.com/install/) — Windows 10+ (64-bit), macOS 13+ (with an 11+ legacy build), Linux as an AppImage — and the mobile apps from the App Store, Google Play, or F-Droid. The desktop wizard asks for your server's address — per the manual, "the same URL that you type into your browser" — then opens the browser to log in; click **Grant access**, choose folders, and it syncs into a local **Nextcloud** folder by default.

> [!TIP]
> The Google-Photos replacement lives in the mobile apps: automatic upload of photos and videos — "instant upload", in the official page's words. On Android it's in the app menu as **Auto upload**; point it at your camera folder and every photo lands on your server from then on.

> [!NOTE]
> Expect each new device to raise the same self-signed-certificate objection your browser did. If that grates, the clean fix is the panel's Let's Encrypt tool plus a (sub)domain; on a LAN-only box, accepting the warning per device is the usual compromise — for now.

> [!WARNING]
> Away from home, reach it over a private tunnel — Tailscale or your own WireGuard — never a router port-forward. A personal cloud full of your files and photos is exactly the thing you don't want exposed to the public internet.

> [!DETAILS] SMB share or Nextcloud sync — which to use?
> If you built the *TrueNAS* guide you now have two ways at your files, and they complement rather than compete. An SMB share is a **live network drive** — ideal for computers at home (or over your tunnel), heavyweight files, and anything you open in place. Nextcloud is **sync** — copies that follow you onto phones and laptops and keep working offline. The common split: big media and archives live on SMB shares, while the documents and photos you want everywhere live in Nextcloud — and through the External Storage expandable later in this guide, both can sit on the same TrueNAS pool.

### Add accounts for the household
Don't share the `ncp` login. Click your avatar (top right) → **Accounts** → **New account**, enter an account name and password, and click **Add new account** — one per person, so everyone gets their own files, photos, and password.

> [!NOTE]
> Files, Activity, and Photos come enabled out of the box; Calendar, Contacts, Talk, Notes and friends wait on the Apps page behind an **Enable** button — "If the app is not part of the Nextcloud installation, it will be downloaded from the app store, installed and enabled." (The admin manual still calls the Accounts screen "User management" in places — same screen, older labels.)

## Keep it healthy

### Grow the disk before photos fill it
Everything your household uploads lands in `/opt/ncdata/data`, which sits on the container's 8 GB root disk — fine to start, small against a camera roll. Same move as the *Containers* guide promised: from the Proxmox host's shell,

```bash
pct resize <ctid> rootfs +32G
```

Growing works while the container runs; **shrinking is not supported**, so add space in honest increments rather than one giant leap.

> [!DETAILS] Putting the archive on bigger storage
> Two truths here. NCP's data-directory tool enforces that "Only ext/btrfs/zfs filesystems can hold the data directory" — so you cannot simply point the data directory at an SMB/NFS mount. But Nextcloud has a first-class middle path: **External Storage**. Enable the bundled **External Storage Support** app under **Apps** (it ships disabled), then go to **Settings → Administration → External Storage** and add a *TrueNAS* SMB share with its credentials. It appears as a folder in everyone's files — the heavy stuff (photo archive, media) lives on the ZFS pool with all its space, while the app, database, and sync-critical data stay on the container's local disk. Either way, keep TrueNAS in the *backup* role from the next step too.

### Back up all five pieces at once
Nextcloud's docs list five things a backup must retain: the config folder, custom apps, **the data folder, the theme folder, and the database** — and insist on "a fresh backup before every upgrade." Here all five live inside one container, so the Proxmox backup job from the *Proxmox Backups* guide — to storage that is not this machine — captures the lot in one pass.

> [!DETAILS] Backing up by hand, the documented way
> The docs' file-level recipe, useful if you ever migrate off the container: turn on maintenance mode (it "locks the sessions of logged-in users and prevents new logins in order to prevent inconsistencies of your data"), dump the database, copy the folders, turn maintenance off. From `/var/www/nextcloud` in the container's console:
>
> ```bash
> sudo -E -u www-data php occ maintenance:mode --on
> mariadb-dump --single-transaction -h localhost -u [username] -p[password] [db_name] > nextcloud-sqlbkp_$(date +"%Y%m%d").bak
> rsync -Aavx /var/www/nextcloud/ /somewhere-safe/nextcloud-dirbkp_$(date +"%Y%m%d")/
> sudo -E -u www-data php occ maintenance:mode --off
> ```
>
> That `mariadb-dump` line is the docs' MariaDB shape; remember the data directory here is `/opt/ncdata/data`, outside the web root, so copy it too.

### Update on purpose, snapshot first
Take a snapshot before any update — the snapshot habit from the *Containers* guide, backed by a red box in Nextcloud's own docs: "The built-in updater does not backup your database or data directory." Then keep two layers current: Debian inside the container with `apt update && apt -y upgrade` (exactly what re-running the install script's update path does), and Nextcloud itself, whose version NCP manages through its own tooling — the community script deliberately leaves that part to NCP.

> [!NOTE]
> On a plain Nextcloud install you would instead watch **Administration settings → Overview** for update notices and use the **Open updater** button in the Version section. On NCP, let NCP drive — mixing updaters is how appliances and their apps fall out of step.
