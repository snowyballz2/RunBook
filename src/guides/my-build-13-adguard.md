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
The quickest path is the Proxmox community helper script, which builds a ready-to-go AdGuard container in about two minutes. In the Proxmox web interface at `https://`-the-host-IP-`:8006`, click the node (the Maximus X Hero server) in the left tree, then click **Shell** — this runs on the Proxmox host itself, not inside a container or a VM (virtual machine). One heads-up before you paste: the script asks **Default or Advanced** almost as soon as it starts, so read the **Choose Advanced and pin a static IP** section below first — the same Advanced-and-static-IP move every container in this build makes. Then paste this and press Return:

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
This happens *while the script runs*. When it asks **Default or Advanced**, pick **Advanced**. Every dialog it can show, in order, with this build's answer:

- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login
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
- **VERBOSE MODE** → **No**, then review **CONFIRM SETTINGS** and answer **Yes** to create
- **TELEMETRY & DIAGNOSTICS** (appears once, if at all) → decline — nothing in this build phones home
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available" [1/2/3]** (if it appears) → **2, Ignore** — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

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

The `102` is the container ID the script assigned — it shows next to the container's name in the left tree; swap it if yours differs:

```bash
pct set 102 -onboot 1
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

That is **Quad9**, primary and secondary: it blocks known-malicious domains at the resolver level (a second net under AdGuard's blocklists) and does not monetize query data. Cloudflare's `1.1.1.1` is a fine alternative and marginally faster; the one to avoid is your ISP's resolver, which sees every lookup and has commercial reasons to care.

- **Bootstrap DNS servers** (same page) → leave as offered — they only resolve the upstreams' own names at startup
- **Enable DNSSEC** (same page) → **tick it** — it validates that answers were not forged, and costs no extra round-trip in the common case
- **DNS-over-HTTPS / DNS-over-TLS upstreams** (`https://` or `tls://` prefixes) → **do not use them here.** They encrypt the AdGuard→upstream leg, which sounds strictly better but buys little on this build: your ISP already sees every destination IP you connect to, so hiding the lookup does not hide the visit, and each uncached query pays a TLS session — 5–15 ms. Encrypted DNS earns its cost on *untrusted* networks, which is exactly the case Tailscale already covers by routing your phone's DNS back through this house.

> [!NOTE]
> Upstream choice only affects **uncached** lookups. AdGuard answers repeats from cache in about a millisecond, and blocked domains never leave the LAN at all — which is why adding a DNS hop makes browsing feel *faster*, not slower.

## Point the network at it

### Set AdGuard as the router's DNS
Log into the Fios router at `192.168.1.1`, find the DHCP or DNS settings, and set the **primary DNS server** to AdGuard's static `192.168.1.53`. Save, and reboot the router if it asks. As devices renew their leases, every phone, TV, and computer in the household starts using AdGuard automatically — nothing to configure per device.

> [!TIP]
> Set it once at the router and it covers everything: the HomePod mini, the Family Hub fridge, the ecobee thermostats, the Nest speakers, all of it. The handful of devices with hardcoded DNS (some smart-home gear) are the only exceptions.

### Decide on a fallback — a real tradeoff
The secondary DNS field is a genuine choice on this build, not a formality, and the answer leans toward **leaving it blank** here:

- **Blank (or also AdGuard):** strongest blocking, and it keeps DNS *local-first* — the guiding principle of this whole build. The catch is that if the server or the AdGuard container is down, the house has no DNS until it returns.
- **A public resolver like `1.1.1.1`:** resilience if the box hiccups, at the cost of some devices quietly bypassing your blocking through the fallback.

> [!NOTE]
> Because this server already sits on a UPS and start-at-boot brings AdGuard straight back, the "box is down" window is small. Leaning toward AdGuard-only keeps the household local-first and the blocking complete. Add `1.1.1.1` as a fallback only if never losing the internet matters more to you than airtight blocking.

## Tune and verify

### Add a couple of blocklists
In the dashboard, open **Filters → DNS blocklists**. AdGuard ships with its own **AdGuard DNS filter** enabled; click **Add blocklist → Choose from the list** and add **OISD Blocklist (Big)** — the standard low-breakage pick, comprehensive without being trigger-happy. Stop there for now: more lists block more but break more, and the Query Log below is where you would diagnose it.

### Confirm it is actually blocking
From any computer on the network, check that a known tracker domain gets blocked — a blocked domain returns `0.0.0.0` or no address:

```bash
nslookup doubleclick.net 192.168.1.53
```

Then open the **Query Log** in the dashboard. You should see live queries from the house flowing in, with blocked ones flagged.

> [!TIP]
> If a site you trust breaks, open the Query Log, find the blocked domain, and click to allow it. That is the normal way to fix the occasional false block — far better than disabling a whole list.

### Make a local name for it
Once the reverse proxy is up and giving services tidy hostnames, AdGuard is also where you point those names at the right container. In **Filters → DNS rewrites**, map a wildcard like `*.example.com` to the proxy's IP so internal hostnames resolve on the LAN — noting a `*.` wildcard matches **subdomains only**, never the bare domain itself; the Reverse Proxy page handles that detail when it creates the real rewrite. You do not do this yet — the proxy does not exist at this point in the build, and the Reverse Proxy page walks through adding the rewrite when it stands up. For now, just note that this dashboard is the place that work happens.

> [!NOTE]
> That is the whole lifecycle for this container: unprivileged, pinned static IP, start-at-boot, run the wizard, point the router at it, verify in the Query Log. Snapshot it before any blocklist experiment or upgrade — rollback is instant if a new list breaks something.
