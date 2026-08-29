---
title: Nextcloud
subtitle: Your own Google Drive and photo backup, pointed at the ZFS pool
collection: My Build
order: 16
accent: emerald
---

Nextcloud gives the household what Google Drive, Google Photos, and iCloud sell — file sync, automatic phone-photo backup, calendars, shared folders — except every byte stays on this box. The honest trade: Google's admins stop being your problem because *you* become the admin, which is why this page spends as much effort on backups and growth as on the install itself. It runs as one more unprivileged **LXC (Linux Container)** alongside AdGuard, the Nginx Proxy Manager, and the rest, and the big media archive ends up on the two-drive **ZFS (Zettabyte File System)** mirror that TrueNAS serves.

> [!DETAILS] Knowing what's under the hood
> A real Nextcloud install is a small stack, not one program: a web server with PHP, a proper database (MariaDB or PostgreSQL — SQLite is for testing only), and memory caching (APCu and Redis). The path below installs **NextCloudPi (NCP)**, a community appliance listed on nextcloud.com's own install page that assembles that whole stack on Debian and adds an admin panel for the chores — certificates, backups, updates. You manage one panel instead of five services, which suits a box that is already running a dozen other things.

## Create the container

### Run the install script
Open the Proxmox web interface at the host (log in as **root@pam**), click the node, then **Shell**, and run the community-scripts helper. Read it first — the same download-read-run habit the other containers on this build were created with:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/nextcloudpi.sh)"
```

On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once any of these pages saves defaults), pick **Advanced Install**. Every dialog it can show, in order, with this build's answer:

- **TELEMETRY & DIAGNOSTICS** (first community-script run only, and it appears **before** the menu) → decline — nothing in this build phones home
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login; a **Verify Root Password** box repeats a non-blank entry
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the prefills: **2 cores, 2 GB RAM, 8 GB disk**
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.58/24`**, gateway **`192.168.1.1`** — never DHCP
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
- **CONTAINER PROTECTION** → **Yes** — family data should not be deletable by a stray click; the Options step after install becomes a verify
- **DEVICE NODE CREATION** → **No**, the default
- **MOUNT FILESYSTEMS** → leave **empty**
- **POST-INSTALL HOOK (HOST)** → leave **empty**
- **VERBOSE MODE** → **No**, then review **CONFIRM SETTINGS** and press **Create LXC**
- **Which storage pool?** (two radiolists — container, then template — shown only when more than one pool qualifies; this host's stock local/local-lvm split auto-selects silently) → **local-lvm** for the container, **local** for the template
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available"** (if it appears) → **Ignore** — numbered **2**, or **3** in the four-option variant — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

> [!INPUT] nextcloud-console-user | Nextcloud console username | | root

> [!SECRET] nextcloud-root | Nextcloud container root password
> Set at the wizard's **Set Root Password** prompt; logs into the container's **Console** in Proxmox as `root`.

(At the time of writing NCP ships Nextcloud 33 on PHP 8.3 — a handy way to confirm the install landed on a current stack.)

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The node these containers live on. Reach the web UI at `https://`-this-ip-`:8006`.

> [!WARNING]
> Partway through, the script stops and asks permission: "This script will run an external installer from a third-party source," warning that the code is "NOT maintained or audited" by community-scripts, then waits at **Do you want to continue? [y/N]**. That source is the official NextCloudPi installer — the whole point of running this — so answer **y**; anything else aborts. Two scripts now want your read-first habit, and you cannot walk away expecting an unattended install.

> [!NOTE]
> The plain **Nextcloud** entry in the catalog is a TurnKey **VM**, not a container — the repo's two LXC options are this NextCloudPi one and a lighter Alpine variant. NCP is the relaxed household choice; take it.

### Start it at boot
Two things on the way past that look like problems and are not. The build report marks **IPv6 Internet Not Connected** with a red ✗ a couple of lines below its own **Disabled IPv6** ✓ — it is testing connectivity you deliberately turned off in the walk above, so ignore it. Then a **`Do you want to continue? [y/N]`** prompt appears under a warning that the script runs an external installer from a third-party source that the repo does not audit. **Answer `y`.** The wrapper only builds the LXC; Nextcloud itself is installed by NextcloudPi's own `install.sh`, and the URL printed above the prompt is `github.com/nextcloud/nextcloudpi` — **Nextcloud's own GitHub organisation**, not an unrelated third party. The warning is community-scripts being honest about the handoff, not a signal about the code.

The script finishes by printing the container's address as `http://192.168.1.58` — no port, no passwords yet; those come in the browser. The address was set statically in the Advanced walk (it is about to be baked into every device's sync client, so it must never move — nothing to reserve at the router). Before opening it, enable **Options → Start at boot** in Proxmox so the family cloud survives a power cut, and confirm **Options → Protection** already shows **Yes** — the wizard answered it; tick it if it slipped.

> [!INPUT] nextcloud-ip | Nextcloud container IP | 192.168.1.58

## First login

### Open the activation page
Browse to the printed address. Plain `http://` redirects to HTTPS, and the browser objects to the self-signed certificate — the same warning you clicked through for the Proxmox UI on port 8006. Proceed past it; in this browser you meet it exactly once more, at the panel's port 4443.

> [!NOTE]
> NCP's docs mention `https://nextcloudpi.local`, an mDNS name that may not resolve to this unprivileged container from another Mac. The IP always works, and lives on the container's **Network** tab if you lose it (Proxmox does not show an LXC's address on the Summary tab — only VMs with the guest agent get that).

### Save both passwords, then Activate
The activation page generates two random passwords for a user named **ncp** — one for the NCP admin panel on port 4443, one for Nextcloud itself — and shows them once. Save both below (the **Print** button captures them too), recording them in your password manager for now — you will consolidate these into Vaultwarden when you set it up later in this build. Then click **Activate**: the page flashes **ACTIVATION SUCCESSFUL** and opens `https://192.168.1.58:4443` **in a new tab** a few seconds later — if a pop-up blocker eats it, type the address yourself. Two prompts stand between you and the panel:

- the second self-signed **certificate warning** — proceed, as before
- a **browser login popup** titled **"ncp-web login"** — the browser's own gray Basic-auth dialog, not a web page. User **`ncp`**, password the **panel** password just saved

On the panel's first load, an overlay offers its own wizard — **"Click to start the configuration wizard"**, with **run** and **skip**:

- **skip** — its two working tabs solve problems this build does not have: **USB Configuration** wants to format a USB drive as the data disk (this is an LXC on the NVMe, and the archive rides External storage below), and **External access** wants router port-forwards and DDNS (Dynamic DNS), which this build forbids
- it shows only once; the wand icon in the panel's header reopens it if ever wanted

> [!INPUT] nextcloud-user | Nextcloud / NCP username | | ncp
> The same `ncp` user signs in to both — only the passwords differ.

> [!SECRET] ncp-panel-password | NCP admin panel password (port 4443)

> [!SECRET] nextcloud-password | Nextcloud password

> [!NOTE]
> Older write-ups call the Nextcloud user `admin`; current NCP uses **ncp** for both logins. Lose one and you can **reset** it via `sudo ncp-config` in the container's console — `nc-admin` sets a new password for the Nextcloud login, `nc-passwd` for the panel's. Neither shows a current password; nothing does.

> [!DETAILS] Getting to know the 4443 panel
> `https://192.168.1.58:4443` (login `ncp` plus the panel password) is where NCP keeps its admin tools, mirrored on the console as `sudo ncp-config`. It can run Let's Encrypt to get a real certificate if you ever give this box a public name — but this is a local-first household, so living with the self-signed warning is a legitimate choice. The router blocks unsolicited inbound traffic and nothing here needs a port-forward; don't create one. Remote access rides the Tailscale tunnel set up on the previous page.

### Sign in to Nextcloud itself
Back at `https://192.168.1.58/`, log in as **ncp** with the Nextcloud password. NCP already created the account and the stack behind it, so there is no setup to do — but two small first-login moments remain: you land on the **Dashboard**, not Files (**Files** sits one click away in the top bar), and a **welcome pop-up** offers the desktop and mobile client downloads — close it; the clients get installed properly later on this page. Every new account created below meets the same pop-up on its own first login.

> [!DETAILS] Fixing "Access through untrusted domain"
> Reach Nextcloud by any name or address it doesn't already know and it stops with that heading. It's a security check, not breakage: the `trusted_domains` setting in `config/config.php` lists the names and addresses this instance will answer to, and specifying them prevents host-header poisoning. From the container's console, list what it trusts, then add the new name at the next free index:
>
> ```bash
> cd /var/www/nextcloud
> sudo -E -u www-data php occ config:system:get trusted_domains
> sudo -E -u www-data php occ config:system:set trusted_domains 3 --value=cloud.example.com
> ```

## Point the storage at the ZFS pool

### Add accounts for the household
**Do not share the `ncp` login** — one account per person, so everyone gets their own files, photos, and password. Click your avatar (top right) → **Accounts** → **New account**, and fill the dialog:

- **Username** → the person's own login name
- **Password** → their own, never a shared one
- **Display name**, **Email**, **Groups**, **Quota**, **Language**, **Manager** → leave blank or default

Click **Add new account**, then repeat for the second person.

> [!NOTE]
> **Background, not a step — there is nothing for you to do on the Apps page here.** NCP arrives with the household set already switched on: Files, Activity, Photos, Calendar, Contacts, Notes, and Tasks all work at first login. The only app this build enables by hand is **External storage support**, and that happens further down this page at the step that needs it.

Record each one as you create it — these are the logins that go into the phone and desktop sync clients later on this page, and a household account whose password only exists in somebody's head is the one that gets reset at the worst moment:

> [!INPUT] nextcloud-user-1 | Household account 1 — username

> [!SECRET] nextcloud-password-1 | Household account 1 — password

> [!INPUT] nextcloud-user-2 | Household account 2 — username

> [!SECRET] nextcloud-password-2 | Household account 2 — password

> [!NOTE]
> These fields live on this device only, like every credential in this collection — they are a convenience while you follow along, not the household's password store. **Vaultwarden**, built on the next page, is where these belong permanently, and where the second person can actually reach their own copy. Move them there once it exists rather than leaving two people's logins recorded on one laptop.

### Decide where the bytes live
Everything uploaded lands in `/opt/ncdata/data` on the container's 8 GB root disk — fine to start, tiny against a camera roll across the whole household. There are two ways to give it room, and this build uses both:

- **Grow the container disk** for the app, database, and sync-critical data. This runs in the **Proxmox host shell** (`pve` node → **Shell**), not the container console:

  ```bash
  pct resize 105 rootfs +32G
  ```

  It prints the logical volume growing from 8 GiB to 40 GiB, then `resize2fs` extending the filesystem — **online, while the container runs**, so nothing needs stopping. Confirm:

  ```bash
  pct config 105 | grep -E 'rootfs|protection'
  ```

  Expect `protection: 1` in that output, and **no need to touch it** — verified on this build, `pct resize` runs fine on a protected container. That is worth stating because the Cameras page had to drop protection to add Frigate's mount point, which invites the assumption that every disk operation needs the same dance. It does not: the flag blocks **`pct set`** disk-config changes and container-or-disk **deletion**, while `pct resize` is permitted. Leave protection on.

  **Shrinking is not supported**, so add space in honest increments rather than one giant leap.

- **Park the heavy archive on the mirror.** The photo and media archive belongs on the two IronWolf drives in the ZFS mirror, where there is real room — reached through Nextcloud's **External Storage**, not by moving the data directory.

> [!WARNING]
> You cannot simply point Nextcloud's data directory at the TrueNAS share — NCP enforces that "Only ext/btrfs/zfs filesystems can hold the data directory," and an **SMB (Server Message Block)** mount is none of those. External Storage is the supported way to put files on the pool; the data directory stays on the container's local disk.

### Mount the TrueNAS share as External Storage
The TrueNAS VM already serves a `tank/files` SMB share, created with a dedicated SMB user.

> [!WARNING]
> **Install `php-smbclient` first — this one is not cosmetic.** The External storage page shows a red notice recommending it, and without the PHP module Nextcloud falls back to spawning the `smbclient` binary, a path that **fails on downloads larger than roughly 512 MB**. Since the entire point here is parking the photo and video archive on the mirror, that limit lands precisely on the files you most want, and it surfaces weeks later as "large videos will not download" — a symptom almost impossible to trace back to this page. In the container console:
>
> ```bash
> apt update && apt install -y smbclient php-smbclient
> ```
>
> ```bash
> reboot
> ```
>
> Do it **before** creating the mount below, so the row uses the module from the start.

Now hang the share inside Nextcloud:

1. Under **Apps**, find **External storage support** and click **Enable** — it ships with the server and is simply switched off. (Apps from the store read **Download and enable** instead, fetching and installing in the same click, so a few seconds' pause on those is normal rather than a fault.)

   > [!WARNING]
   > **If the Apps page loads as a blank white screen, raise PHP's memory limit.** NextcloudPi ships `memory_limit = 128M`, and the Apps page is the only one that downloads and parses the whole app-store catalog — it lands around **126.5 MB**, so it dies just short of the ceiling with no error in the browser. The Nextcloud log names it exactly (`Allowed memory size … exhausted at lib/private/App/AppStore/Fetcher/Fetcher.php`), and note the store being *reachable* is what triggers it, so connectivity tests come back clean and mislead you. Nextcloud's own recommendation is 512 MB. In the container console:
   >
   > ```bash
   > sed -i 's/^memory_limit = .*/memory_limit = 512M/' /etc/php/*/fpm/php.ini
   > ```
   >
   > ```bash
   > reboot
   > ```
   >
   > You can also skip the page entirely — this one app enables from the console, which is the faster route if you would rather not stop:
   >
   > ```bash
   > sudo -E -u www-data php occ app:enable files_external
   > ```
2. Go to **Administration settings → External storage**.
3. Fill the new row, every field:
   - **Folder name** → `Pool` — the folder name everyone sees in their Files
   - **External storage** (the backend dropdown) → **SMB/CIFS**
   - **Authentication** → **Username and password**
   - **Host** → **`192.168.1.20`** — the TrueNAS VM
   - **Share** → **`files`** — its own field, separate from Host
   - **Remote subfolder** and **Domain** → blank
   - **Username / Password** → the existing SMB credentials, per the share
   - **Available for** → leave empty — empty means everyone
4. Save the row (the checkmark at its right). A **green dot** at the row's left edge means the mount works; red or yellow means Nextcloud could not connect — recheck host, share, and credentials.

> [!DETAILS] The five setup warnings on Administration → Overview
> A fresh NCP shows a short list under *Security & setup warnings*. Only one earns a command:
>
> - **Maintenance window start** → set it. Heavy nightly jobs otherwise run during the day. The value is a **UTC hour**, so `5` puts them at 1 a.m. US Eastern: `sudo -E -u www-data php occ config:system:set maintenance_window_start --type=integer --value=5`
> - **Errors in the log** → expect two, from background jobs left registered by the **disabled** `app_api` and `updatenotification` apps. Log noise, nothing broken.
> - **Second factor configuration** → an informational ℹ, not a warning. On a household cloud reachable only across your own tailnet, enforcing 2FA is friction for little gain; leave it unless you want it.
> - **Default phone region** → cosmetic. It only affects validating phone numbers typed without a country code.
> - **PHP Imagick module** → cosmetic. It only affects favicon generation for the theming app.

The share appears as a folder in everyone's files. Photo archives and media sit on the ZFS pool with all its space and its snapshots, while the documents and photos people want everywhere keep syncing from the local disk.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!INPUT] smb-user | SMB share username
> The same household SMB user the `files` share already uses — reuse it; don't mint a new one.

> [!SECRET] smb-password | SMB share password

> [!DETAILS] SMB share or Nextcloud sync — which to use?
> You now have two ways at your files and they complement rather than compete. The raw SMB share is a **live network drive** — ideal for Macs at home (or over the tunnel), heavyweight files, and anything you open in place. Nextcloud is **sync** — copies that follow you onto phones and laptops and keep working offline. The common split: big media and archives live on the SMB share, the documents and photos you want everywhere live in Nextcloud — and via External Storage above, both sit on the same ZFS pool.

## Make it yours

### Put it on every device
Get the desktop client from [nextcloud.com/install](https://nextcloud.com/install/) — the macOS app for the Macs and the Windows app for the PC, since both get used equally here — and the mobile app from the App Store. The desktop wizard asks for the server address (the same URL you type into the browser), opens the browser to log in, and after **Grant access** syncs into a local **Nextcloud** folder. The Google-Photos replacement is **Auto upload** in the iOS app: point it at the camera roll and every photo lands on your server from then on.

> [!NOTE]
> Each new device raises the same self-signed-certificate objection the browser did. On a LAN-only box, accepting it per device is the usual compromise; the clean fix is the panel's Let's Encrypt tool plus a public name, which this build deliberately skips.

> [!WARNING]
> Away from home, reach Nextcloud over the Tailscale tunnel — never a router port-forward. A personal cloud full of the household's files and photos is exactly what you don't expose to the public internet.

## Keep it healthy

### Back up all five pieces at once
Nextcloud's docs list five things a backup must retain: the config folder, custom apps, the data folder, the theme folder, and the database — and insist on a fresh backup before every upgrade. Here all five live inside one container, so the Proxmox vzdump job (set up later in this build, on the Proxmox Backups page) will capture the lot in one pass, pointed at the `tank/backups` dataset on TrueNAS — storage that is not this same disk. That archive is the on-site, fast-restore tier; the off-property Backblaze B2 push is reserved for the irreplaceable files, not the guest archives.

> [!NOTE]
> The External Storage archive lives on the ZFS pool, so it is protected by the pool's own snapshots and the weekly scrub — not by the vzdump job, which only sees the container's local disk. That's the right split: the small, sync-critical data rides vzdump; the bulk archive rides the pool's protections. Photos you can't lose belong on the irreplaceable dataset that the Backblaze B2 push covers, so they also leave the property.

> [!DETAILS] Backing up by hand, the documented way
> Useful if you ever migrate off the container. From `/var/www/nextcloud` in the console: turn on maintenance mode (it locks logged-in sessions and blocks new logins so the database dump and folder copy stay consistent), dump the database, copy the folders, turn maintenance off.
>
> ```bash
> sudo -E -u www-data php occ maintenance:mode --on
> mariadb-dump --single-transaction -h localhost -u [user] -p[password] [db] > nextcloud-sqlbkp_$(date +"%Y%m%d").bak
> rsync -Aavx /var/www/nextcloud/ /somewhere-safe/nextcloud-dirbkp_$(date +"%Y%m%d")/
> sudo -E -u www-data php occ maintenance:mode --off
> ```
>
> Remember the data directory here is `/opt/ncdata/data`, outside the web root, so copy it too.

### Update on purpose, snapshot first
Take a Proxmox snapshot before any update — Nextcloud's own docs warn in a red box that "The built-in updater does not backup your database or data directory." Then keep two layers current: Debian inside the container with `apt update && apt -y upgrade`, and Nextcloud itself, whose version NCP manages through its own tooling on port 4443. Let NCP drive the Nextcloud upgrade — mixing updaters is how appliances and their apps fall out of step. Fold this into the monthly upkeep the Maintenance & Upkeep page sets up later in this build for every guest.
