---
title: Remote Access
subtitle: Tailscale on the Proxmox host — reach the whole build from anywhere, no port-forwards
collection: My Build
order: 15
accent: azure
---

> [!NOTE]
> **This page is jumpable — early is allowed, and sometimes required.** Nothing here depends on the AdGuard or Reverse Proxy pages; it needs only the host shell and a Tailscale account. Once its routes are approved, every remaining *software* step of the build works from anywhere — config editors, Proxmox consoles, the router UI, all of it — exactly as from the couch. The one rule that cannot bend: **it must be done from the LAN**, because you cannot grant yourself remote access remotely. If time away is coming, do this page before leaving.


Everything you have built so far answers only at home: the Proxmox web UI, Home Assistant, TrueNAS, Frigate, the AdGuard LXC (Linux container), and the hostnames the Nginx Proxy Manager LXC serves — all of it lives on the `192.168.1.x` LAN (local area network) and stops at the front door. This guide fixes that for the entire build at once by putting **Tailscale on the Proxmox host** and turning that host into a *subnet router* for the whole home network. Every service you build on later pages — Nextcloud, Vaultwarden, Homepage, Uptime Kuma — becomes reachable the same way the moment it gets a LAN IP, with no extra remote-access setup per service.

The payoff fits this local-first household exactly: one mesh VPN (virtual private network), built from outbound connections only, with **no router port-forwards, ever.** Your network stays as closed to the internet as it is right now. Every guest stays on its normal LAN IP, and every one of them becomes reachable from your iPhone, MacBook, or HomePod-adjacent travels — through the single subnet route this host advertises.

> [!NOTE]
> This page assumes Proxmox VE (Proxmox Virtual Environment) is installed on the 500 GB NVMe (Non-Volatile Memory Express) drive, the i7-8700K server is on Ethernet through the Netgear GS308EPP switch with a static IP, and you can already log in to the web UI from a browser on the LAN.

> [!DETAILS] Why no ports get opened
> A port-forward is a router rule that sends anyone on the internet who knocks on a port straight to your server — a door held open to the whole internet, around the clock. Tailscale inverts that: every device makes only *outbound* connections and finds its peers with NAT (Network Address Translation) traversal, falling back to Tailscale's DERP relays only when a direct path is impossible. The result is that Proxmox and every guest behind it are reachable solely by devices signed in to your private tailnet, and the router's settings never change. Once the host is connected, `tailscale status` in the host shell lists each peer and whether the path to it is `direct` or `relayed` — your first check if remote access ever feels slow.

## Put the host on a tailnet

> [!NOTE]
> Before you start, know which identity this is: **your own Apple ID** — the build administrator's, the one already on your iPhone and MacBook. This house runs two personal Apple IDs, and the tailnet belongs to **yours**; do not create a new shared ID for it (a rarely-used Apple ID is a neglected account, the exact weakness being avoided here). The same identity signs in the host (in a browser on the MacBook, which may ask you to re-authenticate) and later your iPhone, so keep its password and a two-factor device within reach.
>
> The second phone in the house never signs in with your ID — it needs its own user with its own Apple ID. In the admin console's **Users** page:
>
> 1. Click **Invite external users**.
> 2. Pick the role **Member** inside the invite.
>
> An unaccepted invite expires after 30 days (the free Personal plan covers six users). Do this **while you are in the console anyway**: the Automations page's presence rules depend on it. A phone with no route to Home Assistant cannot report leaving, so its tracker freezes on "home" and *everybody-left* never fires — her membership is what makes her presence real when she is away.

### Create your Tailscale account
Tailscale calls your private network a *tailnet*; it is created the moment you first sign in. Go to [tailscale.com](https://tailscale.com/) and sign up — the Personal plan is $0, free forever. There is no Tailscale password to invent: you sign in with an identity you already own. For this household, **Apple** is the natural choice — it is the Apple ID your iPhones already use — but Google, Microsoft, GitHub, or a passkey work too.

> [!TIP]
> Pick the account you are most certain you will still control in five years; it *is* your Tailscale identity, and the same account goes on every device here. Signing in with one account everywhere is the whole trick — that is what puts the host, your iPhone, and your MacBook on the same network.

> [!NOTE]
> **Invites create logins, not devices** — the distinction that decides how many you send. A login covers every device that person signs in on, so your own machines never need one: the Proxmox host, your iPhone, and your MacBook all just sign in with *your* Apple ID and appear as separate machines under your single user.
>
> That leaves exactly **two invites for this build**, both sent with the same **Invite external users** button:
>
> - **The second phone in the house** — its own Apple ID, role **Member**, because a second *person* needs a second login
> - **The break-glass passkey admin** below — role **Admin**, which looks like an invite even though nobody else is involved, because it is a second login for you
>
> If you find yourself about to invite your own laptop, that is the sign to stop and just sign in on it instead.

> [!DETAILS] Why the second phone is a Member and not an Admin
> The two settings are independent, and the reason the household invite says *Member* is not that it grants less access. **Roles govern the admin console; ACLs govern the network.** This tailnet defines no ACL section, so Tailscale applies its default **allow-all** policy — meaning a Member and an Admin reach exactly the same things. Her phone can already open Proxmox, Home Assistant, TrueNAS and everything else on `192.168.1.0/24`, precisely as yours can. Admin would add nothing she uses.
>
> What Admin *does* add is the ability to change the tailnet itself: rewrite access policies, un-approve the subnet route that makes every remote address work, alter the DNS settings this build points at AdGuard, remove devices and users, touch billing. None of that is anything a second phone needs, and each is a way for a stray click — or a compromised Apple ID — to take the network down.
>
> The one honest argument for a second admin is bus factor: what happens if you are unreachable and something needs fixing. The **passkey admin** above already answers it, and answers it better — a second login *you* control, rather than standing privilege on somebody else's account. An admin who does not know Tailscale cannot fix an outage anyway, so walk her through the passkey login before a long trip instead.
>
> And if you ever want the reverse — her phone on the tailnet but unable to reach, say, Proxmox — that is an **ACL** edit, not a role change. Roles are the wrong lever for it.

### Add a break-glass passkey admin
Fair question to ask here: why should a third party's identity sit between you and your own network? Answer: Tailscale's **initial signup requires an identity provider** — passkey-only account creation does not exist yet — so the Apple ID bootstraps. But it does not have to stay a single point of failure, and Tailscale's own docs recommend the fix: a second **admin user that signs in with a passkey**, whose login *"has no dependency on an SSO identity provider."* If Apple ever locks the Apple ID, the tailnet still answers to you.

Do it now, while the console is open — Tailscale's *Admin account with passkey login* doc is the canonical walk:

1. In the **admin console**, open **Users**.
2. Click **Invite external users**.
3. Set the role to **Admin** inside the invite.
4. Click the **Copy invite link** tab.
5. Click **Generate & copy invite link** — rather than emailing it.
6. Open that link in a **private/incognito window** — Tailscale's docs say so explicitly, since a normal window binds the invite to whatever account is already signed in.
7. Choose to **sign up with a passkey**.
8. Pick the username deliberately: it becomes permanent as `<name>@passkey` and can never be reused, and the invite itself expires after 30 days unused.
9. Store its passkey with the same discipline as the Home Assistant backup key — the device keychain now, Vaultwarden when it exists later in the build.
10. Sign in with it **once** to prove it works — an untested break-glass login is a decoration.

There is deliberately **no password field below for the passkey itself** — a passkey has no secret string to record. Its private key is generated inside the device's secure hardware and never leaves; Tailscale only ever holds the public half. What does need recording is the username, because it is permanent and you will be typing it on your worst day:

> [!INPUT] tailscale-passkey-user | Tailscale passkey admin username | yourname@passkey
> Permanent and never reusable, even by you. This is the name you sign in with if the Apple ID is ever unavailable.

> [!INPUT] tailnet-name | Tailnet name (MagicDNS suffix) | tailnet-fe8c.ts.net
> Found on the admin console's [DNS page](https://login.tailscale.com/admin/dns), not the header. It is what fills the `<tailnet>` in `pve.<tailnet>.ts.net`.

> [!WARNING]
> **Do not let the passkey live only in iCloud Keychain.** The whole point of this admin is surviving a locked Apple ID — and a passkey held in that same Apple account is guarded by the very thing it insures against. Passkeys stay usable on devices already signed in, so this is thinning rather than fatal, but close the gap deliberately: **register the passkey on a second device as well** (the Mac's local keychain alongside the phone) so no single account lockout takes both, and treat the Vaultwarden migration below as required rather than optional.

This is stage one of a two-stage plan. Today the Apple ID does daily duty and the passkey is the backstop; **the Vaultwarden page later demotes the Apple login** once the passkey lives in self-hosted custody — sovereignty on a schedule, not a leap.

> [!NOTE]
> Scope honesty: this removes the identity-provider dependency, not Tailscale itself — their coordination server still introduces your devices to each other (self-hosting that means Headscale, which this build deliberately skips). Your WireGuard keys are end-to-end regardless; the coordination plane never holds them. One quirk worth knowing: a deleted tailnet is unrecoverable, and a passkey username can never be reused — even by you.

### Install Tailscale on the Proxmox host
Tailscale's documented path for Proxmox is to install directly on the host — Proxmox VE 9 is Debian 13 "Trixie" underneath, so the standard Debian packages are correct.

1. In the web UI, select the **pve** node.
2. Click **Shell**.

Run the block below — Tailscale's official Debian Trixie instructions with `sudo` removed, because this shell is already root:

```bash
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list
apt-get update
apt-get install tailscale
```

The first command adds Tailscale's signing key, the second its package repository, and then apt installs the signed package.

> [!NOTE]
> **If apt asks about `tailscale-archive-keyring.gpg`, answer `Y`.** The first `curl` above writes that keyring by hand, and the package ships its own copy of the same file — so dpkg stops and asks rather than overwriting something you appear to have edited. Both files are Tailscale's own repository signing key, so either answer installs correctly. **Y** (install the package maintainer's version) is the better one: it puts the file back under package management, so future Tailscale updates refresh the key silently instead of raising this prompt again every time. `D` shows the diff first if you want to see for yourself; `N` keeps your copy and works, at the cost of meeting this prompt again later.

> [!DETAILS] Why this method, and not the install script
> Note what those two `curl` commands do *not* do: execute anything. One downloads a signing key, the other a one-line repo definition (open the `.list` URL in a browser and read it — it is genuinely one line), and then apt installs a normally signed package. Nothing is piped into a root shell, which is why this is the default here.
>
> Tailscale also offers an official one-liner that detects the OS and does the same setup:
>
> ```bash
> curl -fsSL https://tailscale.com/install.sh | sh
> ```
>
> It works fine — but it is still a script piped into a root shell, so apply the download-read-run habit used elsewhere in this build: fetch it to a file, read it, then run it:
>
> ```bash
> curl -fsSL https://tailscale.com/install.sh -o tailscale-install.sh
> less tailscale-install.sh
> sh tailscale-install.sh
> ```

> [!DETAILS] Why the host, not a container or VM
> It is tempting to drop Tailscale into one of the service LXCs, but the host is the right home for it here. Install it on the host and remote access is up the moment the i7-8700K is — independent of whether any guest is running, and able to route to *all* of them at once. A container-bound install ties your only way in to one container that has to stay up, and on this build the host is what you most need to reach when something has gone wrong. (Frigate, Home Assistant OS, and TrueNAS each keep their own normal LAN IPs; the subnet route below reaches every one of them without installing Tailscale inside any of them.)

### Connect the host to your tailnet
In the same shell, bring Tailscale up:

```bash
tailscale up
```

The output prints a URL:

1. Open it in a browser on the Mac or the PC — the server has no desktop of its own.
2. Sign in with the account from the first step; the host joins your tailnet.
3. Back in the host shell, confirm it — the command prints the host's new `100.x` Tailscale address:

```bash
tailscale ip -4
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50

> [!INPUT] proxmox-user | Proxmox web UI username | | root

> [!SECRET] proxmox-root-password | Proxmox root password

> [!DETAILS] What the host just received
> Every tailnet device gets a stable address in the `100.x.y.z` range that stays the same no matter where the device physically moves. So the host now has two addresses: the `192.168.1.x` LAN IP you set during install, and a `100.x` address other tailnet devices reach from anywhere. The next phase extends that reach to every guest in the rack.

> [!INPUT] pve-tailscale-ip | Proxmox host tailnet IP (100.x) | 100.101.102.103
> Recording it here also fills the **Addressing Plan** view on the library screen, alongside the tailnet name and the admin console link.
> Worth recording because it is the one address that does **not** depend on the subnet route: everything else in this build reaches the server at `192.168.1.50` *through* that route, so if the route is ever un-approved or a key expires, this is what still gets you a shell to fix it. Not a secret and never truly lost — `tailscale ip -4` on the host prints it, and the Machines page shows it from any browser — just something better recorded than hunted for mid-problem. It changes only if the machine is deleted and re-added.

### Keep the host's own DNS out of the tailnet
One command now prevents a boot-order trap later. On the Reverse Proxy page, this tailnet's DNS page gets AdGuard entered as a forced global nameserver — and that override applies to every tailnet device, **including this host**. But AdGuard is a container *this host boots*: left on, the host's own lookups would route into a guest that does not exist yet during startup, or is down during any AdGuard outage — and `apt`, install scripts, and `update` commands on the host all go deaf exactly when you need them. Opt the host out; it is the one machine here that must keep resolving independently of its own guests:

```bash
tailscale set --accept-dns=false
```

Every phone and laptop keeps the override — that is what carries the `*.kuzco.org` names off-LAN — but the machine underneath them all keeps its boring, self-sufficient DNS.

### Stop the host's key from expiring
By default a tailnet device must re-authenticate every 180 days, and a server that silently drops off the network while you are travelling defeats the entire point.

On the [Machines page](https://login.tailscale.com/admin/machines) of the admin console:

1. Find the **pve** row.
2. Open the **…** menu at the far right.
3. Select **Disable Key Expiry**.

> [!WARNING]
> Tailscale recommends disabling key expiry on trusted servers and subnet routers — this host is about to be both. A subnet router whose key expires *stops routing*, cutting off every guest behind it. Your iPhone and MacBook can keep the 180-day default; re-authenticating there is a ten-second sign-in. Never run `tailscale up --force-reauth` over the Tailscale link itself — it can drop the connection mid-command, and then you are locked out until you are home.

## Route the whole LAN through the host

### Enable IP forwarding
Right now the tailnet reaches exactly one machine. A subnet router turns the host into a gateway that announces the entire `192.168.1.0/24` network, so every guest's normal LAN IP becomes reachable remotely — forward, advertise, approve. First, forwarding: a gateway has to pass packets between two networks, which Linux refuses to do until told. In the host shell:

```bash
echo 'net.ipv4.ip_forward = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
sysctl -p /etc/sysctl.d/99-tailscale.conf
```

> [!DETAILS] What those three lines do
> The first two write one kernel setting each — forward IPv4 packets, forward IPv6 packets — into a small config file under `/etc/sysctl.d/`, so the settings survive reboots. The third applies them immediately, no reboot needed. These are Tailscale's exact subnet-router commands, minus `sudo`.

### Advertise your home subnet
Still in the host shell, tell Tailscale which network the host can hand out — this build's LAN, `192.168.1.0/24`:

```bash
tailscale set --advertise-routes=192.168.1.0/24
```

> [!DETAILS] Why `set`, not `up`
> Prefer `tailscale set` over passing `--advertise-routes` to `tailscale up`: `tailscale up` expects you to re-specify *every* setting each time, an easy way to accidentally undo something, while `set` changes the one route.

> [!DETAILS] The "UDP GRO forwarding" warning that may appear
> On a kernel this new, Tailscale may print **"UDP GRO forwarding is suboptimally configured"** in `tailscale status` or its logs once routes are advertised. It is a throughput hint for the subnet-router path, not an error — phones and laptops reaching this build remotely will never notice. Tailscale's performance best-practices doc carries the fix (an `ethtool` setting on the interface that holds the default route, plus a small unit to persist it) — worth doing only if the tunnel ever moves serious data, like a large restore. Safe to ignore today.

### Approve the route in the admin console
Advertised routes do nothing until an admin — you — approves them, so a stray device can never quietly announce itself as a gateway.

1. Open the [Machines page](https://login.tailscale.com/admin/machines).
2. Select **pve** — its row now shows a **Subnets** badge.
3. In the **Subnets** section, select **Edit**.
4. Tick `192.168.1.0/24` under **Subnet routes**.
5. Click **Save**.

> [!NOTE]
> The household's other devices need nothing extra: macOS, iOS, tvOS, and Windows all pick up new subnet routes automatically. Only Linux clients opt in manually, with `tailscale set --accept-routes` — relevant only if you later run a Linux laptop on the tailnet.

## Prove it from your iPhone

### Put Tailscale on your phone
A phone on cellular data is the cleanest test: a device that is definitely not on your network, reaching addresses that should only exist on your network. Its first-run prompts, in order:

1. Install Tailscale from the App Store (iOS 15 or later).
2. Open it.
3. **Get Started**.
4. iOS asks permission to add a **VPN configuration** — accept; that is what switches the connection on.
5. Allow **notifications** — how a future re-authentication asks for you instead of silently dropping.
6. **Log in** with the same account you used for the host.

### Reach every service from anywhere
1. Turn off Wi-Fi so the phone is genuinely on cellular.
2. Confirm the Tailscale app shows connected.
3. Browse to each service on its normal LAN address — no Tailscale install needed on any of them, because the subnet route carries them all:

- **Proxmox** — `https://192.168.1.50:8006`. Expect the same self-signed certificate warning as on the LAN — **iOS Safari cannot reliably get past it**, so confirm with an **HTTP** service below instead, and reach Proxmox by its proxied name once DNS is set below.
- **Home Assistant** — `http://192.168.1.51:8123`.
- **TrueNAS** — `http://192.168.1.20`.
- **Frigate and AdGuard** — `https://192.168.1.52:8971` and `http://192.168.1.53`, exactly as on the couch.
- **Nginx Proxy Manager** — its admin UI at `http://192.168.1.54:81`.

> [!NOTE]
> **Proxmox's certificate warning is a known dead end on iOS Safari, not a sign anything is broken.** On recent versions the *Show Details → visit this website* control is simply unresponsive — a known bug rather than anything you are doing wrong. Do not burn time on it: the warning appearing at all already proves the test, since Safari had to reach the host and receive its certificate to show one (a broken route times out instead).

The `*.kuzco.org` hostnames Nginx Proxy Manager serves need one extra step now that the tailnet exists, because those names live only in AdGuard's DNS (Domain Name System):

1. On the admin console's [DNS page](https://login.tailscale.com/admin/dns), under **Global nameservers**, click **Add nameserver**.
2. Choose **Custom…** — every preset in that list (Google, Cloudflare, Quad9, Mullvad, NextDNS, Control D) is a public resolver, and you want your own.
3. Enter AdGuard's LAN IP, `192.168.1.53`.
4. Click **Save**.
5. Turn the **Override DNS servers** toggle **on** — it stays greyed until a nameserver exists.

After that, `https://proxmox.kuzco.org` and the rest work from anywhere too.

> [!DETAILS] What the override actually changed, followed one query at a time
> `proxmox.kuzco.org` does not exist on the internet — it is a rewrite living only inside AdGuard. At home that is invisible, because the router hands AdGuard out as the resolver. On cellular the phone uses the carrier's resolver, which has never heard of the name and never will.
>
> The two fields do different jobs. **Global nameservers** names *which* resolver tailnet devices use. **Override DNS servers** decides *when*: off, Tailscale handles only `.ts.net` names and defers everything else to the local network; on, the device ignores whatever resolver it was handed and sends **all** DNS to AdGuard.
>
> Follow one lookup from a phone on cellular:
>
> 1. Override sends the query to `192.168.1.53` rather than the carrier's resolver.
> 2. That address is private and unroutable across the internet — but it falls inside `192.168.1.0/24`, the subnet route approved earlier.
> 3. Tailscale carries the query through the tunnel to the Proxmox host.
> 4. The host forwards it onto the LAN to AdGuard.
> 5. AdGuard's rewrite answers `192.168.1.54` — Nginx Proxy Manager.
> 6. The answer returns the same way, and the phone connects to `.54` over that same route.
> 7. NPM reads the hostname, forwards to Proxmox on `8006`, and serves the Let's Encrypt certificate.
>
> **The subnet route and the DNS override are two halves of one mechanism** — the route makes private *addresses* reachable, the override makes private *names* resolvable, and neither is useful here without the other.
>
> Two consequences beyond the names working. **Ad blocking now follows the phone**: every query it makes goes through AdGuard, in any app, anywhere, not just lookups for your own domain. And **this is tailnet-wide**, so the second household phone resolves through your AdGuard too once it joins, its browsing appearing in your query log whenever its Tailscale is connected. In that log expect everything to read `192.168.1.50` — subnet routers masquerade by default, so tailnet traffic reaches the LAN wearing the Proxmox host's address, the same per-device blindness the router caused, arriving by a different road.

> [!WARNING]
> **Add exactly one nameserver here — do not pair AdGuard with a public resolver as a fallback.** Tailscale queries every global nameserver **in parallel and takes the fastest answer**, rather than trying them in order the way AdGuard's own upstream list does. Add `1.1.1.1` alongside AdGuard and the public resolver wins most races, so ads resolve and the filtering silently stops working — Tailscale's own documentation warns that multiple nameservers "can bypass explicit content restrictions if they aren't the same." The fallback instinct is right on the AdGuard page and wrong here, because the two behave differently.
>
> The cost of the single entry, stated plainly: with **Override DNS servers** on, a tailnet device's DNS depends on the house being up, so if the server is down while you are travelling, name resolution fails for everything rather than just for your own domains. Recovery is one tap — switch Tailscale off on the phone and it falls straight back to the carrier's resolver. If you would rather not carry that risk at all, the gentler alternative is **split DNS**: scope the nameserver to `kuzco.org` only, so AdGuard answers for your own names and everything else uses the phone's normal DNS. That trades away AdGuard's ad-blocking while you are away, which on iOS is the one place it is hardest to replace.

> [!DETAILS] If the phone reaches nothing — bisect before you change settings
> Three different failures look identical from the phone, and the iOS app's own toggles are a tempting wrong turn: **VPN On Demand** only decides whether iOS raises the tunnel automatically, and **Detect MagicDNS hostnames** only auto-connects for names ending in `.ts.net`. Neither affects reaching a raw `192.168.1.x` address, so leave both alone while diagnosing.
>
> One test separates all three. Still on cellular, browse to the **host's own `100.x` tailnet address** with its port — `https://100.x.y.z:8006`, the address recorded further up this page:
>
> - **The `100.x` address works, `192.168.1.x` does not** → Tailscale is healthy and the **subnet route** is the fault. Overwhelmingly the cause is a route advertised but never approved — nothing warns you, it simply drops traffic. Approve it on the [Machines page](https://login.tailscale.com/admin/machines) as described above, and confirm the **pve** row carries a **Subnets** badge (no badge means it is not advertising, so re-check the `sysctl` forwarding file and that `tailscale up` was re-run with `--advertise-routes=192.168.1.0/24`).
> - **Neither address works** → Tailscale itself is not connected. Confirm the app shows connected, and that the phone signed in with the **same account as the host** — signing in with a different identity silently creates a second, empty tailnet, which looks like a broken network rather than the wrong one.
> - **Both work** → nothing is wrong; you were testing while still on Wi-Fi.

> [!NOTE]
> **Works on cellular, fails on someone else's Wi-Fi?** Their network is almost certainly `192.168.1.x` too — the most common home range there is — and a network you are directly connected to always beats a Tailscale subnet route, so every `192.168.1.x` packet goes to their router instead of home. The tunnel itself is fine.
>
> 1. On the phone, open **Settings → Wi-Fi → (i)** next to that network and read its IP address — `192.168.1.something` confirms the collision.
> 2. Prove the tunnel is healthy by browsing to the host's tailnet address, `https://100.x.y.z:8006` (recorded further up this page).
> 3. Turn Wi-Fi off for the visit — cellular has no competing network, which is why it always works.
>
> The only complete fix is a home range nobody else uses, which is a renumbering of every page in this collection; the Start Here page's addressing plan names that trade-off. Until then, Wi-Fi off is the move.

Served to a phone nowhere near the house, through zero opened ports. Nextcloud, Vaultwarden, Homepage, and Uptime Kuma join this same list automatically as you build them in the pages ahead — no extra remote-access setup per service.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52

> [!NOTE]
> One honest limitation: every remote path runs through this single host. If the i7-8700K is powered off, crashed, or wedged mid-boot while you are away, remote access is down with it. Tailscale can fail over between two subnet routers, but that needs a second always-on machine; on a one-server build, a dead host means a trip home — or a housemate and the power button. The CyberPower UPS (uninterruptible power supply) and the NUT (Network UPS Tools) shutdown handling you will set up later in this build, on the UPS & Safe Shutdown page, cover the *power-blip* case, not a hard crash.

> [!DETAILS] MagicDNS and the day-to-day habit
> The [Machines page](https://login.tailscale.com/admin/machines) now lists both devices, and MagicDNS (on by default for new tailnets) gives each a name like `pve.<tailnet>.ts.net`, drawn from its hostname — so `https://pve.<tailnet>.ts.net:8006` also reaches the web UI.
>
> **Where `<tailnet>` comes from**, since it is not on the page you would expect: the admin console's **[DNS page](https://login.tailscale.com/admin/dns)**, the same one that later takes AdGuard as a global nameserver. A new personal tailnet is issued a generated name of the form **`tail<hex>.ts.net`** — something like `tailnet-fe8c.ts.net`.
>
> **Do not confuse it with the Tailnet ID**, which is a different value on a different page. **Settings → General** carries a *Unique IDs* card holding a **Tailnet ID**, described as identifying the tailnet *in API calls* — an opaque handle for scripting against Tailscale's API, which nothing in this collection does. Both look like hex; only the DNS-page one belongs in the field above or in a `pve.<tailnet>.ts.net` URL.
>
> That page also offers **Rename tailnet**, which trades the hex for a generated word pair like `cat-crocodile.ts.net`, and you can switch back and forth between the two. **Do it now if you are going to.** Renaming breaks every MagicDNS name, any Tailscale-issued HTTPS certificate, and any device-sharing link built on the old one — costless today because nothing depends on it yet, and not costless once `tailscale serve` or a Tailscale certificate is in play (a randomized name already used for certificates cannot be regenerated). For this build it is cosmetic either way, since the Reverse Proxy page gives every service a real `*.kuzco.org` name.
>
> Day to day, keep using the LAN IPs: thanks to the subnet route, they are the addresses that reach the host *and* every guest, both at home and away, with nothing to remember per service.

> [!DETAILS] Optional extras — exit node and a clean certificate
> Two add-ons, neither required and nothing later depends on them:
>
> - **Exit node** — run on the host:
>
>    ```bash
>    tailscale set --advertise-exit-node
>    ```
>
>    Approve it on the Machines page, like the subnet route. Selected on your iPhone, it routes *all* the phone's traffic through home — handy on hostile hotel Wi-Fi, off by default, separate from the subnet route. It is also the closest thing this build has to a consumer VPN; see below for how far that goes.
> - **Quiet the Proxmox certificate warning over Tailscale** — Tailscale Serve fronts the web UI with a valid certificate.
>
> 1. Run this in the host shell:
>
>    ```bash
>    tailscale serve --bg https+insecure://localhost:8006
>    ```
>
> 2. **If it refuses** with `Serve is not enabled on your tailnet`, follow the `login.tailscale.com/f/serve?node=…` link it prints, or enable **HTTPS Certificates → Enable HTTPS** on the [DNS page](https://login.tailscale.com/admin/dns).
> 3. Run the command again.
>
> Serve provisions a real Let's Encrypt certificate for the machine, so HTTPS certificates have to be switched on for the tailnet once.
>
> The result is `https://pve.<tailnet>.ts.net` with no warning to click past.
>
> Enabling it publishes your **machine names** to the public Certificate Transparency ledger, as `pve.<tailnet>.ts.net` — the same ledger discussed when picking a domain on the Reverse Proxy page. Tailscale's own caution is simply not to enable it if machine names contain sensitive information; `pve` on a randomly generated tailnet string carries nothing worth hiding.
>
> **Worth doing even though the Reverse Proxy page already gives Proxmox a valid certificate**, because the two fail independently. `proxmox.kuzco.org` is a DNS rewrite inside AdGuard, and with **Override DNS servers** on, every lookup depends on AdGuard being alive. `pve.<tailnet>.ts.net` resolves through **MagicDNS**, handled by Tailscale itself, and Serve runs on the host rather than in a container. So on the day AdGuard or NPM is the broken thing — precisely when you need a shell — this name still opens Proxmox cleanly. Keep it bookmarked as the break-glass route.
>
> Tailscale's "on a Proxmox host" guide also documents a second route — installing a Tailscale-issued HTTPS certificate directly into Proxmox, kept current with a cron job. Serve is the simpler, self-contained option and is plenty here.

> [!DETAILS] Does this replace a consumer VPN like NordVPN?
> Half of one, better — and the other half not at all, so decide by what you actually bought it for.
>
> **Replaced properly:**
>
> - **Safety on hostile Wi-Fi** — the exit node above routes everything through your own house, which is the same protection with one fewer company to trust
> - **Ad and tracker blocking** — AdGuard does what those services' "threat protection" features do, with lists you pick and a query log you can read; through the exit node it follows you off the LAN
> - **Reaching your own machines from anywhere** — a consumer VPN never did this at all
>
> **Not replaced, and not replaceable here:**
>
> - **Hiding your browsing from your ISP** — traffic through your own exit node still leaves on your own line, so your ISP sees exactly what it always did. Moving that visibility elsewhere was the entire product
> - **Masking your address from websites** — sites see your *home* IP, which is a stable identifier tied to where you live rather than an anonymising one
> - **Geo-shifting**, and **torrent privacy** if that matters
>
> One new cost too: an exit node caps mobile speed at your home *upload* bandwidth, adds a hop of latency, and dies with the server.
>
> **Either way, disconnect it while at home.** On your own LAN a consumer VPN buys only ISP opacity, and it costs you real things: it bypasses AdGuard's filtering, it stops the `*.kuzco.org` names from the Reverse Proxy page resolving on the machine you administer from, and it fights Tailscale for control of routing and DNS on macOS. Run one at a time.

## Put Tailscale on the Mac you administer from

### Install the Standalone build, not the App Store one
The phone proved the tailnet reaches home from outside. The Mac is the machine you actually administer *from*, and it is worth a moment because **the two macOS builds are not interchangeable**.

Take the **Standalone** build from [tailscale.com/download/macos](https://tailscale.com/download/macos) — Tailscale's own standing recommendation. The Mac App Store build runs fully sandboxed, which costs you the **Tailscale SSH server** and carries a documented conflict with **Screen Time web filters**; neither is worth inheriting on the machine you run the house from.

> [!WARNING]
> **Never have both builds installed.** Running the Standalone and App Store versions together prevents the Tailscale extension from launching at all — and on macOS 26 an orphaned App Store extension can block a later Standalone install outright. If the App Store one is already on this Mac, before installing Standalone:
>
> 1. Quit it.
> 2. Delete the app.
> 3. Empty the Trash — not optional, since the extension stays registered with the system until the bundle is genuinely gone.
> 4. Reboot.

### Take the two approval prompts
First launch opens a **Required permissions** screen listing two rows, with **Next** greyed out until both read *Granted*. Neither is anything going wrong:

- **VPN Configuration** — *"allows Tailscale to route traffic to other devices in your tailnet"*. macOS raises this one as a dialog on its own; choose **Allow** and the row goes green immediately. An app cannot create a network interface directly — Apple routes all tunnelling through the Network Extension framework, so every VPN app must register a configuration first. This is macOS describing the mechanism, not Tailscale asking to carry your browsing. Decline it and the app installs but can never connect to anything.
- **System extension** — *"allows Tailscale to control the networking features of your Mac"*. This row stays red at **System Extension Approval Required** until you approve it:

1. Select its **Grant permissions** button.
2. macOS raises a *System Extension Blocked* dialog — click **Open System Settings**.
3. Under **General → Login Items & Extensions → Network Extensions**, toggle **Tailscale Network Extension** on.
4. Authenticate with Touch ID.
5. Select **Done**.

On macOS Sonoma 14 and earlier it surfaces instead as a blocked-software message under **System Settings → Privacy & Security** with an **Allow** button.

Back in the Tailscale window the red text flips to **Granted** and **Next** un-greys. If it does not update, click away from the window and back — it re-checks on focus.

Then **Log in** with the same account as the host, and the Mac appears on the [Machines page](https://login.tailscale.com/admin/machines). The `192.168.1.0/24` subnet route is picked up automatically — macOS needs no equivalent of the `--accept-routes` a Linux client would want.

### Start at login, and when you actually need it running
Onboarding's last screen offers **start at login**. Take it. Idle Tailscale costs nothing — traffic only enters the tunnel when its destination is a `100.x` tailnet address or something on `192.168.1.0/24` — and the failure mode of leaving it off is the one that bites: you are away, you want to check the house, and the client is not running.

Strictly, this Mac needs it in only two situations, and neither happens at home:

- **You are away from home** — it is the only path back to the rack.
- **You want the `*.kuzco.org` names to resolve while away** — those exist only in AdGuard, and the tailnet DNS override is what carries them off the LAN.

Leaving it connected at home changes nothing, which is exactly why start-at-login is the right default: nothing to remember on the way out the door.

> [!WARNING]
> **Run Tailscale or a consumer VPN, never both at once.** They do not merely compete — they overlap. Tailscale assigns its `100.x` addresses out of the **`100.64.0.0/10` CGNAT block**, and NordVPN runs its own resolver at `100.64.0.2`, inside that same range. This build hit exactly that during the AdGuard page, where every lookup came back `Server: 100.64.0.2`. Keep both installed if you want them, but switch with the menu-bar toggle rather than running them together, and expect DNS to be the thing that breaks first if you forget.

> [!NOTE]
> **Your phone is the opposite case: leave Tailscale on there permanently.** Not because Tailscale knows where you are — it holds no location permission and has no location feature. The **Home Assistant companion app** is what has iOS Location access, and it sends your position to your own Home Assistant at `192.168.1.51`, becoming the `device_tracker` entity the presence automations read. Tailscale is only the road: off home Wi-Fi a `192.168.1.x` address is unreachable by design, so without it the app keeps trying and simply cannot get home. Switch Tailscale off and the tracker freezes on *home*, and the presence automations on the Automations page never see anyone leave.
>
> What Tailscale itself can see is device names, the public IP each device connects from, and connection times — coordination metadata it needs for NAT traversal, giving roughly the city-level location any website you visit also gets. Traffic between your devices is WireGuard end-to-end encrypted and its servers exchange public keys, not content; even the DERP relays used when a direct connection fails carry ciphertext they cannot read. To stop location reporting outright, revoke it in the companion app's iOS location permission — not here — and accept that the presence rules stop firing.

> [!NOTE]
> **This does not put your browsing through a VPN**, whatever the prompt's wording suggests. Tailscale carries exactly two things: the `100.x` tailnet addresses, and the `192.168.1.0/24` subnet route you approved. Everything else leaves this Mac as it does today, over whatever network it is on. That is the whole distinction between a mesh VPN and a consumer one — and it is why leaving Tailscale connected at home is harmless, while leaving NordVPN connected is not. The single exception is deliberately selecting an **exit node**, which stays off unless you choose it.

> [!DETAILS] Confirming this stays free
> Everything here runs on Tailscale's free Personal plan: $0 forever, up to 6 users, unlimited devices for those users — subnet routing and **Disable Key Expiry** included. If you read elsewhere that the free plan is "3 users / 100 devices," that is the old limit; the current Personal plan allows 6 users with free, unlimited user devices.
