---
title: Vaultwarden
subtitle: The household password manager, on your own hardware
collection: Proxmox Home Server
order: 17
accent: azure
---

Every guide so far has said "put it in your password manager" — and so far that has quietly meant someone else's cloud. Vaultwarden ends that: a lightweight, fully compatible Bitwarden server, so the official Bitwarden apps and browser extensions on every phone and laptop sync against your box instead. End-to-end encrypted, autofill everywhere, 2FA codes included — and the features Bitwarden sells as Premium work here, because Vaultwarden simply implements them with nothing to license.

> [!NOTE]
> One gate before anything else: the moment passwords move in, you become the household's backup department. The *Proxmox Backups* job should already exist, point at separate hardware, and have produced at least one archive you've seen — verify that first, not after.

> [!DETAILS] The honest alternative — not self-hosting this one
> Bitwarden's own cloud has a genuinely good free tier: unlimited passwords, unlimited devices, their ops team carrying the uptime and backup duty. Self-hosting trades that team for the backup habits this collection built, in exchange for keeping the most sensitive data in the house. Both are defensible. If the gate above gave you pause, the cloud is the right answer until it doesn't — this guide is for when you want the keys.

## Put it up

### Run the install script
The usual move — Proxmox node, **Shell**, the download-read-run habit from the *Install Proxmox* guide:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/vaultwarden.sh)"
```

Pick **Advanced**, accept the defaults — 4 cores, 6 GB RAM, a 20 GB disk on unprivileged Debian 13 — and set a **static IP address**, say `192.168.1.56`. Then walk away: this script *compiles* Vaultwarden from source (it's a Rust program), announces "Building Vaultwarden (Patience)", and takes the better part of half an hour. It finishes with `https://<IP>:8000`.

> [!INPUT] vaultwarden-ip | Vaultwarden container IP | 192.168.1.56

> [!NOTE]
> The beefy defaults serve the compiler, not the vault — at rest, Vaultwarden idles in a few hundred megabytes. Leave the allocation alone anyway: the `update` command recompiles, and will want that headroom again.

> [!DETAILS] What the script builds
> Rust toolchain plus a `cargo build --release` of the latest Vaultwarden (1.36 at the time of writing) into `/opt/vaultwarden/bin`, the prebuilt web vault into `/opt/vaultwarden/web-vault`, settings in `/opt/vaultwarden/.env`, your data in `/opt/vaultwarden/data`, all run by a systemd service named `vaultwarden` on port 8000. It starts with HTTPS already on, using a self-signed certificate — that's why the printed address says `https`, and why your browser will object once, the familiar warning from the *Install Proxmox* guide.

> [!DETAILS] Skipping the compiler — the Alpine variant
> The catalog also carries `alpine-vaultwarden.sh` — an Alpine variant that installs a prebuilt package into a tiny 1-core, 256 MB, 1 GB container in seconds, no compiler involved. The trade: versions arrive on Alpine's packaging schedule rather than straight from the project, and the configuration paths differ from everything this guide describes. Tempting on starved hardware; the Debian build is the documented mainline here.

### Confirm it's alive, then make it permanent
Browse to `https://192.168.1.56:8000`, click through the certificate warning, and the Bitwarden web vault login appears — don't create an account yet; two steps from now it gets a proper address, and accounts made after that point are born with the right links. Meanwhile, the *Containers* habit: **Options → Start at boot**. A password manager that doesn't survive a power cut is a household incident.

## Give it its real address

### Hand the certificate job to the proxy
Vaultwarden's own wiki calls its built-in TLS "not recommended" and points at exactly what the *Reverse Proxy* guide built: a proxy terminating HTTPS with a real certificate. Two edits in the container's **Console** make the handover — tell Vaultwarden its public name, and stop it from doing its own (self-signed) HTTPS:

```bash
nano /opt/vaultwarden/.env
```

```ini
# /opt/vaultwarden/.env — add the DOMAIN line, delete the ROCKET_TLS line:
DOMAIN=https://vault.example.com
```

```bash
systemctl restart vaultwarden
```

> [!NOTE]
> `DOMAIN` is not cosmetic. Vaultwarden's own configuration notes warn that if it doesn't match the address you browse to, "certain functionality might not work, like attachment downloads, email links and U2F" — U2F being security-key two-factor login. Set it once, correctly, before any accounts exist.

> [!DETAILS] Why deleting ROCKET_TLS is the right call
> With that line gone, Vaultwarden serves plain HTTP on port 8000 — which sounds like a downgrade until you see who's calling: only the proxy, from inside your LAN (local area network), which re-wraps every byte in the real wildcard certificate before it reaches a browser. This is the wiki's recommended posture ("put vaultwarden behind a reverse proxy that handles HTTPS connections on behalf of vaultwarden"). The side effect to know about: browsing straight to `http://192.168.1.56:8000` afterwards shows the login but can't actually log in — the web vault's encryption needs the secure context only the proxied name provides. The name is the front door now; that's the point.

### Add the proxy host
The *Reverse Proxy* routine: in NPM (Nginx Proxy Manager), **Hosts → Proxy Hosts → Add Proxy Host** — domain `vault.example.com`, Scheme `http`, forward to `192.168.1.56` port `8000`, **Websockets Support** on (Vaultwarden's live-sync notifications ride the same port and need the WebSocket headers passed through), then the wildcard certificate and **Force SSL** on the SSL tab. The wildcard DNS (Domain Name System) rewrite already covers the new name. Browse to `https://vault.example.com`: the web vault, with a padlock, no warnings.

## Make the household's accounts

### Create each account, and write the master password on paper
At `https://vault.example.com`, click **Create account** for yourself, then once per family member. The master password is the one password each person must actually remember — make it a long passphrase.

> [!WARNING]
> The master password is the single secret that does not go in any manager — not in the vault it protects, not in a browser, and not saved below; there is deliberately no field for it. Vaultwarden cannot reset it: encryption happens on your devices, and the server never sees the key. Write each master password on paper — an "emergency sheet" with the server address (`https://vault.example.com`), the account email, and the master password — and keep it where you keep passports. That sheet is also the answer to "what if something happens to me": the household can still reach what it needs.

### Close the doors behind you
Out of the box, anyone who can reach the page can register an account. On your LAN that's family — but a vault doesn't run on "probably fine". One more `.env` edit in the container's console, then restart:

```ini
# /opt/vaultwarden/.env — append:
SIGNUPS_ALLOWED=false
```

```bash
systemctl restart vaultwarden
```

Existing accounts are untouched; the Create account door is closed.

> [!DETAILS] Adding someone later, with signups closed
> Two routes. Easiest: reopen — flip the line to `true`, restart, register them, flip it back. More formal: the admin panel (next expandable) has an **Invite User** button that works "even when registration has been disabled"; without an email server configured, no invitation mail goes out — the new person just registers themselves with the exact invited address. Registering everyone *before* closing signups stays the friction-free path.

> [!DETAILS] The admin panel, if you want it
> Vaultwarden ships a server-admin page at `/admin` — view and remove accounts, invite users, change settings from the browser. It's disabled until a token exists, and the install script left the token empty on purpose. To enable it, type `update` in the container's console and choose **Set Admin Token**: you type a passphrase, the script stores only an argon2 hash of it, and `https://vault.example.com/admin` starts accepting that passphrase. Treat it like the root password it is — and if you never need the panel, leave it off; an empty token *is* the off switch.
>
> > [!SECRET] vaultwarden-admin-token | Vaultwarden admin token
> > Only if you enabled the `/admin` panel — the passphrase you typed into Set Admin Token.

## Point every device at it

### Connect the apps and extensions
Install the official Bitwarden app (App Store / Play Store) and browser extension on each device. On the login screen, *before* signing in, open the **Logging in on** dropdown, choose **Self-hosted**, and enter `https://vault.example.com` as the Server URL. Then log in with the account's email and master password, import whatever the browser or old manager held, and turn on autofill.

> [!NOTE]
> Every signed-in device keeps a complete encrypted copy of the vault. Server down? Apps keep working in read-only mode — you can still look up the Proxmox root password to go fix the server holding it. The one rule: **lock, never log out.** Unlocking is local; logging back *in* needs the server.

> [!NOTE]
> Away from home, the vault syncs through the *Remote Access* guide's tunnel like everything else — never a port-forward; a password server has no business being reachable from the internet. One wrinkle: `vault.example.com` only resolves where AdGuard answers DNS, so remote syncing needs the *Reverse Proxy* guide's Tailscale-DNS wiring. And if you skip even that, nothing is lost day-to-day — the offline copies above carry you until you're home.

> [!DETAILS] Instant sync on phones — the optional push relay
> By default, mobile apps sync on login, periodically while unlocked, and on demand — fine for a household. If you want an edit on one phone to appear on another within seconds, Vaultwarden can use Bitwarden's push relay: request a free installation id and key at [bitwarden.com/host](https://bitwarden.com/host/), then add `PUSH_ENABLED=true`, `PUSH_INSTALLATION_ID=`, and `PUSH_INSTALLATION_KEY=` to `/opt/vaultwarden/.env` and restart. The honest trade: notification events now route through Bitwarden's servers (the vault contents stay end-to-end encrypted), and apps from F-Droid builds don't support it at all. Skipping it costs you nothing but immediacy.

## Run it like a vault

### Make sure the backups already cover it
If the *Proxmox Backups* job was set to **Selection mode: All**, last night's run already archived this container — data, settings, everything — to the NAS (network-attached storage), and every night will. What actually matters lives in `/opt/vaultwarden/data`: the wiki ranks `db.sqlite3` and `attachments/` as required, `config.json` and the `rsa_key*` files as recommended (losing the keys just signs everyone out once). Restoring is the *Proxmox Backups* drill: restore the container, vault returns as of the backup — and for *this* container, run that drill for real once, into a spare ID you delete afterwards. The vault is the one guest where "probably restorable" isn't good enough.

> [!DETAILS] A purist's database backup
> The wiki's gold-standard copy uses SQLite's own backup command, safe while the service runs:
>
> ```bash
> sqlite3 /opt/vaultwarden/data/db.sqlite3 ".backup '/root/vw-db-backup.sqlite3'"
> ```
>
> The nightly container archive makes this optional; it earns its keep just before risky changes. Restores are the one direction that requires the service stopped first.

### Export the vault, off the server
Add one layer the server can't take down with it: from the web vault, **Tools → Export vault**, format **.json (Encrypted)** with a file password. Save the file onto the NAS, in with the irreplaceable files that the *Protect TrueNAS Data* guide's Cloud Sync task pushes offsite nightly — a vault whose only copies sit in one house isn't finished. Repeat after big additions; the export is a snapshot, not a feed.

> [!WARNING]
> The encrypted-JSON export holds your logins and notes but **leaves out file attachments** — and Sends and trash with them. If you keep recovery-code images, scanned documents, or other files attached to vault items, that "complete copy" silently isn't. To capture the attachments too, also take a **.zip export** (the export screen offers it), which packages the attached files alongside the data. Store the .zip beside the JSON on the NAS, and treat it with the same care — it carries the unencrypted attachments inside.

### Give the watcher a watcher
One more HTTP(s) monitor in *Uptime Kuma*, at `http://192.168.1.56:8000` — the direct address, per the *Reverse Proxy* guide's advice for monitors. The login may live behind the proxy, but the dot should not.

### Update on purpose
Snapshot first (the *Containers* habit), then `update` in the container's console — it recompiles the new release (patience, again) and leaves your data and settings alone. Vaultwarden's releases sometimes carry security fixes, so when the project says update, take it promptly.

### Put it on the front door
A tile on the *Homepage* dashboard makes a fitting last touch — `icon: vaultwarden.png`, `href: https://vault.example.com` — the vault, one click from the page the family already starts at.
