---
title: AdGuard
subtitle: House-wide ad and tracker blocking, as the LAN's own DNS server
collection: My Build
order: 13
accent: violet
---

**AdGuard Home** is the next of the service **LXCs (Linux Containers)** to come online on this box, and it has the widest blast radius of any of them: once the network points at it, every device in the house resolves names through it. That makes it both the household ad-and-tracker filter and the single **DNS (Domain Name System)** server the whole LAN (local area network) depends on. It is a single small Go binary, so it idles in a few tens of megabytes — but its IP address must be nailed down and never move.

> [!NOTE]
> AdGuard belongs in an **unprivileged container**, the secure default on this Proxmox host — it touches no hardware. Build it before Nginx Proxy Manager, Nextcloud, and the rest; those are easier to reach by name once DNS is in your hands.

## Create the container

### Run the install script
The quickest path is the Proxmox community helper script, which builds a ready-to-go AdGuard container in about two minutes. In the Proxmox web interface at `https://`-the-host-IP-`:8006`, click the node (the Maximus X Hero server) in the left tree, then click **Shell** — this runs on the Proxmox host itself, not inside a container or a VM (virtual machine). One heads-up before you paste: the script shows its **Community-Scripts Options** menu almost as soon as it starts, so read the **Choose Advanced and pin a static IP** section below first — the same Advanced-and-static-IP move every container in this build makes. Then paste this and press Return:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/adguard.sh)"
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach the node Shell.

> [!NOTE]
> Read any script before piping it into a root shell — the same download-read-run habit used for the rest of this build. These are the well-regarded successor to the tteck scripts, but the habit stands regardless of source.

> [!DETAILS] Prefer no scripts at all? Install it by hand
> Build a plain unprivileged Debian container yourself with the Create CT wizard (1 core and 512 MB RAM is plenty for AdGuard's single binary), give it the **static IP** below, then in its **Console**:
>
> ```bash
> apt update && apt install -y wget
> cd /opt
> wget https://static.adtidy.org/adguardhome/release/AdGuardHome_linux_amd64.tar.gz
> tar -xf AdGuardHome_linux_amd64.tar.gz
> cd AdGuardHome
> ./AdGuardHome -s install
> ```
>
> The `-s install` flag registers it as a boot service and starts it.
>
> Done this way you have already covered the static-IP step too — continue at **Set it to start at boot**.

### Choose Advanced and pin a static IP
This happens *while the script runs*. On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once any of these pages saves defaults), pick **Advanced Install**. Every dialog it can show, in order, with this build's answer:

- **TELEMETRY & DIAGNOSTICS** (first community-script run only, and it appears **before** the menu) → decline — nothing in this build phones home
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login; a **Verify Root Password** box repeats a non-blank entry
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the prefills: **1 CPU core, 512 MB RAM, 2 GB disk** — more than enough
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.53/24`**, gateway **`192.168.1.1`** — never DHCP
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
- **CONTAINER PROTECTION** → **No** — AdGuard rebuilds in minutes, the page-5 rule for skipping it
- **DEVICE NODE CREATION** → **No**, the default
- **MOUNT FILESYSTEMS** → leave **empty**
- **POST-INSTALL HOOK (HOST)** → leave **empty**
- **VERBOSE MODE** → **No**, then review **CONFIRM SETTINGS** and press **Create LXC**
- **Which storage pool?** (two radiolists — container, then template — shown only when more than one pool qualifies; this host's stock local/local-lvm split auto-selects silently) → **local-lvm** for the container, **local** for the template
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available"** (if it appears) → **Ignore** — numbered **2**, or **3** in the four-option variant — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

> [!INPUT] adguard-console-user | AdGuard console username | | root

> [!SECRET] adguard-root | AdGuard container root password
> Set at the wizard's **Set Root Password** prompt; logs into the container's **Console** in Proxmox as `root`.

Let the script finish — it prints the setup URL when done.

> [!INPUT] adguard-ip | AdGuard container IP | 192.168.1.53

> [!WARNING]
> AdGuard is about to become the whole network's DNS server, and its address must never change. A static IP is mandatory — if it ever moves, every device in the house loses name resolution at once.

> [!DETAILS] Why .53
> It sits in the `.2–.99` static zone carved out of the Fios DHCP pool on the Start Here page — an address the router can never hand to anything else — and it mirrors DNS port 53, which makes it easy to remember forever.

### Set it to start at boot
DNS for the entire house cannot depend on you remembering to start a container after a power cut. Select the container in the left tree, open **Options**, and set **Start at boot** to Yes — or from the node Shell:

Leave **Start/Shutdown order** alone while you are in that panel — `any` is the right answer. This build numbers only three guests, to solve one dependency chain: **1** TrueNAS (so storage boots first and, since shutdown reverses the order, goes down last), **2** the Home Assistant VM holding the Mosquitto broker, **3** Frigate which depends on that broker. Unordered guests shut down *before* any numbered one, so AdGuard stops cleanly well ahead of the storage it never touches. Numbering it would only enlist it in a sequence it has no stake in.

The `103` is the container ID the script assigns here — this build's guests run **100** TrueNAS, **101** Home Assistant, **102** Frigate, then **103** for AdGuard. It shows next to the container's name in the left tree; swap it if yours differs:

```bash
pct set 103 -onboot 1
```

> [!NOTE]
> This box already rides a CyberPower CP1500PFCLCD UPS (uninterruptible power supply), so brief power blips never reach AdGuard at all. Start-at-boot covers the longer outages that do drain the battery — and once the UPS & Safe Shutdown page later in the build wires up an automatic shutdown, those end cleanly instead of as a hard cut.

## Run the setup wizard

### Open the wizard
In a browser, go to the static IP you chose on port 3000 and click **Get Started**:

```text
http://192.168.1.53:3000
```

### Set the ports
Leave the **Admin Web Interface** on its default port, and leave the **DNS server** on port 53, listening on all interfaces. Click Next.

> [!NOTE]
> Port 53 is the standard DNS port, and "all interfaces" means all of the *container's* interfaces — which sit entirely on the home LAN. None of this is reachable from the internet; the router blocks unsolicited inbound traffic by default.

> [!WARNING]
> Never create a router port-forward to this container. A DNS server exposed to the internet — an "open resolver" — gets found and abused for amplification attacks within hours. AdGuard serves the LAN only. For remote access, reach it over Tailscale instead of opening a port.

### Create the admin login
Set a username and a strong password for the dashboard. The wizard's final screen is **device-configuration instructions** — informational only; click through it. Pointing the network at AdGuard happens once, at the router, further down this page. The dashboard now lives at the container's IP with no `:3000` suffix. Record both in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build), and capture them in the fields below so this page stands on its own.

> [!INPUT] adguard-admin-user | AdGuard admin username

> [!SECRET] adguard-admin-password | AdGuard admin password

### Set the upstreams — first stop after the wizard
The dashboard now lives at the plain IP (`http://192.168.1.53`). Before anything else, go to **Settings → DNS settings** — the screen that decides your DNS speed and privacy. Replace the contents of **Upstream DNS servers** with these two lines, one per line:

```text
9.9.9.9
149.112.112.112
```

That is **Quad9**, primary and secondary: it blocks known-malicious domains at the resolver level — command-and-control, phishing, malware distribution, a *different* list from the ad-and-tracker blocklists below, so the two layer rather than overlap — and it is a Swiss non-profit that does not monetize query data. The one to avoid is your ISP's resolver, which sees every lookup and has commercial reasons to care.

> [!DETAILS] "But Cloudflare benchmarks faster"
> It does, and it will not reach you: **AdGuard caches**. A household hits the same few hundred domains repeatedly, so most lookups are answered by this container at effectively zero milliseconds and never touch an upstream at all. Upstream latency applies only to cache misses, where the gap between the major resolvers is single-digit milliseconds — the benchmarks that rank them are measuring bare resolvers with no cache in front, which is not this setup.
>
> If you prefer Cloudflare regardless, the apples-to-apples pick is **`1.1.1.2` / `1.0.0.2`** — the malware-blocking variant — not plain `1.1.1.1`, which filters nothing and drops the security layer entirely.
>
> What not to do either way: **mix a filtering resolver with a non-filtering one.** AdGuard's default load-balancing mode picks an upstream per query, so a Quad9-plus-`1.1.1.1` pair blocks a malicious domain only when the coin lands right. Both filtering, or neither.

Two more settings live on that same **DNS settings** page, below the upstream box:

- **Upstream mode** → keep **Load-balancing**, the default — it queries one upstream at a time, favouring whichever has proved fastest and most reliable. *Parallel requests* doubles your query volume to the resolver for a gain the cache already erases, and *Fastest IP address* waits for every server and measures TCP connection speed, which the screen itself warns can significantly slow queries.
- **Fallback DNS servers** → enter **`1.1.1.2`** and **`1.0.0.2`**, one per line. Both upstreams above are the same provider, so a Quad9-wide outage takes out both and leaves the house with no DNS; this pair is Cloudflare's malware-filtering equivalent — a different company, same security posture, used only when Quad9 does not answer. Unlike the router's secondary-DNS field discussed further down, **this cannot bypass your blocking**: AdGuard still receives and filters every query, it merely forwards through a different resolver while its upstreams are unreachable.

Scroll on and two more settings deserve a deliberate answer — the rest of the page is correct as shipped:

- **Rate limit** (under *DNS server configuration*) → change **20** to **`0`**. This is not per device: the **Subnet prefix length for IPv4** below it defaults to **24**, so that quota is a single bucket shared by *every* client on `192.168.1.0/24`. A few phones plus one media-heavy page load can burst past 20 queries a second between them, and anything over is **silently dropped**. The limit exists to protect resolvers exposed to the internet; AdGuard's own documentation calls `0` safe when the server is not internet-accessible, which is this build exactly — LAN-only, no port-forward, ever.
- **Optimistic caching** (under *DNS cache configuration*) → **enable it**. AdGuard answers from an expired cache entry immediately and refreshes it in the background, so browsing feels instant and a sluggish upstream never stalls a page.

> [!WARNING]
> **Leave *Allowed clients* empty**, under *Access settings*. Restricting it to `192.168.1.0/24` looks like free hardening, but the Remote Access page later makes AdGuard the tailnet's nameserver — and those queries arrive from **`100.x`** addresses. An allowlist would silently kill DNS on your phone the moment you left the house, in a way almost nobody connects back to this box.

> [!DETAILS] The rest of the page, and why each stays as it is
> - **Private reverse DNS servers** → empty — it falls back to the router at `192.168.1.1`, which is what knows your DHCP names
> - **Use private reverse DNS resolvers** → keep ticked, or `192.168.x` reverse lookups all return NXDOMAIN
> - **Enable reverse resolving of clients' IP addresses** → keep ticked — this is what makes the Query Log show device *names* instead of bare IP addresses
> - **Upstream timeout** → `10` seconds, the default
> - **Subnet prefix lengths** (`24` / `56`) and **Rate limiting allowlist** → leave; with the rate limit at `0` they do nothing
> - **Enable EDNS client subnet** → keep **off** — enabling it forwards your subnet to authoritative servers, leaking approximate location for a routing gain you do not need
> - **Enable DNSSEC** → ticked, as set above
> - **Disable resolving of IPv6 addresses** → keep **off**. The containers here are IPv4-only, but Fios hands real IPv6 to household devices; dropping AAAA records would push them onto slower paths
> - **Blocking mode** → **Default** — blocked names answer `0.0.0.0`, which every client handles cleanly
> - **Blocked response TTL** → `10` — short, so unblocking a domain takes effect almost immediately
> - **Enable cache** ticked, **Cache size** `4194304` — the cache that makes the upstream-latency question above nearly moot
> - **Override minimum / maximum TTL** → both `0`; a minimum override serves stale records, a maximum override only adds upstream traffic
> - **Disallowed clients** → empty
> - **Disallowed domains** → keep the three shipped entries (`version.bind`, `id.server`, `hostname.bind`) — they drop resolver-fingerprinting probes

- **Bootstrap DNS servers** (same page) → leave as offered — they only resolve the upstreams' own names at startup
- **Enable DNSSEC** (same page) → **tick it** — it validates that answers were not forged, and costs no extra round-trip in the common case
- **DNS-over-HTTPS / DNS-over-TLS upstreams** (`https://` or `tls://` prefixes) → **do not use them here.** They encrypt the AdGuard→upstream leg, which sounds strictly better but buys little on this build: your ISP already sees every destination IP you connect to, so hiding the lookup does not hide the visit, and each uncached query pays a TLS session — 5–15 ms. Encrypted DNS earns its cost on *untrusted* networks, which is exactly the case Tailscale already covers by routing your phone's DNS back through this house.

> [!WARNING]
> **That reasoning inverts if you route traffic through a consumer VPN.** It rests on "your ISP sees the destination IPs anyway" — true when you browse normally, false the moment a VPN tunnel hides those IPs. Point a VPN client's *custom DNS* at this AdGuard and the queries travel your own line in cleartext while the browsing goes through the tunnel: the content is hidden and the index is published, which is the classic **DNS leak** the VPN's own leak-protection exists to prevent. It can also break geo-shifting, since some services compare your resolver's location against your exit IP. If you intend to run both, switch these upstreams to `tls://` so the only unencrypted thing left is not the list of every site you visit.
>
> Two costs survive even that fix, so know what you are buying: **geo-shifting still breaks**, because your queries resolve through a resolver in your home region while your traffic exits somewhere else, and services that compare the two block on the mismatch; and **your query stream becomes linkable to your home address**, since the upstream now sees lookups arriving from your residential IP rather than from an anonymous VPN session — the opposite direction from what a consumer VPN is for. There is also a fragility: you are deliberately re-opening the leak the VPN's own protection closes, so a client update that tightens it can silently break your filtering. Run both only if your reason for the VPN is ISP opacity; if it is anonymity or geo-unlocking, leave the VPN unmodified and simply disconnect it at home.

> [!NOTE]
> Upstream choice only affects **uncached** lookups. AdGuard answers repeats from cache in about a millisecond, and blocked domains never leave the LAN at all — which is why adding a DNS hop makes browsing feel *faster*, not slower.

## Point the network at it

### Set AdGuard as the router's DNS
Log into the Fios router at `192.168.1.1`. The setting is not under DHCP where you would expect it — on both current models (**G3100** and **CR1000A**) it lives on the broadband side:

**Advanced → Network Settings → Network Connections → Broadband Connection (Ethernet)**, then on the *Settings* page:

- **IPv4 DNS** → **"Use the Following IPv4 DNS Addresses"**
- **IPv4 DNS Address 1** → **`192.168.1.53`**
- **IPv4 DNS Address 2** → leave at **`0.0.0.0`** — this UI's way of showing empty, which is the fallback decision below answered the local-first way
- **Internet Protocol** (above the DNS rows) → **leave it as you found it**. If it reads *Obtain an IP Address Automatically*, keep it there — Verizon assigns the WAN address by DHCP, and pinning it manually means the internet drops the next time they reassign it, in a way that looks nothing like a DNS change
- **Internet Connection Firewall** → leave **Enable** ticked, as the page itself advises
- **Apply** — it takes a minute or two to settle

Every phone, TV, and computer in the household now uses AdGuard automatically — nothing to configure per device.

Most likely nothing needs to renew a lease, either: this router hands clients *itself* as their DNS server and forwards upstream, so changing where it forwards takes effect immediately and the address the clients hold never changed. Rather than guess, check the outcome — open AdGuard's **Query Log** and browse something. Entries appearing is the proof.

If the log stays empty after a minute or two, find out what a client actually holds. On the **Mac**, in the **Terminal** app (⌘-Space, type *Terminal*) — not a Proxmox shell or a container console:

```bash
scutil --dns | grep 'nameserver\[0\]' | head -3
```

- **`192.168.1.1`** — the router is proxying as expected, so an empty log means the router did not accept the change; go back and confirm it applied
- **`192.168.1.53`** — this router hands the resolver out directly, and *this* is the case where clients need a new lease: **System Settings → Network → the connection → Details → TCP/IP → Renew DHCP Lease** on a Mac, or toggle Wi-Fi off and on for a phone

> [!NOTE]
> **Expect the Query Log to show one client, not many.** Fios routers hand out *themselves* (`192.168.1.1`) as the DNS server and forward upstream to whatever you set above, so AdGuard sees every query arriving from the router rather than from the device that asked. Filtering is unaffected and complete; what you lose is per-device visibility and per-client rules. The only real cure is moving DHCP off the router and into AdGuard — a much larger change, and not worth it here.

> [!WARNING]
> **Disable IPv6 on the router — or AdGuard is bypassable.** Fios hands out IPv6 alongside IPv4, *including IPv6 DNS servers*, and this build's AdGuard container is IPv4-only. Any device that picks up an IPv6 resolver resolves through it and never touches AdGuard, which presents as "blocking works on some things and not others" and sends people hunting through blocklists for a problem that is not there. Turn it off in the same left-hand menu — **IPv6** and **IPv6 Address Distribution** sit a few rows above *Network Connections* — or at minimum stop it advertising IPv6 DNS servers.

> [!DETAILS] Why this build runs IPv4 only
> Worth answering once, since every container in this collection is created with *IPv6— Fully Disabled* and the reason is never stated. IPv6 exists because IPv4's ~4.3 billion addresses ran out; it gives every device a globally routable address and removes the need for NAT (Network Address Translation), which is why your whole house currently shares one public address. This build turns it off for four reasons, in descending order of how much they matter:
>
> 1. **The AdGuard bypass above** — an IPv4-only resolver simply is not consulted by a device that has an IPv6 one
> 2. **Every rule here is IPv4** — the Frigate firewall fence, the datacenter rules, the cameras' dead-end gateways, the NTP rule, the static addressing plan. Enabling IPv6 means writing an IPv6 twin of each, or discovering later that none of them cover it
> 3. **NAT is an accidental second firewall** — with IPv6 every device is directly addressable, and the router's firewall becomes the only thing between the internet and seven cheap IP cameras
> 4. **One address family is one place to look** when something breaks
>
> What it costs in practice, for a US residential connection today: very little. Effectively every IPv6-capable site is also reachable over IPv4 and clients fall back instantly; nothing in this build requires it. Peer-to-peer and gaming setups sometimes connect more directly over IPv6, and Tailscale can use it for direct paths — but Tailscale works over IPv4 and relays when it cannot.
>
> Doing it *properly* rather than skipping it means giving AdGuard an IPv6 address, advertising that as the router's IPv6 resolver, and writing IPv6 firewall rules throughout — a project, not a checkbox. The trade this build makes is a capability the household does not use, for a large reduction in things that can be silently wrong.
>
> **One household where this is not free: gaming.** Many multiplayer titles connect players peer-to-peer, which over IPv4 means punching through NAT — the thing behind every *NAT Type: Moderate/Strict* warning. Native IPv6 sidesteps it, and Xbox in particular prefers it (falling back to Teredo tunnelling without). The bigger factor is actually **UPnP off**, since that is how a console asks the router to open the ports it needs. Expect **PC gaming to be unaffected** — client-server over outbound connections — while a **console may report a worse NAT type**, which is usually harmless at Moderate and breaks matchmaking and party chat at Strict.
>
> If a console does complain, in order of what to try: **re-enable UPnP** (pragmatic, and the risk it guarded against is already handled at each camera's own settings); **manually forward just that console's ports** to its reserved address; or turn IPv6 back on — but only after AdGuard can answer IPv6 queries, or the bypass above reopens. Two more while you are in there: **UPnP off** if your model offers it — on the **CR1000A** it is at **Advanced → Devices → Universal Plug & Play**, a *Devices* section separate from Network Settings, while the **G3100** does not expose a UPnP toggle at all in current firmware. If there is no such entry, leave it: this was the router half of the camera lockdown, and the half that matters is already done at each camera's own settings, so nothing here is exposed by UPnP staying on (and console gaming keeps its automatic port opening — see the gaming note below). And **audit port forwarding** at **Security & Firewall → Port Forwarding** — the security model of this build is that nothing inside the house answers the internet, and a forwarding rule is the one thing that breaks it. Nothing in this collection ever needs one: **Tailscale is outbound-only**, which is exactly why the house stays sealed and still answers your phone from anywhere. Two things to know before you start deleting:

- **Security & Firewall → Port Forwarding *Rules*** (the neighbouring menu entry) is **not** a list of open ports — it is the router's library of protocol *definitions* (FTP = 21, HTTP = 80, and so on) offered when you build a rule. Its own text says "Protocols that are implemented in the router". Leave it entirely alone
- A Fios router **ships with real forwards of Verizon's own**, so an empty list is not the expected state. Typically: **4567/4577 → `127.0.0.1`**, Verizon's documented technician access *to the router itself* (loopback, so no household device is exposed — leave them; Verizon provisions this router regardless), and **35000 → a `192.168.1.1xx` address on port 4567**, which is **Fios TV set-top-box remote DVR**. Keep that one if you program the DVR from the Fios app while out; remove it if you never do, which closes a genuine inbound path to a set-top box at no cost

Anything you cannot account for beyond those — an old console, a previous NAS, something a UPnP-enabled device created years ago — should go.

And if the router **refuses to delete its own entries** (Verizon's firmware manages them and re-adds them), handle the consequence instead: the set-top-box rule targets an address like `192.168.1.100`, which is the **first address in the DHCP pool** on this build's `.2–.99` static plan. A new phone joining the Wi-Fi could be handed that address and silently inherit an inbound port forward. Set the router's DHCP pool to start at **`.101`** so the address stays permanently unassigned and the undeletable rule points at nothing. Finally **remote administration off** — **System → Remote Administration**, where the settings that matter are the two **"Using Primary HTTPS Port (443)"** boxes, v4 and v6; both ship unticked, so this is usually a verify. The **WAN ICMP Echo Requests** boxes on that page ship *ticked* and can come off — nothing here needs the router answering internet pings — though that one is marginal: a scanner does not need ping to find you, and what protects this house is that there is nothing listening to find.

> [!TIP]
> Keep this one in your back pocket for the Reverse Proxy page: Fios routers run **DNS rebinding protection**, which drops responses pointing at private addresses. AdGuard's `*.example.com → 192.168.1.54` rewrites are precisely that shape. If the proxy hostnames later resolve to nothing, this router setting is the first suspect, not AdGuard.

> [!TIP]
> Set it once at the router and it covers everything: the HomePod mini, the Family Hub fridge, the ecobee thermostats, the Nest speakers, all of it. The handful of devices with hardcoded DNS (some smart-home gear) are the only exceptions.

> [!WARNING]
> **Do not hardcode `192.168.1.53` into a laptop or phone's network settings.** It works beautifully at home and leaves you with no DNS at all the moment the device joins any other network, since that address exists nowhere else. Fine for machines that never travel — a desktop, a TV — and wrong for anything portable. The build's answer for "AdGuard everywhere, including away" is the **Remote Access** page: once the tailnet lists AdGuard as its nameserver, portable devices resolve through this house from anywhere, with nothing hardcoded and nothing to undo when travelling.

> [!DETAILS] Should AdGuard serve DHCP instead of the router? (this build says no)
> **This build leaves DHCP on the router.** The blocking works, the proxy names resolve, and nothing else in the collection depends on what the swap would buy — recorded here so the question does not have to be re-litigated later. What follows is the reasoning, and the conditions under which it would be worth revisiting.
>
> It is the usual advice for households whose router cannot hand out a custom DNS server, and it buys one real thing: the **Query Log shows individual devices** rather than attributing every lookup to the router, which also unlocks per-client rules, per-client upstreams, and per-device statistics.
>
> Blocking itself is unaffected either way — every device is filtered identically. What the router-proxy arrangement costs is the ability to tell devices *apart*, and on this build the sharpest example is **camera and IoT forensics**: the Cameras page spends a long section severing seven cameras from their vendors' clouds, and without per-device identity, a camera that starts resolving a vendor domain tomorrow shows up in the log as a domain with no owner. The same blindness covers the fridge, the thermostats and the speakers. The visibility that would *verify* the hardening is precisely what is missing. The forcing reason people usually cite — a router mangling DNS responses — is already handled by the rebind exception above, so this is now a nice-to-have rather than a fix.
>
> **One household-specific blocker to check first:** if you have **Fios TV set-top boxes**, do not do this. They expect the router's own DHCP with Verizon's vendor options and are unreliable behind third-party DHCP; a broken TV guide diagnosed a week later is a poor trade for a nicer log. No set-top boxes, no objection.
>
> One thing it does **not** fix: a **VPN client on a device**. DHCP controls what a machine is *told* its resolver is; a VPN's leak protection overrides what the machine *does*, capturing DNS at the OS level regardless. A laptop running a consumer VPN bypasses AdGuard whether DHCP handed it the router's address or AdGuard's directly — that case is solved only by disconnecting the VPN or pointing its own custom-DNS setting here.
>
> Even then, **defer it until the Proxmox Backups page is done**. It makes AdGuard critical for addressing as well as naming, and this build's own rule is not to hand irreplaceable roles to this box before a proven archive exists. The trigger for revisiting: wanting per-device rules for a household member, or a camera starting to resolve something it should not and needing to know *which* camera.

### Decide on a fallback — a real tradeoff
The **router's secondary DNS** field is a genuine choice on this build, not a formality, and the answer leans toward **leaving it blank** here. (Not to be confused with AdGuard's own *Fallback DNS servers* setting from the previous step — a different thing entirely, and one you did fill in.):

- **Blank (or also AdGuard):** strongest blocking, and it keeps DNS *local-first* — the guiding principle of this whole build. The catch is that if the server or the AdGuard container is down, the house has no DNS until it returns.
- **A public resolver like `1.1.1.1`:** resilience if the box hiccups, at the cost of some devices quietly bypassing your blocking through the fallback.

Picking a *filtering* secondary — AdGuard's own public resolvers at `94.140.14.14` / `94.140.15.15`, which do block ads, unlike Cloudflare's family options that cover malware and adult content only — answers the blocking objection neatly. It does not answer the bigger one:

> [!WARNING]
> **A secondary resolver breaks local names, intermittently.** The next page has AdGuard answering `*.example.com → 192.168.1.54`, and those rewrites exist nowhere else — a query that lands on a public secondary returns NXDOMAIN for them. So `frigate.example.com` resolves, then does not, then does, depending on which resolver a client happened to ask. That intermittency is genuinely miserable to diagnose because every symptom points at the proxy or the certificate instead of at this setting. Local hostnames and DHCP device names fail the same way.
>
> Keep the secondary blank at least until the Reverse Proxy page is behind you and you know how much you lean on those names. If the "no DNS during a host reboot" window does start to grate, the clean answer is not a public secondary but a **second AdGuard on separate always-on hardware** carrying its own copy of the rewrites — the same shape as the second-Uptime-Kuma advice later in this build, and it buys resilience *and* local names *and* blocking rather than trading them against each other.

> [!NOTE]
> Because this server already sits on a UPS and start-at-boot brings AdGuard straight back, the "box is down" window is small. Leaning toward AdGuard-only keeps the household local-first and the blocking complete. If never losing the internet matters more to you than airtight blocking, add a secondary — but make it **AdGuard's own public resolver**, not `1.1.1.1`. This router gives you exactly two DNS fields and **IPv4 DNS Address 1** already holds `192.168.1.53`, so **IPv4 DNS Address 2** takes **`94.140.14.14`**, the primary of AdGuard's public pair (its partner `94.140.15.15` has nowhere to go here, and one address is plenty for a slot whose only job is answering while the container is down). Same resilience, and a device that falls through still gets ads and trackers filtered rather than the raw internet; `1.1.1.1` buys the outage protection and hands you the ads with it. Either way, bank the local-names warning above: when a proxy hostname turns flaky weeks from now, check this field before tearing into the proxy or its certificate.

## Tune and verify

### Add a couple of blocklists
**Back to AdGuard now** — leave the Verizon router UI and return to the AdGuard dashboard at **`http://192.168.1.53`**. Everything in this section happens there. Open **Filters → DNS blocklists**. AdGuard ships with its own **AdGuard DNS filter** enabled; click **Add blocklist → Choose from the list** and add **OISD Blocklist (Big)** — the standard low-breakage pick, comprehensive without being trigger-happy. Stop there for now: more lists block more but break more, and the Query Log below is where you would diagnose it.

### Confirm it is actually blocking
First from the **Mac**, in the **Terminal** app — this one is not a browser step. Check that a known tracker domain gets blocked. A blocked domain comes back answered, with `0.0.0.0` as its address:

```bash
nslookup doubleclick.net 192.168.1.53
```

```
Server:   192.168.1.53
Address:  192.168.1.53#53
Name:     doubleclick.net
Address:  0.0.0.0
```

> [!WARNING]
> **`connection timed out; no servers could be reached` is not a block — it is silence.** The query got no reply at all, which means AdGuard's DNS service is not answering; and since the router now forwards there, the whole house has no DNS while that is true. Work down: does **`http://192.168.1.53`** still load? If yes the container is fine and the DNS listener specifically is not — check the dashboard shows protection on and the server running, since a setting that failed to apply can leave the web UI up while the DNS server stays down. Then in the container's **Console**, confirm something holds the port with `ss -tulnp | grep ':53'` and check `systemctl status AdGuardHome --no-pager`. If the dashboard does not load either, the container itself is stopped.

Then run it again without naming a server, which uses whatever resolver the Mac actually received — the real end-to-end test:

```bash
nslookup doubleclick.net
```

> [!TIP]
> **If that second lookup reports a `Server:` in the `100.64.x` range** — or anything that is neither your router nor AdGuard — the machine has a **VPN or DNS-filtering app intercepting all DNS**, and it will bypass AdGuard permanently. That also explains a direct query to `192.168.1.53` timing out from that machine while the same query answers fine from the Proxmox host: the interception swallows it. Find it with `ifconfig | grep '^utun'` (active tunnels) and in **System Settings → VPN** plus **General → Login Items & Extensions → DNS Proxy**, where a filtering app registers even with no menu-bar icon. Cloudflare WARP, NextDNS, Mullvad and work VPNs are the usual ones. Verify from a second device before blaming the server — one machine bypassing proves nothing about the rest of the house.
>
> **On this build it was NordVPN**, and note this is a *different* symptom from the one the Install Proxmox page documents. There, Nord blocked the LAN outright and the fix was its **Local Network Discovery** toggle. Here that toggle is already on — the web UI loads fine — but Nord's separate **DNS leak protection** still forces every query into the tunnel, so AdGuard never sees them. Three ways out: **disconnect the VPN while at home** (the recommendation — you now run your own filtered resolver, and the Remote Access page gives you your own encrypted path in, which is what a consumer VPN was standing in for); point Nord's **Custom DNS** at `192.168.1.53` (works at home, breaks away from it); or accept that this one machine bypasses the house filter. Two forward-looking notes: the **Reverse Proxy** page's `*.example.com` names exist only inside AdGuard, so they will not resolve on a machine whose DNS is tunnelled — on the very machine you administer from — and **Tailscale and a consumer VPN fight on macOS**, so expect to run one at a time from the Remote Access page onward.

> [!TIP]
> **Through the router you may see `No answer` rather than `0.0.0.0`.** Either is a successful block — the domain does not resolve to anything real — but the difference matters: it means the router **stripped** AdGuard's `0.0.0.0` on the way back, which is the signature of **DNS rebinding protection** dropping responses that carry private or invalid addresses. That is worth settling now, because the Reverse Proxy page has AdGuard answering `*.example.com → 192.168.1.54`, an equally private address, for every device in the house. Test it in two minutes: in **Filters → DNS rewrites** add `test.home.arpa` → `192.168.1.54`, then from Terminal run `nslookup test.home.arpa 192.168.1.53` (expect `192.168.1.54`) and `nslookup test.home.arpa` (through the router). If the second returns the address too, the proxy names will work. If it returns `No answer`, the router is filtering private-IP responses and needs relaxing before the next page — far better to learn that here than halfway through building a reverse proxy. Delete the test rewrite afterwards.
>
> **The fix, on this hardware:** **Advanced → Network Settings → DNS Server**, where a **"Enable DNS Rebind Protection"** checkbox sits below the DNS entry list, ticked by default. Try the surgical route first — the **Exceptions to DNS Rebind Protection** field below it takes an **IP/Netmask**; enter **`192.168.1.0/24`** (your LAN is both the client range and the answer range, so that covers either meaning of the ambiguous wording) and **Apply Changes**, then re-run the lookup. If it still comes back empty, untick the checkbox itself.
>
> Know what that trades away: DNS rebinding is a genuine attack class — a hostile page whose domain re-resolves to a private address, letting its scripts reach LAN devices from inside your browser — and this filter blocks it. Relaxing it is nevertheless the standard move for anyone running local DNS rewrites, and it is defensible on this build because every service it exposes sits behind a login: Proxmox, Home Assistant, Frigate's 8971, AdGuard, the proxy, and the cameras all authenticate. Prefer the exception over the global untick, so the protection survives everywhere except your own subnet. On this build the **`192.168.1.0/24`** exception was enough — the rewrites resolved through the router immediately after applying it.
>
> Optional tightening, if you want to know the field's exact semantics: change the exception to just **`192.168.1.54`** and re-run the lookup. Still working means the field matches *answer* addresses, and you now have a rule that permits only responses pointing at the proxy while still blocking a rebind aimed at your router or a camera. Broken means it matches *client* addresses instead — revert to `/24`. A marginal gain on a marginal defence either way; `/24` is a fine place to stop.

Then back in the **AdGuard dashboard** (`http://192.168.1.53`), open the **Query Log**. You should see live queries from the house flowing in, with blocked ones flagged.

> [!TIP]
> If a site you trust breaks, open the Query Log, find the blocked domain, and click to allow it. That is the normal way to fix the occasional false block — far better than disabling a whole list.

> [!NOTE]
> **YouTube ads will still play, and that is not a fault.** DNS filtering works by refusing to resolve *ad-serving domains* — `doubleclick.net` and its cousins, which is what the test above proved. YouTube serves its ads from **the same domains as the video itself**, so there is no separate name to refuse; blocking it would break YouTube outright. Google does this deliberately, and Facebook, Instagram, Twitch and Spotify all serve their ads first-party for the same reason.
>
> What this container genuinely stops: trackers and analytics across the web, banner and display advertising on ordinary sites, app telemetry, smart-device phone-home traffic, and known malware domains. Compare a news site here against the same site on cellular and the difference is obvious. For YouTube specifically the only real answers are a browser extension on desktop, a subscription, or acceptance — **no network-level tool solves it**, and piling on aggressive blocklists to chase it is how people end up breaking legitimate sites instead.

### Make a local name for it
Once the reverse proxy is up and giving services tidy hostnames, AdGuard is also where you point those names at the right container. In AdGuard's **Filters → DNS rewrites**, map a wildcard like `*.example.com` to the proxy's IP so internal hostnames resolve on the LAN — noting a `*.` wildcard matches **subdomains only**, never the bare domain itself; the Reverse Proxy page handles that detail when it creates the real rewrite. You do not do this yet — the proxy does not exist at this point in the build, and the Reverse Proxy page walks through adding the rewrite when it stands up. For now, just note that AdGuard's dashboard is the place that work happens.

> [!NOTE]
> That is the whole lifecycle for this container: unprivileged, pinned static IP, start-at-boot, run the wizard, point the router at it, verify in the Query Log. Snapshot it before any blocklist experiment or upgrade — rollback is instant if a new list breaks something.
