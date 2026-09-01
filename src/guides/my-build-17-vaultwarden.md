---
title: Vaultwarden
subtitle: The synced password vault, and the secret store this whole build runs on
collection: My Build
order: 17
accent: rose
---

Every page in this build has told you to put a value in your password manager — the Proxmox root password, the TrueNAS admin login, the camera and doorbell credentials, the MQTT (MQ Telemetry Transport) users, the Backblaze encryption secrets. **Vaultwarden** is where all of that finally lives. It is a lightweight, fully compatible Bitwarden server, so the official Bitwarden apps and browser extensions on every iPhone, iPad, Mac, and the Windows PC in this household sync against this box instead of someone else's cloud. End-to-end encrypted, autofill everywhere, two-factor codes included — and the features Bitwarden sells as Premium work here, because Vaultwarden simply implements them with nothing to license. This is the synced secret store the rest of the build assumed all along.

> [!NOTE]
> One gate before anything else: the moment passwords move in, you become the household's backup department. The nightly Proxmox vzdump job to the TrueNAS share — set up later in this build, on the Proxmox Backups page — must be running and have produced at least one archive you have actually seen before you trust real credentials to this vault. If you have not reached that page yet, you can stand the container up now, but do not move secrets in until that backup job exists and has proven itself. A vault with no proven backup is a single drive away from a household lockout.

> [!DETAILS] The honest alternative — not self-hosting this one
> Bitwarden's own cloud has a genuinely good free tier: unlimited passwords, unlimited devices, their ops team carrying the uptime and backup duty. Self-hosting trades that team for the backup discipline this build already runs, in exchange for keeping the most sensitive data in the house — which is the whole local-first point of this server. Both are defensible. If the gate above gave you pause, the cloud is the right answer until it doesn't.

## Create the container

### Run the install script
Vaultwarden is one more of the small service **LXCs (Linux Containers)** on this box, and like the others it goes up with the Proxmox community helper script. In the Proxmox web interface at `https://`-the-host-IP-`:8006`, click the node (the Maximus X Hero server) in the left tree, then click **Shell** — this runs on the Proxmox host itself, not inside a container or a VM (virtual machine). Paste this and press Return:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/vaultwarden.sh)"
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build.

### Choose Advanced and pin a static IP
When the script asks **Default or Advanced**, pick **Advanced**. Every dialog it can show, in order, with this build's answer:

- **Choose the container OS** (a menu the script shows before anything else) → **debian** — the **alpine** entry is the fast prebuilt variant in the expandable below; every path and prefill on this page assumes Debian
- **DIAGNOSTICS** (this newer script engine's name for the telemetry consent; asked once per host, so normally already answered) → decline
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the generous prefills: **4 cores, 6 GB RAM, 20 GB disk** — they serve the compiler, not the vault
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.56/24`**, gateway **`192.168.1.1`** — never DHCP
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
- **CONTAINER PROTECTION** → **Yes** — the vault of every password in the house; the Options step after install becomes a verify
- **DEVICE NODE CREATION** → **No**, the default
- **MOUNT FILESYSTEMS** → leave **empty**
- **POST-INSTALL HOOK (HOST)** → leave **empty**
- **VERBOSE MODE** → **No**, then review **CONFIRM SETTINGS** and answer **Yes** to create
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available"** (if it appears) → **Ignore** — numbered **2**, or **3** in the four-option variant — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

> [!INPUT] vaultwarden-console-user | Vaultwarden console username | | root

> [!SECRET] vaultwarden-root | Vaultwarden container root password
> Set at the wizard's **Set Root Password** prompt; logs into the container's **Console** in Proxmox as `root`.

Then walk away. This script *compiles* Vaultwarden from source — it is a Rust program — announces "Building Vaultwarden (Patience)", and takes the better part of half an hour. It finishes by printing `https://192.168.1.56:8000`.

> [!INPUT] vaultwarden-ip | Vaultwarden container IP | 192.168.1.56

> [!NOTE]
> The beefy defaults serve the compiler, not the vault — at rest, Vaultwarden idles in a few hundred megabytes. Leave the allocation alone anyway: the `update` command recompiles, and will want that headroom again.

> [!DETAILS] What the script builds
> A Rust toolchain plus a release build of the latest Vaultwarden into `/opt/vaultwarden/bin`, the prebuilt web vault into `/opt/vaultwarden/web-vault`, settings in `/opt/vaultwarden/.env`, your data in `/opt/vaultwarden/data`, all run by a systemd service named `vaultwarden` on port 8000. It starts with HTTPS already on, using a self-signed certificate — that is why the printed address says `https`, and why your browser will object once.

> [!DETAILS] Why the half-hour wait — and the fast path you are skipping
> The **alpine** entry at the script's first menu (there is no separate script anymore — the one `vaultwarden.sh` carries both) installs Alpine's prebuilt package into a smaller container — 256 MB RAM, a 1 GB disk — in seconds, no compiler involved. The trade: versions arrive on Alpine's packaging schedule rather than straight from the project, and its paths differ from every `/opt/vaultwarden/...` path on this page (settings in `/etc/conf.d/vaultwarden`, data in `/var/lib/vaultwarden`). The i7-8700K with 32 GB is nowhere near starved, so the Debian compiled build is the documented mainline here — the half-hour compile is expected, not a fault.

> [!DETAILS] How to pick a safe number
> Keep the first three octets identical to the rest of the LAN (matching the Proxmox host at `192.168.1.50`, AdGuard at `192.168.1.53`), and choose a final number **outside** the router's DHCP range so it can never be handed to another device. The `.56` used here just continues the run of service containers.

### Confirm it is alive, then set it to start at boot
After the half-hour compile:

1. Browse to `https://192.168.1.56:8000` — the `https://` is load-bearing; plain `http://` fails outright until the proxy handover below.
2. Click through the self-signed certificate warning — expected; it is the install script's own certificate, replaced by a real one two steps from now.
3. The Bitwarden web vault login screen appears. **Stop there — do not create an account yet.** Accounts made before the proxy handover are born with the wrong links.
4. In the Proxmox left tree select the container, open **Options**, set **Start at boot** → **Yes**, and confirm **Protection** already shows **Yes** — the wizard answered it; tick it if it slipped.

> [!NOTE]
> `vault.example.com` does not work yet either, if the Reverse Proxy page's eight hosts went in as one sitting: that host forwards plain HTTP to a port currently answering HTTPS — a mismatch the handover below resolves. Check aliveness by the direct address only.

The same start-at-boot setting from the node Shell instead, if you prefer (`106` is this build's next free ID after Nextcloud's `105`; confirm against the left tree):

```bash
pct set 106 -onboot 1
```

> [!NOTE]
> A password manager that does not survive a power cut is a household incident — you would be locked out of the very credentials needed to fix the server. This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief blips never reach the container; start-at-boot covers the longer outages that drain the battery and force a clean shutdown.

## Give it its real address

### Hand the certificate job to the proxy
Vaultwarden's own wiki calls its built-in TLS (Transport Layer Security) "not recommended" and points at exactly what Nginx Proxy Manager already does on this build: terminate HTTPS with a real wildcard certificate. In the container's **Console**, open the settings file:

```bash
nano /opt/vaultwarden/.env
```

Add this line, and delete any `ROCKET_TLS` line — then save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`):

```ini
DOMAIN=https://vault.example.com
```

Restart:

```bash
systemctl restart vaultwarden
```

> [!NOTE]
> `DOMAIN` is not cosmetic. Vaultwarden's configuration notes warn that if it does not match the address you browse to, "certain functionality might not work, like attachment downloads, email links and U2F" — U2F being security-key two-factor login. Set it once, correctly, before any accounts exist.

> [!DETAILS] Why deleting ROCKET_TLS is the right call
> With that line gone, Vaultwarden serves plain HTTP on port 8000 — which sounds like a downgrade until you see who is calling: only Nginx Proxy Manager, from inside the LAN (local area network), which re-wraps every byte in the real certificate before it reaches a browser. The side effect to know about: browsing straight to `http://192.168.1.56:8000` afterwards shows the login but cannot actually log in — the web vault's encryption needs the secure context only the proxied name provides. The name is the front door now.

### Add the proxy host
In Nginx Proxy Manager, go to **Hosts → Proxy Hosts → Add Proxy Host**:

- **Domain Names** → `vault.example.com`
- **Scheme** → `http`
- **Forward Hostname / IP** → `192.168.1.56`
- **Forward Port** → `8000`
- **Websockets Support** → **on** — Vaultwarden's live-sync notifications ride the same port and need the WebSocket headers passed through
- **SSL tab → SSL Certificate** → the `*.example.com` wildcard, and **Force SSL** → **on**

AdGuard's DNS (Domain Name System) rewrite for the wildcard already resolves the new name on the LAN. Browse to `https://vault.example.com`: the web vault, with a padlock, no warnings.

## Make the household's accounts

### Create each account, and write the master password on paper
Once for each of you, at `https://vault.example.com` — **in a browser**, not in the Bitwarden apps (see the warning below):

1. Click **Create account** — the link under **"New to Bitwarden?"**.
2. **Email** — the real address, typed exactly: it is the account's *username*, entered at every login. No verification mail will ever arrive (this server cannot send mail), so a typo is accepted silently — and becomes the username.
3. **Name** — the person's name, as the apps will greet them.
4. **Master password**, twice — a long passphrase, and a **different one for each of you**; neither of you learns the other's. Keep the optional hint vague, or skip it.
5. Create the account, then log in once at the same address to see the empty vault.

> [!WARNING]
> Do not use the apps' own Create account flow: signup from the phone or desktop apps against Vaultwarden trips an open upstream bug — **"Error decoding JWT"**, `InvalidByte(0, 34)` ([vaultwarden #6592](https://github.com/dani-garcia/vaultwarden/issues/6592)). Accounts are born in the browser; the apps log into them afterwards.

> [!NOTE]
> The account this form creates exists only on your server — Bitwarden the company never learns of it, holds nothing of yours, and can never reset it. And it is one master password per *person*, not per device: yours unlocks your account on the iPhone, the Mac, and the browser extension alike, so the household ends up with exactly two — the single thing each person memorizes. The only *shared* passwords in this system are the items inside the `Kuzco's House` organization below, and that split is the safety net: if one of you ever forgets a master password, the other account still opens, and every shared item is still reachable from it.

> [!WARNING]
> The master password is the single secret that does not go in any manager — not in the vault it protects, not in a browser, and not saved below; there is deliberately no field for it. Vaultwarden cannot reset it: encryption happens on your devices, and the server never sees the key. Write each master password on paper — an emergency sheet with the server address (`https://vault.example.com`), the account email, and the master password — and keep it where you keep passports. That sheet is also the answer to "what if something happens to me": the household can still reach what it needs.

### Share the household's common logins with an Organization
Two separate vaults raise an immediate question: where do the *joint* logins live — streaming, Wi-Fi, utilities? Not duplicated into both vaults, where every password change has to be made twice. Bitwarden's mechanism is an **Organization**: a shared pool both accounts belong to, where an entry lives once and both people see, edit, and autofill it.

From **your** web vault, with both accounts now existing:

1. Click **+ New organization** — under the vault filter's organization heading. Name it `Kuzco's House` and create it; your account becomes its **Owner** automatically.
2. Click **Admin Console** at the bottom of the left sidebar, then **Members** in its navigation, then the **Invite member** button.
3. On the **Role** tab: the other account's email, role **Owner**.
4. On the **Collections** tab: the **Default collection** row, its permission set to **Manage collection**. **Save**.
5. Nobody accepts anything: with no mail server, the invite goes straight to accepted — the other person does nothing, and no notification appears anywhere.
6. Back on **Members**, the new member appears under the **Needs confirmation** tab: tick their row → **⋮ Options** → **Confirm selected**. Confirming hands their account the organization's key — until then, they see nothing shared.
7. Move each joint login in: tick the item's checkbox in the vault view → **Assign to collections** on the action bar → set **Move to organization** to `Kuzco's House` and pick its collection.

> [!NOTE]
> An organization is not an account of its own — nobody logs in "as" Kuzco's House; it is a shared space your two existing accounts belong to, free of Bitwarden's paid seat limits. Both of you are Owners on purpose: a household of equals, so the shared entries are never stranded behind one person's account — the role only governs managing the organization. **Admin Console** here is the organization's management area *inside the web vault*, unlocked by that Owner role; no relation to the server's `/admin` panel, which stays off. And in the invite dialog, the top Permission dropdown is only a default for collections added later — the per-row permission is what counts, and equals take the top one (the lesser ones are read-only or hide passwords).

> [!WARNING]
> A row lingering under **Invited** — bare email, no name — means no account with that exact email exists: the account step above was skipped, or the address differs by a letter. Do not register into a pending invite; that trips an upstream bug (**"Error decoding JWT"**, [vaultwarden #6049](https://github.com/dani-garcia/vaultwarden/issues/6049)). Instead **Remove** the invite (the row's **⋮** → Remove), create the account in a browser, then invite again — landing on an existing account, it accepts instantly.

The split that keeps it tidy: personal accounts, personal cards, anything one person uses → own vault. Anything the *house* uses → the organization. The build's infrastructure credentials can go either way — in the organization both of you can reach them, which is the better failure mode.

### Close the doors behind you
Out of the box, anyone who can reach the page can register an account. On this LAN that is family — but a vault does not run on "probably fine". In the container's console, open the settings file:

```bash
nano /opt/vaultwarden/.env
```

Append this line, then save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`):

```ini
SIGNUPS_ALLOWED=false
```

Then restart:

```bash
systemctl restart vaultwarden
```

Existing accounts are untouched; the Create account door is closed.

> [!DETAILS] Adding someone later, with signups closed
> Two routes. Easiest: reopen — flip the line to `true`, restart, register them, flip it back. More formal: the admin panel (next expandable) has an **Invite User** button that works even when registration is disabled; with no email server configured no invitation mail goes out, so the new person just registers themselves with the exact invited address. Registering everyone *before* closing signups stays the friction-free path.

> [!DETAILS] The admin panel — this build's answer is to leave it off
> Every job the panel does already has a home here: signups toggle via `.env`, member management via the Organization, server settings via `.env` — and an account removal, the rare leftover, justifies enabling the panel for ten minutes that day. Off means one less privileged login on the network and no `config.json` override risk. The mechanics, for that day:
> Vaultwarden ships a server-admin page at `/admin` — view and remove accounts, invite users, change settings from the browser. It is disabled until a token exists, and the install script left the token empty on purpose. To enable it, type `update` in the container's console and choose **Set Admin Token**: you type a passphrase, the script stores only an argon2 hash of it, and `https://vault.example.com/admin` starts accepting that passphrase. Treat it like the root password it is — and if you never need the panel, leave it off; an empty token *is* the off switch. One caution if you do enable it: the moment any setting is **saved in the panel**, Vaultwarden writes a `config.json` that **overrides the matching `.env` lines from then on** — including `SIGNUPS_ALLOWED` (the panel calls it **Allow new signups**, under General settings) and the push-relay lines. Pick one place to manage settings; on this build that place is `.env`.
>
> > [!SECRET] vaultwarden-admin-token | Vaultwarden admin token
> > Only if you enabled the `/admin` panel — the passphrase you typed into Set Admin Token.

## Point every device at it

### Connect the apps and extensions
On each device, install the official Bitwarden client from its official source:

- iPhones and iPads → the **Bitwarden** app from the App Store
- The Mac and the Windows PC → the **browser extension** from the browser's own store: Chrome Web Store, Firefox Add-ons, or Edge Add-ons
- Safari → the extension ships *inside* the Bitwarden desktop app from the Mac App Store: install that app, then turn the extension on in **Safari → Settings → Extensions**

Then, on each client's login screen:

1. *Before* signing in, open the **Logging in on** dropdown (the desktop apps label it **Accessing**) → **Self-hosted** → enter `https://vault.example.com` as the Server URL and save.
2. Log in with the account's email and master password.
3. Turn on autofill.

> [!WARNING]
> Skipping that dropdown is the classic first-login failure: the client asks Bitwarden's cloud — where your account does not exist — and rejects your perfectly correct password with a misleading **"Username or password is incorrect."** The server a login screen is about to use is shown right on it; make it yours before typing anything. Already typed into the wrong one? No harm done: Bitwarden clients never transmit the master password — only a one-way hash derived on your device (600,000 key-stretching rounds) goes over the wire, useless to anyone without brute-forcing the passphrase itself.

> [!NOTE]
> The extension is the piece you actually use on a computer: it autofills inside web pages, and it only offers a fill on the exact domain an item was saved with — a lookalike phishing domain gets silence instead of your password, protection copy-paste cannot give.

### Import what the browser already holds
Each account brings its existing passwords over once, from the web vault's **Tools → Import data** (the apps and extension offer the same screen):

1. Export the source to CSV first — Apple's Passwords app, Chrome, and Firefox all offer a CSV export in their password settings, as does any password manager.
2. **Vault** → **My vault** — personal logins stay personal; move any joint ones into `Kuzco's House` afterwards, with the same Assign-to-collections move as above.
3. **Folder** → leave unselected.
4. **File format** → the entry matching the source: **Safari and macOS (csv)** for Apple's export, **Chrome (csv)**, **Firefox (csv)**, or the old manager's own entry.
5. **Choose File** → the exported CSV → **Import**.
6. **Delete the CSV and empty the Trash** — that file is every password in plaintext, the most dangerous thing on the machine while it exists.

> [!NOTE]
> Importing before the backup gate is fine: an import *copies*, the browser keeps everything it had, and nothing becomes vault-exclusive. The gate below is about the build's infrastructure secrets, whose only home will be the vault.

Moving the build's real credentials in — Proxmox, TrueNAS, the cameras and doorbell, the MQTT users, the Backblaze encryption password and salt — waits for the backup gate at the top of this page; on a first pass through the build, come back and do it after the Proxmox Backups page has produced its first proven archive.

> [!NOTE]
> Every signed-in device keeps a complete encrypted copy of the vault. Server down? The apps keep working in read-only mode — reading, autofill, even TOTP codes, since the seeds live in the cached vault — so you can still look up the Proxmox root password to go fix the server holding it. The one rule: **lock, never log out.** Unlocking is local; logging back *in* needs the server.
>
> One setting can quietly break that rule for you: each app's **vault timeout action** (Settings → Account security) either **locks** after the timeout or **logs out**. It ships as Lock — confirm it in every app *and* every browser extension (each install has its own copy of the setting) and leave it there, because a device set to log out will do so on its own during an outage, exactly when it cannot get back in.

> [!NOTE]
> Away from home, the vault syncs through the same Tailscale tunnel as everything else on this build — never a port-forward; a password server has no business being reachable from the internet. One wrinkle: `vault.example.com` only resolves where AdGuard answers DNS, so remote syncing needs the Tailscale-DNS wiring covered on the Reverse Proxy page (AdGuard's LAN IP entered on the Tailscale admin console's DNS page). Skip even that and nothing is lost day-to-day — the offline copies above carry you until you are home.

> [!DETAILS] Instant sync between phones — the optional push relay
> By default the apps sync on login, periodically while unlocked, and on demand — fine for a household. If you want an edit on one iPhone to appear on another within seconds, Vaultwarden can use Bitwarden's push relay: request a free installation id and key at [bitwarden.com/host](https://bitwarden.com/host/), then add three lines to `/opt/vaultwarden/.env` in the container's console and restart:
>
> ```ini
> PUSH_ENABLED=true
> PUSH_INSTALLATION_ID=
> PUSH_INSTALLATION_KEY=
> ```
>
> > [!INPUT] vaultwarden-push-id | Push relay installation id
> > Only if you enable the relay — issued at bitwarden.com/host, tied to your email.
>
> > [!SECRET] vaultwarden-push-key | Push relay installation key
> > Issued alongside the id; both go into `/opt/vaultwarden/.env`.
>
> The honest trade: notification events now route through Bitwarden's servers (the vault contents stay end-to-end encrypted). The one documented downside — F-Droid app builds do not support it — is moot here, since the household's phones run the official App Store Bitwarden apps. Skipping the relay costs nothing but immediacy.

### Demote the tailnet's Apple login
The Remote Access page left a plan half-finished on purpose: the tailnet's break-glass **passkey admin** exists, but its passkey lives in iCloud Keychain — Apple custodies the secret even though it no longer owns the identity. Two facts shape the fix: a passkey cannot be copied between managers, and a Tailscale passkey account is tied to its single passkey forever (adding a second is an open request, [tailscale#15071](https://github.com/tailscale/tailscale/issues/15071)). So the move is a swap — retire the iCloud passkey user, mint its replacement with Bitwarden holding the key. On the Mac, in the browser with the **Bitwarden extension** installed and unlocked:

1. In Bitwarden, create a **New Login** item named `Tailscale`. **Username** — the passkey admin's email; **Password** and **Authenticator key** — blank (a passkey account has neither); under **Autofill options**, **Website** — `login.tailscale.com`. Save.
2. In the Tailscale admin console (signed in with the Apple ID), open **Users** and remove the old passkey user — the Personal plan's three-user cap has no seat for a second passkey admin, and removing it frees its email for reuse. The Apple-ID owner keeps the tailnet reachable throughout the swap.
3. Click **Invite users** → **Invite via link**, with the role set as high as offered — **Owner** if available, **Admin** otherwise; Admin covers every operation this build performs.
4. Open the invite link in that same browser and choose the passkey signup. At the passkey prompt, the **Bitwarden extension offers to save it** — save into the `Tailscale` item. If the Apple iCloud sheet appears instead, cancel and retry with the extension unlocked.
5. Sign out, then sign in to the admin console **once with the stored passkey** — untested custody is no custody.
6. Back on **Users**, confirm the new admin's role — and keep the Apple-ID user as the spare key, not the daily door: with the passkey holding equal or higher rank, an Apple lockout no longer reaches the tailnet.

## Run it like a vault

### Make sure the backups already cover it
Once the Proxmox guest-backup job (set up on the Proxmox Backups page, in **Selection mode: All**) is running, each night's vzdump archives this container — data, settings, everything — to the TrueNAS share. Restoring is the standard Proxmox drill: restore the container, the vault returns as of the backup. Two things to actually do:

- If that job is not in place yet, set it up **before** trusting real credentials to the vault.
- Run the restore drill for real once, into a spare container ID you delete afterwards — the vault is the one guest where "probably restorable" is not good enough.

> [!DETAILS] What inside the container actually matters
> Everything lives in `/opt/vaultwarden/data`: the wiki ranks `db.sqlite3` and `attachments/` as required, `config.json` and the `rsa_key*` files as recommended — losing the keys just signs everyone out once.

> [!DETAILS] A purist's database backup
> The wiki's gold-standard copy uses SQLite's own backup command, which is safe to run while the service is up:
>
> ```bash
> sqlite3 /opt/vaultwarden/data/db.sqlite3 ".backup '/root/vw-db-backup.sqlite3'"
> ```
>
> The nightly container archive makes this optional, but it earns its keep just before a risky change — run it right before an `update`, for instance. Restoring from it is the one direction that requires the `vaultwarden` service stopped first.

### Export the vault, off the server
Add one layer the server cannot take down with it. From the web vault, go to **Tools → Export**:

- **File format** → **.json (Encrypted)**
- **Export type** → **Password protected**. This is the one that decides whether the file is worth anything: it defaults to **Account restricted**, which can only be re-imported into the *same* account and is useless for disaster recovery
- **File password** → appears once Password protected is chosen; set one and record it in your password manager
- **Confirm vault export** → the final verification dialog, then the file downloads

Save the file onto the TrueNAS mirror, in with the irreplaceable files that the nightly Backblaze B2 Cloud Sync task pushes offsite — a vault whose only copies sit in one house is not finished. Repeat after big additions; the export is a snapshot, not a feed.

> [!WARNING]
> The encrypted-JSON export holds your logins and notes but **leaves out file attachments** — and Sends and trash with them. If you keep recovery-code images, scanned documents, or the like attached to vault items, that "complete copy" silently is not. To capture the attachments too, also take a **.zip export** (the export screen offers it), which packages the attached files alongside the data. Store the .zip beside the JSON on the NAS (network-attached storage), and treat it with the same care — it carries the unencrypted attachments inside.

### Give the watcher a watcher
When you build Uptime Kuma later in this build, give it an HTTP(s) monitor pointed at the direct address `http://192.168.1.56:8000` rather than the proxied name — the login may live behind the proxy, but the dot should not. If the vault ever stops answering, that is how you find out before a family member does.

### Update on purpose
1. Snapshot the container — the standard habit before any change.
2. Type `update` in the container's console and pick **1 Update VaultWarden + Web-Vault** — the same menu whose option 2 set the admin token.
3. Wait out the recompile (patience, again). Data and settings stay put; the bundled web vault refreshes to match.

Vaultwarden's releases sometimes carry security fixes — when the project says update, take it promptly.

### Put it on the front door
When you build the Homepage dashboard on the next page, its services config already carries the vault's tile — `icon: vaultwarden.png`, `href: https://vault.example.com` — the vault, one click from the page the household will start at, and the place every secret on this build now lives.
