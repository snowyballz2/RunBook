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
> Reach Nextcloud by any name or address it doesn't already know and it stops with that heading. It's a security check, not breakage: the `trusted_domains` setting lists the names and addresses this instance answers to, which prevents host-header poisoning. From the container's console, list what it trusts:
>
> ```bash
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:get trusted_domains
> ```
>
> Count the entries — the list indexes from **0**, and reusing a taken number silently **overwrites** that entry instead of adding. NCP ships roughly eight, so the next free index is usually **8**:
>
> ```bash
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:set trusted_domains 8 --value=cloud.example.com
> ```

## Point the storage at the ZFS pool

### Add accounts for the household
**First, turn off the demo content** — Nextcloud copies a *skeleton* folder into every new account's home on first login (Documents, Photos, Templates, a manual, an intro video: about 58 MB of it), plus a sample `leon.green@example.com` contact and calendar entries. Empty the skeleton before creating anyone, so nobody inherits it. In **Proxmox → 105 (nextcloudpi) → Console** — the container's own shell, where `occ` lives, not the `pve` node shell:

```bash
sudo -E -u www-data php /var/www/nextcloud/occ config:system:set skeletondirectory --value=""
```

Accounts that already exist keep what they were given — back in the browser at `https://cloud.example.com`, select those files in **Files** and delete them, and remove the sample contact in the **Contacts** app (the auto-generated *Contact birthdays* calendar entry goes with it).

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
> **Install the SMB module for NCP's pinned PHP — `php8.3-smbclient`, never the unversioned `php-smbclient`**, which targets the repo's default PHP instead of the **8.3** NCP actually runs (`systemctl list-units --type=service | grep fpm` confirms the version). Without the module, downloads over roughly 512 MB from the share fail. In the container console:
>
> ```bash
> apt update && apt install -y smbclient php8.3-smbclient
> ```
>
> ```bash
> systemctl restart php8.3-fpm
> ```
>
> Do it **before** creating the mount below. Proof: reload **Administration settings → External storage** and the red php-smbclient notice is gone.

Now hang the share inside Nextcloud:

1. First raise PHP's memory limit to Nextcloud's recommended **512 MB** — NCP ships 128 MB, too small for the Apps page you are about to open. In the container console:

   ```bash
   sed -i 's/^memory_limit = .*/memory_limit = 512M/' /etc/php/8.3/fpm/php.ini
   ```

   ```bash
   systemctl restart php8.3-fpm
   ```

   Then under **Apps**, find **External storage support** and click **Enable** — it ships with the server and is simply switched off. (Apps from the store read **Download and enable** instead, fetching and installing in the same click, so a few seconds' pause on those is normal rather than a fault.)
2. Go to **Administration settings → External storage**.
3. Click **Add external storage** — an **Add storage** dialog opens. Every field, top to bottom:
   - **Folder name** → `Pool` — the folder name everyone sees in their Files
   - **Mount options** (expand the collapsible):
     - **Check filesystem changes** → keep **Once every direct access** — the Macs and the PC write this same share directly over SMB, and this setting is what makes their changes appear in Nextcloud
     - **Read only** → **off** — the household adds files through Nextcloud too
     - **Enable previews** → **on**, as shipped — thumbnails for the photo archive
     - **Enable sharing** → **off**, as shipped — flip it later only if someone wants to share a Pool file by Nextcloud link
     - **Compatibility with Mac NFD encoding (slow)** → **off** — revisit only if accented filenames written from a Mac ever display mangled or duplicated
   - **Restrict to** → leave empty — empty means everyone
   - **External storage** (the backend dropdown) → **SMB/CIFS**
   - **Authentication** → **Login and password** — one admin-set login shared by every account, matching the single household SMB user; the "Log-in credentials" variants would reuse each person's Nextcloud password, which TrueNAS does not know
   - **Host** → **`192.168.1.20`** — the TrueNAS VM
   - **Share** → **`files`** — its own field, separate from Host
   - **Remote subfolder** and **Domain** → blank
   - **Show hidden files** → **off**, as shipped — on, every `.DS_Store` the Macs drop on the share surfaces in the family's Files view
   - **Case sensitive file system** → **off**, as shipped — the `files` dataset's SMB preset made it case-insensitive on the TrueNAS Storage page, and this matches it
   - **Verify ACL access when listing files** → **off**, as shipped — a per-file permission re-check built for shares with per-user denials; the single household SMB user has full access, so there is nothing to verify
   - **Login / Password** (at the bottom, under Authentication) → the existing SMB credentials, per the share
4. Click **Create**. A **green dot** at the new row's left edge means the mount works; red or yellow means Nextcloud could not connect — recheck host, share, and credentials.

### Settle the setup warnings
**Administration settings → Overview** greets every fresh NCP with the same five *Security & setup warnings* — standing furniture on this install, not a reaction to anything you did. One of them is a real step. Do it now, in the container console — it moves the heavy nightly background jobs to 1 a.m. Eastern (the value is a UTC hour):

```bash
sudo -E -u www-data php /var/www/nextcloud/occ config:system:set maintenance_window_start --type=integer --value=5
```

The other four are read-and-ignore:

- **Errors in the log** → two entries from background jobs of the disabled `app_api` and `updatenotification` apps — noise, nothing broken
- **Second factor configuration** → informational; on a tailnet-only household cloud, enforced 2FA is friction for little gain
- **Default phone region** → only affects validating phone numbers typed without a country code
- **PHP Imagick module** → only affects favicon generation for the theming app

The share appears as a folder in everyone's files. Photo archives and media sit on the ZFS pool with all its space and its snapshots, while the documents and photos people want everywhere keep syncing from the local disk.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!INPUT] smb-user | SMB share username
> The same household SMB user the `files` share already uses — reuse it; don't mint a new one.

> [!SECRET] smb-password | SMB share password

> [!DETAILS] SMB share or Nextcloud sync — which to use?
> You now have two ways at your files and they complement rather than compete. The raw SMB share is a **live network drive** — ideal for Macs at home (or over the tunnel), heavyweight files, and anything you open in place. Nextcloud is **sync** — copies that follow you onto phones and laptops and keep working offline. The common split: big media and archives live on the SMB share, the documents and photos you want everywhere live in Nextcloud — and via External Storage above, both sit on the same ZFS pool.

## Make it yours

### Put it on every device
**On each Mac and the Windows PC**, take the desktop client from [nextcloud.com/install](https://nextcloud.com/install/) — the macOS app for the Macs, the Windows app for the PC — then walk its first run:

1. **Sign in to Nextcloud in your browser first, as the household account you want this device to sync** — not `ncp`. The client adopts whatever account the browser is already logged in as, and re-doing it later means unpicking a wrongly-bound device.
2. **Server address** → **`https://cloud.example.com`** — the proxied name, on every device without exception. Never the raw `https://192.168.1.58`: it raises a certificate warning and stops working the moment the device leaves the house, while the name follows it over Tailscale.
3. **"Allow Nextcloud to find devices on local networks?"** (macOS) → **Allow** — the server is a local address, and denying this blocks the client with an error that looks nothing like a permissions problem.
4. **Grant access** in the browser tab it opens — check the *"Currently logged in as"* line names the right account before clicking. This issues the device its own app password, revocable later under **Settings → Security**.
5. It syncs into a local **Nextcloud** folder, and lives in the **menu bar** from then on — closing the window does not quit it, and re-opening the app shows nothing because it is still running. Click the menu-bar logo instead. On a notched MacBook that logo may never appear: macOS silently drops menu-bar icons that do not fit rather than collapsing them, so trim an item or two (or run an overflow manager) if it is missing. `killall Nextcloud && open -a Nextcloud` forces the window back meanwhile.

> [!WARNING]
> **Deselect `Pool` in the desktop client, or it syncs the whole archive onto the laptop.** The client treats an external storage mount like any other folder, so the terabytes on the ZFS mirror become a download queue against an SSD that cannot hold them. In the client's **Settings → the account → "Choose what to sync"**, untick **Pool**. The archive is meant to be reached through the browser or Finder on demand — the mirror is where it lives, not the laptop.

Prove the sync works while you are here: drop any file into `~/Nextcloud` on the Mac and reload `https://cloud.example.com` in the browser. Seeing it there confirms client, proxy and server all agree.

**On each iPhone**, install Nextcloud from the App Store, sign in at the same address, then turn on **Auto upload** and point it at the camera roll — that is the Google-Photos replacement, and every photo lands on your server from then on.

> [!NOTE]
> **Leave Auto upload on its default folder — do not point it at `Pool`.** Nextcloud is one file tree over two disks: most folders keep their bytes on the container's disk on the NVMe, while everything inside **Pool** lives on the 4 TB ZFS mirror. Pool is not a lesser tier — same UI, same apps — and photos ultimately belong there, on storage with snapshots, a weekly scrub and an offsite copy. But **the upload path into it is broken**: nextcloud/ios [#1788](https://github.com/nextcloud/ios/issues/1788) has been open since v4.1, and the failure is server-side, a parsing crash in the bundled SMB library (`Undefined array key "attributes"` in `files_external/3rdparty/icewind/smb/…/Parser.php`). Verified still unresolved as of this build.
>
> So run it in two tiers, deliberately:
>
> - **Auto upload** → the default local folder. This path is reliable.
> - **Deepen the buffer** so emptying it is rare — `pct set 105 -protection 0 && pct resize 105 rootfs +100G && pct set 105 -protection 1` from the node shell, affordable against the thin pool's free space (check with `pvesm status` first).
> - **Move batches into `Pool`** during the monthly pass — a drag in the browser, since both folders sit in the same tree.
>
> Photos are **not** unprotected while they wait: the nightly vzdump captures the whole container, so they are backed up from the first night. Moving them to Pool promotes them to the mirror's snapshots, scrub and offsite copy.
>
> Two quirks worth knowing. Files written to the share **directly over SMB** (Finder at `smb://192.168.1.20`) may not appear in Nextcloud until it notices them — `sudo -E -u www-data php /var/www/nextcloud/occ files:scan --all` in the container console forces the sweep. And on iOS 26 with app 7.2.2, [#3969](https://github.com/nextcloud/ios/issues/3969) reports Auto upload stamping modified dates a week in the future, which sorts photos oddly in timeline views; manual uploads are unaffected.

> [!WARNING]
> If the desktop client ever offers **"Connect without TLS"**, choose **Cancel** — that sends the password in the clear against a server that has a working certificate. Confirm the certificate independently from the Mac's Terminal, where a `200` or `302` means the chain is healthy and the client is the odd one out:
>
> ```bash
> curl -sSI https://cloud.example.com | head -1
> ```

> [!WARNING]
> **Remove the proxy's 2 GB upload cap.** NPM ships a global `client_max_body_size 2000m`, which fails any larger browser upload with a 413 (the sync clients chunk and never hit it). In **Nginx Proxy Manager** (`http://192.168.1.54:81`): edit the `cloud.example.com` proxy host → **Advanced** tab → paste the line below → **Save**.
>
> ```
> client_max_body_size 0;
> ```
>
> `0` removes the cap — fine on a LAN-only host behind Tailscale; PHP's own ceiling (the NCP panel's `nc-limits`) is the remaining one if a giant upload still stops. This is the only proxy host in the collection that needs an Advanced-tab line: the cap counts only *inbound* bodies, and Nextcloud is the one service pushing multi-gigabyte files in through a browser.

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
> sudo -E -u www-data php /var/www/nextcloud/occ maintenance:mode --on
> mariadb-dump --single-transaction -h localhost -u [user] -p[password] [db] > nextcloud-sqlbkp_$(date +"%Y%m%d").bak
> rsync -Aavx /var/www/nextcloud/ /somewhere-safe/nextcloud-dirbkp_$(date +"%Y%m%d")/
> sudo -E -u www-data php /var/www/nextcloud/occ maintenance:mode --off
> ```
>
> Remember the data directory here is `/opt/ncdata/data`, outside the web root, so copy it too.

### Update on purpose, snapshot first
Take a Proxmox snapshot before any update — Nextcloud's own docs warn in a red box that "The built-in updater does not backup your database or data directory." Then keep two layers current: Debian inside the container with `apt update && apt -y upgrade`, and Nextcloud itself, whose version NCP manages through its own tooling on port 4443. Let NCP drive the Nextcloud upgrade — mixing updaters is how appliances and their apps fall out of step. Fold this into the monthly upkeep the Maintenance & Upkeep page sets up later in this build for every guest.
