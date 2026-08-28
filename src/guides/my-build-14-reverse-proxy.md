---
title: Reverse Proxy
subtitle: Clean hostnames and a real lock for every service — no port-forwards
collection: My Build
order: 14
accent: amber
---

By now your bookmarks bar is a wall of IPs and certificate warnings: `https://192.168.1.50:8006` for Proxmox, an HTTP address for Home Assistant, the TrueNAS IP, a Frigate port, an AdGuard dashboard on its own port. A **reverse proxy** ends that. It is one small LXC (Linux Container) that becomes the single address you browse to — you ask for `https://proxmox.example.com`, it forwards the request to `192.168.1.50:8006` behind the scenes, and hands back the answer over a connection covered by one real, browser-trusted certificate that serves every name at once.

The tool here is **Nginx Proxy Manager** (NPM): nginx doing the proxying, with a web interface instead of config files. It runs as another service container on this Proxmox host, alongside AdGuard, Frigate, and the services still to come. Two rules hold throughout: the proxy serves only your LAN (and your tailnet, once remote access is in) — **no router port-forwards, not for this, ever** — and the certificate arrives without exposing anything to the internet.

> [!NOTE]
> This page leans on the stack already built. AdGuard must be the house DNS (Domain Name System) — that is how the new names resolve — and the services you proxy now (Proxmox at `proxmox-ip`, Home Assistant at `ha-ip`, TrueNAS at `truenas-ip`, and the Frigate LXC) need to be up and reachable at their direct addresses first. Nextcloud and Uptime Kuma do not exist yet — you build them later in this build — so their proxy hosts get added when those containers come up; the same Add-Proxy-Host pattern below applies unchanged.

## Stand up the proxy

### Run the install script
Same move as the other service containers: in the Proxmox web interface, click your node, then **Shell**, and run the community-scripts helper (read it first — the download-read-run habit):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/nginxproxymanager.sh)"
```

On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once any of these pages saves defaults), pick **Advanced Install**. Every dialog it can show, in order, with this build's answer:

- **TELEMETRY & DIAGNOSTICS** (first community-script run only, and it appears **before** the menu) → decline — nothing in this build phones home
- **Container type** → **Unprivileged**, as offered — the secure default; nothing here needs host hardware
- **Set Root Password** → set one, recorded in the fields below — blank means a password-less automatic console login; a **Verify Root Password** box repeats a non-blank entry
- **Container ID** → accept the offered next-free number; it is the ID later `pct` commands and Options steps refer to
- **Hostname** → keep the offered name
- **Disk / CPU / RAM** → keep the prefills: **2 cores, 2 GB RAM, 8 GB disk**
- **Network bridge** → **`vmbr0`**
- **IPv4** → **Static (manual entry)**: **`192.168.1.54/24`**, gateway **`192.168.1.1`** — never DHCP
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
- **CONTAINER PROTECTION** → **No** — a proxy rebuilds in minutes, the page-5 rule for skipping it
- **DEVICE NODE CREATION** → **No**, the default
- **MOUNT FILESYSTEMS** → leave **empty**
- **POST-INSTALL HOOK (HOST)** → leave **empty**
- **VERBOSE MODE** → **No**, then review **CONFIRM SETTINGS** and press **Create LXC**
- **Which storage pool?** (two radiolists — container, then template — shown only when more than one pool qualifies; this host's stock local/local-lvm split auto-selects silently) → **local-lvm** for the container, **local** for the template
- **Save advanced settings as default?** → **Yes** — presets a future rebuild; the root password is not saved
- **"An update for the Proxmox LXC stack is available"** (if it appears) → **Ignore** — numbered **2**, or **3** in the four-option variant — host upgrades are the Maintenance page's deliberate job on this pinned-kernel build

> [!INPUT] proxy-console-user | NPM console username | | root

> [!SECRET] proxy-root | NPM container root password
> Set at the wizard's **Set Root Password** prompt; logs into the container's **Console** in Proxmox as `root`.

The script finishes by printing `http://<IP>:81`. Before you open it, set **Options → Start at boot** in Proxmox — from today, a stopped proxy means every name in the house goes dark.

> [!INPUT] proxy-ip | Proxy container IP | 192.168.1.54
> Set statically during the install — in the `.2–.99` static zone, so the router can never hand it out; every name below points here.

> [!NOTE]
> The catalog also carries `npmplus.sh`, a different project despite the similar name. The script above, `nginxproxymanager.sh`, is the one this page is written against.

> [!DETAILS] What the proxy listens on — and what stays shut
> NPM's documentation describes three ports: **80** (its "Public HTTP Port"), **443** ("Public HTTPS Port"), and **81** (the "Admin Web Port"). "Public" there means "the side browsers connect to" — the docs assume some people host internet-facing sites and even suggest forwarding 80 and 443 at the router. You will not. Every port stays LAN-only, the certificate arrives over DNS later with nothing reachable from outside, and your router's settings never change. Port 81 is the admin interface, for you alone.

> [!DETAILS] What's inside the container — and how to update it
> Not Docker, despite most NPM tutorials. The script builds everything from source inside the Debian container: OpenResty (the nginx flavor that does the proxying), the NPM app on Node.js, and Certbot — the Let's Encrypt client with DNS plugins — running as the `openresty` and `npm` systemd services. Settings live in a SQLite file at `/data/database.sqlite`. Two consequences: Docker advice from the wider internet does not apply, and updating has its own command — open the container's **Console** and run `update`. Snapshot the container first.

### Create your admin account
Browse to the proxy at `http://192.168.1.54:81`. There is nothing to log in *with* yet — a fresh install opens on a **"Welcome!"** screen that says **"Get started by creating your admin account."**, with exactly three fields and a **Save** button:

- **Full Name** → yours
- **Email address** → your real one; it becomes the login
- **New Password** → strong, at least 8 characters

**Save** logs you straight in. This login controls where every name in your house points, so record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build). Record it below too so this checklist stands on its own.

> [!INPUT] npm-email | NPM admin email

> [!SECRET] npm-password | NPM admin password

> [!NOTE]
> Older write-ups (and older NPM) start from a default **`admin@example.com`** / **`changeme`** login — v2.13 removed it, so a current install goes straight to the create-account screen above. Do not skip recording the password — the login page has no forgot-password button; recovery is a database edit.

## Get a domain and a wildcard certificate

### Accept what Let's Encrypt will not sign
Browser-trusted certificates come from public certificate authorities, and public authorities only certify *public* names whose ownership they can verify. No authority will ever sign a certificate for a `.home.arpa` or `192.168.x.x` address. So the naming splits in two: **machine hostnames** stay private (the host keeps its `.home.arpa` name), but **service names** — the ones you want locks on — need a small piece of the public namespace you genuinely own.

Buy a real domain, used purely for naming and certificates. Nothing about it will point at your house — no records with your home IP, no exposure. Expect roughly $10–15 a year; judge by the renewal price, not the first-year offer. A zero-cost path (DuckDNS) follows.

> [!DETAILS] The honest alternatives to buying a name
> Two other routes work. Run your own certificate authority with a tool like minica or step-ca and issue certificates for any name you like, fully offline — the catch is installing your authority's root certificate by hand on every Apple device in the house, and that it fails precisely where you need it most: Android apps ignore user-installed CAs by default, and the Bitwarden mobile apps are exactly the kind that refuse a certificate they do not trust. If phone sync for Vaultwarden is one of your reasons for wanting certificates, this route works against you. Or skip certificates entirely: plain-HTTP addresses on your own LAN, wrapped in the encrypted tunnel from remote access when you are away, is a defensible place to stop. This build buys a cheap domain because it is less chore than either.

### Get the domain — and DNS with an API
What matters is not where you buy but where the domain's **DNS is hosted**: the next step needs NPM's built-in Certbot to publish a DNS record through an API (Application Programming Interface). NPM ships support for dozens of providers — Cloudflare, Porkbun, deSEC, Route 53, and more — so register somewhere on that list, or point the domain's nameservers at a host that is. Then create an **API token** scoped to edit only this domain's DNS, per your provider's docs.

Two concrete picks, since "somewhere on that list" is not much help:

- **Cloudflare Registrar** — sells at wholesale with no first-year gimmick and no renewal jump, free DNS, and the best-documented API path in this page. Supports 400+ endings, so selection is not a constraint
- **Porkbun** — the alternative when Cloudflare does not carry the ending you want; honest renewal pricing, free WHOIS privacy, supported API

**Avoid GoDaddy**: heavy upsells, renewals well above the hook price, and API access gated behind account conditions a single-domain owner will not meet. Whatever you choose, judge by the **renewal** price — the $1-first-year endings routinely renew near $40.

> [!NOTE]
> **Pick a name you do not mind being public.** Every Let's Encrypt certificate is published to public **Certificate Transparency** logs, so the domain itself becomes discoverable even though nothing about it resolves or points anywhere near your house. Avoid anything that pins your address or identity. Using a **wildcard** helps: the log records `*.example.com` rather than `frigate.example.com` and `vault.example.com`, so which services you run stays private — a quiet argument for the wildcard beyond convenience. Beyond that the only criteria are short and typeable, since somebody else in the house will eventually type it on a phone. One quirk if you are choosing an ending: **`.dev` and `.app` are HSTS-preloaded**, so browsers force HTTPS on them permanently — fine here, except you could never drop to plain `http://` to troubleshoot. `.com`, `.net`, `.org` and `.xyz` carry no such constraint.

> [!TIP]
> **Two free settings worth taking while you are in the registrar, both aimed at the one job this domain has.**
>
> - **DNSSEC → enable it.** One click at Cloudflare, and the usual footgun does not apply: DNSSEC normally breaks domains when the registrar's DS record drifts from the DNS host's signing key, and here Cloudflare is both. What it buys is narrow but real — your domain publishes nothing except the temporary `_acme-challenge` records Certbot creates, so this protects those from being spoofed by someone trying to obtain a certificate in your name. (Distinct from the DNSSEC you enabled in AdGuard, which *validates* other people's signatures rather than signing yours.)
> - **Add a CAA record → `letsencrypt.org`.** More pointed than DNSSEC for this setup: it declares which certificate authorities may issue for your domain, so no other CA can legitimately mint a certificate for your name even if someone reached your registrar account. One record, precisely aimed at the only thing this domain does.

> [!INPUT] domain-name | Your domain | example.com

> [!SECRET] dns-api-token | DNS provider API token
> Scoped to edit only this domain's DNS — Certbot uses it to prove ownership.

**Creating the token on Cloudflare**, this build's registrar, since "per your provider's docs" is not much of a step:

1. In the Cloudflare dashboard, open **My Profile → API Tokens** and select **Create Token**
2. Choose the **Edit zone DNS** template — it exists precisely for this and pre-fills the right permission
3. **Token name** → something you will recognise in a year, like `npm-certbot`
4. **Permissions** → the template sets **Zone · DNS · Edit**; leave it
5. **Zone Resources** → **Include → Specific zone → your domain**. Not "All zones" — this token should reach exactly one thing
6. **Client IP Address Filtering** and **TTL** → leave both empty; the container's address can change and an expiring token means a silently failed renewal months from now
7. **Continue to summary → Create Token**, then copy it — the value is shown **once**, so put it in the field above and your password manager before leaving the page

Back in NPM, the **Credentials File Content** box wants that token in Certbot's Cloudflare format — replace the prefilled template with:

```ini
dns_cloudflare_api_token = your-token-here
```

Create no other records. No A record with your home IP — nothing about this domain ever points at your house. From outside your LAN the names simply will not resolve, and that is the design working.

> [!DETAILS] The better free path — deSEC
> If the annual cost is the sticking point, **deSEC** beats DuckDNS on every axis and NPM supports it natively. It is run by a German non-profit, hands you a name like `yourname.dedyn.io`, and — unlike DuckDNS — gives you a **real DNS API with proper wildcard support and no one-TXT-record limit**, so certificates behave exactly as they would on a purchased domain. Still a borrowed name and still a third-party dependency, but without the compromises below. Take this over DuckDNS unless you have a specific reason not to.

> [!WARNING]
> **One DuckDNS drawback that bites this build in particular:** `duckdns.org` is a shared parent domain used heavily for malware and phishing, so it turns up periodically on reputation blocklists — potentially including lists **your own AdGuard subscribes to**. Watching your own DNS filter block your own services is a memorable way to spend an evening. A purchased domain or deSEC avoids the issue entirely.

> [!DETAILS] The free path with DuckDNS
> DuckDNS hands out free subdomains of `duckdns.org`. Claim one, copy the token from its dashboard, and your services become `proxmox.yourname.duckdns.org` and friends — NPM's provider list includes **DuckDNS**, credentials a single line: `dns_duckdns_token=your-token`. The trade: longer, visibly borrowed names, and DuckDNS allows only one TXT record at a time, so request exactly one certificate — the wildcard `*.yourname.duckdns.org`, which covers every service anyway. Everywhere below you see `*.example.com`, read your DuckDNS name instead.

### Request the wildcard certificate
In NPM, open **Certificates**, click **Add Certificate**, and choose **Let's Encrypt via DNS** from the dropdown (its siblings are **Let's Encrypt via HTTP** and **Custom Certificate** — neither is for this build) — a wildcard can only be issued over DNS, and in the current interface you pick that route here, up front, rather than with a toggle inside the dialog. Then:

- **Domain Names** — `*.example.com`, your own domain swapped in.
- **Key Type** — leave the default.
- **DNS Provider** — pick yours from the searchable list; the two fields below only appear once a provider is chosen.
- **Credentials File Content** — the box pre-fills a template for the chosen provider; replace the placeholder with your real `dns-api-token`.
- **Propagation Seconds** — leave empty for the plugin's default.

There is no email field or terms-of-service box — Let's Encrypt stopped sending expiry emails in 2025, and current NPM handles the terms agreement itself. (If your NPM instead shows an **SSL Certificates** menu with an email field and an *I Agree* checkbox, it predates the v2.13 interface rewrite — run `update` from the container's Console to come current.)

Save, and after a short wait the certificate appears, valid for every name under your domain. If it fails on timing, set **Propagation Seconds** to something patient like `120` and try again.

> [!NOTE]
> The dialog warns that these credentials are stored as plaintext in NPM's database and in a file. That is the trade for hands-off issuance and renewal: the proxy keeps your DNS token. A tightly scoped token and a strong NPM admin password are the mitigations.

> [!DETAILS] Covering the bare domain too
> A wildcard covers `anything.example.com` but not plain `example.com`. Every service on this page lives on a subdomain, so you may never care — but if you want the bare name to work, add `example.com` alongside `*.example.com` in the same certificate's Domain Names, and add a second, exact DNS rewrite for it in AdGuard (the next phase). Skip this on DuckDNS, where the one-TXT-record limit makes the combined request unreliable.

> [!DETAILS] Why no ports opened for this
> What ran was a **DNS-01 challenge**: Certbot used your token to publish a temporary TXT record at `_acme-challenge.example.com`, Let's Encrypt looked it up in public DNS, confirmed you control the domain, and issued. No connection to your network was ever attempted. DNS-01 is also the only challenge that can issue wildcards — and the only one that needs no inbound port, which is exactly why this build uses it. Renewals repeat the dance with the stored token, untouched by you.

## Teach the LAN the names

### Point the wildcard at the proxy
In the AdGuard dashboard, open **Filters → DNS rewrites** and click **Add DNS rewrite**. Domain: `*.example.com`. Answer: your `proxy-ip`. With the wildcard, every name under your domain now answers with the proxy's address for every device that asks AdGuard. Verify from any computer in the house:

```bash
nslookup proxmox.example.com
```

Expect the proxy's IP. The names resolve; nothing answers on them yet — that is the next phase.

> [!DETAILS] Carrying the names with you over Tailscale
> These names exist only inside AdGuard, so a phone off the LAN will not find them on its own. Once remote access is set up on the next page, the names can travel: on the Tailscale admin console's DNS page, add AdGuard's LAN IP under **Global nameservers** and enable **Override DNS servers** — tailnet devices then resolve through AdGuard, and `https://proxmox.example.com` works from anywhere the subnet route reaches. The trade: with Override on, the phone's DNS depends on the server being up. The gentler variant is split DNS — send only `example.com` lookups to AdGuard and leave the rest of the phone alone.

## Put every service behind it

### Give Proxmox the first name
The pattern you repeat for everything: in NPM, open **Hosts → Proxy Hosts** and click **Add Proxy Host**. The dialog has four tabs — **Details**, **Custom Locations**, **SSL**, and an **Advanced** gear at the right end of the tab bar; only Details and SSL get touched, for every host on this page. On the **Details** tab:

- **Domain Names**: `proxmox.example.com`
- **Scheme**: `https` — Proxmox speaks HTTPS on its own port
- **Forward Hostname / IP**: your `proxmox-ip`
- **Forward Port**: `8006`
- **Websockets Support**: on — the noVNC console you use as the server's screen rides on a websocket and dies without it
- **Access List**: leave **Publicly Accessible** — no basic-auth gate in front; each service keeps its own login
- **Cache Assets**: off, the default — caching admin UIs trades staleness for nothing here
- **Block Common Exploits**: off, the default — a blunt pattern filter that can break legitimate app traffic

Then the **SSL** tab, every field:

- **SSL Certificate** → the `*.example.com` certificate — not the dropdown's tempting **Request a new Certificate** entry (the wildcard already exists; **None** is the do-nothing default you are replacing)
- **Force SSL** → **on** — any plain-HTTP request redirects to HTTPS; it unlocks once a certificate is selected
- **HTTP/2 Support**, **HSTS Enabled**, **HSTS Sub-domains** → off, the defaults — none earns its keep on a LAN
- the tab's **Advanced** collapsible (Trust Upstream Forwarded Proto Headers) → leave collapsed

Save, then browse to `https://proxmox.example.com`: the familiar login, a real padlock, nothing to click through.

> [!NOTE]
> The proxy now talks to Proxmox's self-signed certificate and does not verify upstream certificates by default, so this just works. The warning you have clicked past since install was not fixed so much as moved to an encrypted-but-unverified hop inside your own LAN — a fair trade at home, and the browsers in your house never see it again.

### Tell Home Assistant to trust the proxy
Add the next host the same way — `ha.example.com`, Scheme `http`, Forward to your `ha-ip`, port `8123`, **Websockets Support** on, then the same SSL tab (wildcard certificate, **Force SSL**). Browse to `https://ha.example.com` and meet a deliberate roadblock: a bare **400: Bad Request**. Home Assistant OS refuses proxied requests until you name your proxy.

The fix lives in the **Home Assistant UI** (`192.168.1.51:8123`), not NPM — as of Home Assistant 2026.8 it is a settings screen, not a YAML edit. Go to **Settings → System → Network**, scroll to the **HTTP server** section, and set two things:

- **Trust X-Forwarded-For** → **on** — lets HA read the real client address the proxy passes along
- **Trusted proxies** → add **`192.168.1.54`** — the only machine allowed to speak for clients

Saving **restarts Home Assistant by itself** — and then comes the step people miss: after the restart, HA asks an administrator to **confirm the new network settings within five minutes**, or it reverts them (a guard against locking yourself out with a bad proxy config). Confirm, then reload `https://ha.example.com` — the normal dashboard, behind a real lock.

> [!DETAILS] Reading the 400 if it persists
> The browser only shows the bare 400; the explanation is in Home Assistant's log (**Settings → System → Logs**). "Not set-up for reverse proxies" means the settings have not applied — check they survived the five-minute confirmation. "Received X-Forwarded-For header from an untrusted proxy" means the address under Trusted proxies does not match the proxy's. A history note, because old write-ups still show it: this used to be an `http:` block in `configuration.yaml`. On 2026.8 and later that YAML was imported once, at migration, and is **ignored afterwards** — adding it fresh does nothing but raise a Repairs issue — so make the change in the UI. And one forward-looking quirk: a *fresh* HAOS install now serves port **80** by default; existing installs like this one keep `8123`, but if HA is ever rebuilt, this proxy host's Forward Port follows it. The pattern generalizes — if a service errors through its new name but works by IP, hunt its settings for a "trusted proxy" or "allowed hosts" option.

### Work down the rack
More proxy hosts, same dialog. Every one gets the wildcard certificate and **Force SSL** on the SSL tab, and **Websockets Support** on — some need it outright and it is harmless elsewhere. The two services up at this point:

- **TrueNAS** — `nas.example.com`, Scheme `http`, forwarding to `192.168.1.20`, port `80` — the address you browse to today, just named.
- **Frigate** — `frigate.example.com`, Scheme **`https`** — Frigate ships TLS (Transport Layer Security) on at 8971 with its own self-signed certificate, and the proxy forwards to it without verifying, exactly as it does for Proxmox — the Frigate LXC's IP, port **`8971`** — deliberately *not* `5000`. The warning below is why.

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> The container running detection on the 1080 Ti — proxy its authenticated port, not the internal one.

> [!WARNING]
> Frigate splits its two ports: **8971** is the authenticated UI and API that reverse proxies should use, while **5000** is internal, unauthenticated access treated as admin regardless of login. Proxying 5000 would hand admin to anything that can resolve the name. Use 8971, and leave 5000 as the internal address the Home Assistant integration talks to.

More proxy hosts get added later, once their containers exist — come back and repeat this exact Add-Proxy-Host pattern each time a later page brings a new service up. Two you already know are coming:

- **Nextcloud** (built later in this build) — `cloud.example.com`, Scheme `https`, the Nextcloud IP, port `443`. The first visit stops at **Access through untrusted domain**; the fix is in the Nextcloud page (and recapped below for when you reach it).
- **Uptime Kuma** (built later in this build) — `status.example.com`, Scheme `http`, the Kuma IP, port `3001`. It is built on WebSocket, so with the toggle off the dashboard never loads — leave **Websockets Support** on.

> [!DETAILS] Frigate's "plain HTTP request was sent to HTTPS port"
> If `frigate.example.com` answers with a 400 carrying that phrase, the proxy host's **Scheme** got set to `http` while Frigate's own TLS sits on at 8971 — its default. Fix it in NPM: edit the proxy host, flip Scheme to `https`, save; Frigate itself needs no change. (Old write-ups instead disable Frigate's TLS with a `tls: enabled: false` config block. That works, but this build keeps Frigate's TLS on — the admin login then never crosses the LAN in the clear, and every page here points at `https://192.168.1.52:8971` consistently.)

> [!DETAILS] Telling Nextcloud about its new name (for when you build it)
> Nextcloud comes later in this build; keep this for then. Two settings, both from the Nextcloud container's console at `/var/www/nextcloud` via the `occ` tool. First, the untrusted-domain page — add the new name at the next free index:
>
> ```bash
> sudo -E -u www-data php occ config:system:get trusted_domains
> sudo -E -u www-data php occ config:system:set trusted_domains 3 --value=cloud.example.com
> ```
>
> Second, the reverse-proxy settings:
>
> ```bash
> sudo -E -u www-data php occ config:system:set trusted_proxies 0 --value=192.168.1.54
> sudo -E -u www-data php occ config:system:set overwriteprotocol --value=https
> sudo -E -u www-data php occ config:system:set overwrite.cli.url --value=https://cloud.example.com
> ```
>
> Existing sync clients signed in against the IP keep working as long as that IP stays in `trusted_domains`; set up new devices with the new name.

> [!TIP]
> When you later build Uptime Kuma and put it behind the proxy, tell it so: **Settings → Reverse Proxy**, and under HTTP Headers set **Trust Proxy** on — its logs and rate limiting then see real client IPs instead of the proxy's.

### Decide what keeps its number
Walk the bookmarks bar and replace what you have today: `proxmox.`, `ha.`, `nas.`, `frigate.` — `cloud.`, `status.`, and more join the set as later pages bring their services up, every name behind the same lock, and Force SSL means even a typed `http://` lands on HTTPS. Three addresses deliberately stay raw, because they are the system's own foundations:

- **NPM's admin interface** at `http://192.168.1.54:81`. When the proxy is the thing that is sick, a name routed through itself is no way to reach its controls.
- **AdGuard's dashboard** at `192.168.1.53`. The names are answered there — if AdGuard is down, every name is down with it.
- **Proxmox** at `https://192.168.1.50:8006`, the emergency door. A stopped proxy container takes every name with it; this is the address you start it again from.

Machine-to-machine settings keep their IPs too. The Home Assistant ↔ Frigate integration stays on the LAN address at port `5000`, and Uptime Kuma's monitors should keep watching services at their direct addresses — through the proxy, every alert would be ambiguous (service down, or proxy down?). If you want the front door watched as well, add one HTTP(s) monitor pointed at a proxied name — that single check exercises the DNS rewrite, the proxy, and the certificate in one pass.
