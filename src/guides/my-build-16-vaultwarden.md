---
title: Vaultwarden
subtitle: The synced password vault, and the secret store this whole build runs on
collection: My Build
order: 16
accent: rose
---

Every page in this build has told you to put a value in your password manager — the Proxmox root password, the TrueNAS admin login, the camera and doorbell credentials, the MQTT (Message Queuing Telemetry Transport) users, the Backblaze encryption secrets. **Vaultwarden** is where all of that finally lives. It is a lightweight, fully compatible Bitwarden server, so the official Bitwarden apps and browser extensions on every iPhone, iPad, and Mac in this all-Apple household sync against this box instead of someone else's cloud. End-to-end encrypted, autofill everywhere, two-factor codes included — and the features Bitwarden sells as Premium work here, because Vaultwarden simply implements them with nothing to license. This is the synced secret store the rest of the build assumed all along.

> [!NOTE]
> One gate before anything else: the moment passwords move in, you become the household's backup department. The nightly Proxmox vzdump job to the TrueNAS share should already exist and have produced at least one archive you have actually seen — verify that first, not after. A vault with no proven backup is a single drive away from a household lockout.

> [!DETAILS] The honest alternative — not self-hosting this one
> Bitwarden's own cloud has a genuinely good free tier: unlimited passwords, unlimited devices, their ops team carrying the uptime and backup duty. Self-hosting trades that team for the backup discipline this build already runs, in exchange for keeping the most sensitive data in the house — which is the whole local-first point of this server. Both are defensible. If the gate above gave you pause, the cloud is the right answer until it doesn't.

## Create the container

### Run the install script
Vaultwarden is the last of the small service **LXCs (Linux Containers)** on this box, and like the others it goes up with the Proxmox community helper script. In the Proxmox web interface at `https://`-the-host-IP-`:8006`, click the node (the Maximus X Hero server) in the left tree, then click **Shell** — this runs on the Proxmox host itself, not inside a container or a VM (virtual machine). Paste this and press Return:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/vaultwarden.sh)"
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build.

### Choose Advanced and pin a static IP
When the script asks **Default or Advanced**, pick **Advanced**, and accept the generous defaults — 4 cores, 6 GB RAM, a 20 GB disk on unprivileged Debian. The one value to change is the network: set a **static IP** instead of DHCP (Dynamic Host Configuration Protocol). Then walk away. This script *compiles* Vaultwarden from source — it is a Rust program — announces "Building Vaultwarden (Patience)", and takes the better part of half an hour. It finishes by printing `https://<IP>:8000`.

> [!INPUT] vaultwarden-ip | Vaultwarden container IP | 192.168.1.56

> [!NOTE]
> The beefy defaults serve the compiler, not the vault — at rest, Vaultwarden idles in a few hundred megabytes. Leave the allocation alone anyway: the `update` command recompiles, and will want that headroom again.

> [!DETAILS] What the script builds
> A Rust toolchain plus a release build of the latest Vaultwarden into `/opt/vaultwarden/bin`, the prebuilt web vault into `/opt/vaultwarden/web-vault`, settings in `/opt/vaultwarden/.env`, your data in `/opt/vaultwarden/data`, all run by a systemd service named `vaultwarden` on port 8000. It starts with HTTPS already on, using a self-signed certificate — that is why the printed address says `https`, and why your browser will object once.

> [!DETAILS] How to pick a safe number
> Keep the first three octets identical to the rest of the LAN (matching the Proxmox host at `192.168.1.50`, AdGuard at `192.168.1.53`), and choose a final number **outside** the router's DHCP range so it can never be handed to another device. The `.56` used here just continues the run of service containers.

### Set it to start at boot
A password manager that does not survive a power cut is a household incident — you would be locked out of the very credentials needed to fix the server. Select the container in the left tree, open **Options**, and set **Start at boot** to Yes — or from the node Shell:

```bash
pct set 108 -onboot 1        # swap in the container's actual ID
```

> [!NOTE]
> This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief blips never reach the container. Start-at-boot covers the longer outages that drain the battery and force a clean shutdown.

## Give it its real address

### Hand the certificate job to the proxy
Vaultwarden's own wiki calls its built-in TLS (Transport Layer Security) "not recommended" and points at exactly what Nginx Proxy Manager already does on this build: terminate HTTPS with a real wildcard certificate. Two edits in the container's **Console** make the handover — tell Vaultwarden its public name, and stop it from doing its own self-signed HTTPS:

```bash
nano /opt/vaultwarden/.env
```

```ini
# /opt/vaultwarden/.env — add the DOMAIN line, delete any ROCKET_TLS line:
DOMAIN=https://vault.example.com
```

```bash
systemctl restart vaultwarden
```

> [!NOTE]
> `DOMAIN` is not cosmetic. Vaultwarden's configuration notes warn that if it does not match the address you browse to, "certain functionality might not work, like attachment downloads, email links and U2F" — U2F being security-key two-factor login. Set it once, correctly, before any accounts exist.

> [!DETAILS] Why deleting ROCKET_TLS is the right call
> With that line gone, Vaultwarden serves plain HTTP on port 8000 — which sounds like a downgrade until you see who is calling: only Nginx Proxy Manager, from inside the LAN (local area network), which re-wraps every byte in the real certificate before it reaches a browser. The side effect to know about: browsing straight to `http://192.168.1.56:8000` afterwards shows the login but cannot actually log in — the web vault's encryption needs the secure context only the proxied name provides. The name is the front door now.

### Add the proxy host
In Nginx Proxy Manager, go to **Hosts → Proxy Hosts → Add Proxy Host** — domain `vault.example.com`, Scheme `http`, forward to `192.168.1.56` port `8000`, **Websockets Support** on (Vaultwarden's live-sync notifications ride the same port and need the WebSocket headers passed through), then attach the wildcard certificate and turn on **Force SSL** on the SSL tab. AdGuard's DNS (Domain Name System) rewrite for the wildcard already resolves the new name on the LAN. Browse to `https://vault.example.com`: the web vault, with a padlock, no warnings.

## Make the household's accounts

### Create each account, and write the master password on paper
At `https://vault.example.com`, click **Create account** for yourself, then once per family member. The master password is the one password each person must actually remember — make it a long passphrase.

> [!WARNING]
> The master password is the single secret that does not go in any manager — not in the vault it protects, not in a browser, and not saved below; there is deliberately no field for it. Vaultwarden cannot reset it: encryption happens on your devices, and the server never sees the key. Write each master password on paper — an emergency sheet with the server address (`https://vault.example.com`), the account email, and the master password — and keep it where you keep passports. That sheet is also the answer to "what if something happens to me": the household can still reach what it needs.

### Close the doors behind you
Out of the box, anyone who can reach the page can register an account. On this LAN that is family — but a vault does not run on "probably fine". One more `.env` edit in the container's console, then restart:

```ini
# /opt/vaultwarden/.env — append:
SIGNUPS_ALLOWED=false
```

```bash
systemctl restart vaultwarden
```

Existing accounts are untouched; the Create account door is closed.

> [!DETAILS] Adding someone later, with signups closed
> Two routes. Easiest: reopen — flip the line to `true`, restart, register them, flip it back. More formal: the admin panel (next expandable) has an **Invite User** button that works even when registration is disabled; with no email server configured no invitation mail goes out, so the new person just registers themselves with the exact invited address. Registering everyone *before* closing signups stays the friction-free path.

> [!DETAILS] The admin panel, if you want it
> Vaultwarden ships a server-admin page at `/admin` — view and remove accounts, invite users, change settings from the browser. It is disabled until a token exists, and the install script left the token empty on purpose. To enable it, type `update` in the container's console and choose **Set Admin Token**: you type a passphrase, the script stores only an argon2 hash of it, and `https://vault.example.com/admin` starts accepting that passphrase. Treat it like the root password it is — and if you never need the panel, leave it off; an empty token *is* the off switch.
>
> > [!SECRET] vaultwarden-admin-token | Vaultwarden admin token
> > Only if you enabled the `/admin` panel — the passphrase you typed into Set Admin Token.

## Point every device at it

### Connect the apps and extensions
Install the official Bitwarden app from the App Store and the browser extension on each device. On the login screen, *before* signing in, open the **Logging in on** dropdown, choose **Self-hosted**, and enter `https://vault.example.com` as the Server URL. Then log in with the account's email and master password, import whatever the browser or old manager held, and turn on autofill. This is also the moment to move the build's credentials in for real — Proxmox, TrueNAS, the cameras and doorbell, the MQTT users, the Backblaze encryption password and salt.

> [!NOTE]
> Every signed-in device keeps a complete encrypted copy of the vault. Server down? The apps keep working in read-only mode — you can still look up the Proxmox root password to go fix the server holding it. The one rule: **lock, never log out.** Unlocking is local; logging back *in* needs the server.

> [!NOTE]
> Away from home, the vault syncs through the same Tailscale tunnel as everything else on this build — never a port-forward; a password server has no business being reachable from the internet. One wrinkle: `vault.example.com` only resolves where AdGuard answers DNS, so remote syncing needs the Tailscale-DNS wiring. Skip even that and nothing is lost day-to-day — the offline copies above carry you until you are home.

## Run it like a vault

### Make sure the backups already cover it
If the Proxmox guest-backup job runs in **Selection mode: All**, last night's vzdump already archived this container — data, settings, everything — to the TrueNAS share, and every night will. What actually matters lives in `/opt/vaultwarden/data`: the wiki ranks `db.sqlite3` and `attachments/` as required, `config.json` and the `rsa_key*` files as recommended (losing the keys just signs everyone out once). Restoring is the standard Proxmox drill: restore the container, the vault returns as of the backup. For *this* container, run that drill for real once, into a spare ID you delete afterwards — the vault is the one guest where "probably restorable" is not good enough.

### Export the vault, off the server
Add one layer the server cannot take down with it: from the web vault, go to **Tools → Export vault**, format **.json (Encrypted)** with a file password. Save the file onto the TrueNAS mirror, in with the irreplaceable files that the nightly Backblaze B2 Cloud Sync task pushes offsite — a vault whose only copies sit in one house is not finished. Repeat after big additions; the export is a snapshot, not a feed.

> [!WARNING]
> The encrypted-JSON export holds your logins and notes but **leaves out file attachments** — and Sends and trash with them. If you keep recovery-code images, scanned documents, or the like attached to vault items, that "complete copy" silently is not. To capture the attachments too, also take a **.zip export** (the export screen offers it), which packages the attached files alongside the data. Store the .zip beside the JSON on the NAS (network-attached storage), and treat it with the same care — it carries the unencrypted attachments inside.

### Give the watcher a watcher
Add one HTTP(s) monitor in Uptime Kuma, pointed at the direct address `http://192.168.1.56:8000` rather than the proxied name — the login may live behind the proxy, but the dot should not. If the vault ever stops answering, this is how you find out before a family member does.

### Update on purpose
Snapshot the container first (the standard habit before any change), then type `update` in the container's console — it recompiles the new release (patience, again) and leaves your data and settings alone. Vaultwarden's releases sometimes carry security fixes, so when the project says update, take it promptly.

### Put it on the front door
A tile on the Homepage dashboard makes a fitting last touch — `icon: vaultwarden.png`, `href: https://vault.example.com` — the vault, one click from the page the household already starts at, and the place every secret on this build now lives.
