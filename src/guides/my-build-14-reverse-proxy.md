---
title: Reverse Proxy
subtitle: Clean hostnames and a real lock for every service — no port-forwards
collection: My Build
order: 14
accent: amber
---

By now your bookmarks bar is a wall of IPs and certificate warnings: `https://192.168.1.50:8006` for Proxmox, an HTTP address for Home Assistant, the TrueNAS IP, a Frigate port, an AdGuard dashboard on its own port. A **reverse proxy** ends that. It is one small LXC (Linux Container) that becomes the single address you browse to — you ask for `https://proxmox.kuzco.org`, it forwards the request to `192.168.1.50:8006` behind the scenes, and hands back the answer over a connection covered by one real, browser-trusted certificate that serves every name at once.

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
> **Pick a name you do not mind being public.** Every Let's Encrypt certificate is published to public **Certificate Transparency** logs, so the domain itself becomes discoverable even though nothing about it resolves or points anywhere near your house. Avoid anything that pins your address or identity. Using a **wildcard** helps: the log records `*.kuzco.org` rather than `frigate.kuzco.org` and `vault.kuzco.org`, so which services you run stays private — a quiet argument for the wildcard beyond convenience. Beyond that the only criteria are short and typeable, since somebody else in the house will eventually type it on a phone. One quirk if you are choosing an ending: **`.dev` and `.app` are HSTS-preloaded**, so browsers force HTTPS on them permanently — fine here, except you could never drop to plain `http://` to troubleshoot. `.com`, `.net`, `.org` and `.xyz` carry no such constraint.

> [!WARNING]
> **Two reasons not to grab the cheapest ending on the list.** Most of the usual objections do not apply to a domain that hosts nothing and sends no mail — but these two do:
>
> - **Heavily abused TLDs get blocked wholesale.** `.win`, `.top`, `.click`, `.gq`, `.tk` and their cousins are cheap because they are saturated with malware and phishing, and blocklists answer by blocking the entire ending — potentially including **the lists this build subscribes to in AdGuard**. Your own filter refusing to resolve your own services, months after you set it up, is a bad afternoon
> - **`.us` prohibits WHOIS privacy.** The US registry mandates accurate, publicly queryable registrant details and forbids proxy services, so your name and contact information become public. Every other ending here comes with free WHOIS privacy
>
> `.com`, `.net` or `.org` at roughly $10–15 avoid both, and `.xyz` is a legitimate cheap option these days. The saving on a bargain ending is a few dollars a year on a build with seven cameras in it.

> [!INPUT] domain-name | Your domain | kuzco.org

Buy it, and stop there — the token and the certificate are separate steps below. Create no records of your own: no A record with your home IP, nothing pointing at your house. From outside your LAN these names will simply not resolve, and that is the design working.

### Harden the domain before moving on
Eight things, ordered by what hurts most if skipped. Cloudflare splits these across two levels, and mixing them up is the main reason a setting looks missing:

- **Zone** settings — DNS records, SSL/TLS, DNSSEC. Reached by clicking the domain from the dashboard home
- **Registrar** settings — auto-renew, transfer lock, WHOIS contacts. Reached by leaving the zone (**Back to Domains** at the top of the sidebar), then **Domains → Registrations → your domain**, which opens on three tabs: **Overview** (auto-renew and expiry), **Contact** (registrant details), and **Settings** (DNSSEC status, WHOIS privacy, transfer lock, and the delete button — leave that one alone)



1. **Two-factor authentication** → **My Profile → Authentication**, the same profile menu as the API token below. The highest-value item on this page: that account controls DNS for the domain every certificate in the house depends on, so anyone inside it could redirect your names or issue certificates as you. TOTP or a hardware key, before anything else.

   **If you signed up with Sign in with Apple (or Google), that page will not let you.** Cloudflare accounts authenticating through SSO **cannot configure 2FA at all** — a documented limitation, not a password problem. You are not unprotected: Apple mandates two-factor on Apple IDs and it is hardware-backed on your own devices, so the account has a second factor, just Apple's rather than Cloudflare's. That is the same posture the Remote Access page takes for the tailnet. Harden the identity that now carries the weight — confirm Apple ID two-factor is on, trusted numbers are current, and a **recovery key or recovery contacts** exist. The failure mode is slow rather than sudden: an Apple lockout would cost certificate renewals on their 90-day cycle and the domain at its annual one, leaving weeks to recover. If native 2FA matters more than that, the cheapest moment to move to an email-and-password account is now, while the account holds one domain and nothing else — though a new registration carries a 60-day ICANN transfer lock
2. **Auto-renew on** → **Domain Registration → Manage domains → your domain → Manage domain**, where the Auto-Renew status lives. Use a registrant email you will still read in three years — a lapsed domain breaks every hostname and every certificate at once, and presents as a network fault rather than an expiry
3. **DNSSEC** → click the **domain**, then **DNS → Settings → Enable DNSSEC**. One click here and nothing else: because Cloudflare is both registrar and DNS host it **publishes the DS record itself**, which is the step that breaks DNSSEC for people whose registrar and DNS are separate
4. **CAA record** → click the **domain** first (this is zone-level, which is why it looks missing from the account home), then **DNS → Records → Add record**, and fill the form:
   - **Type** → **CAA**
   - **Name** → **`@`**, the root of the domain
   - **Tag** → **"Only allow specific hostnames"** — Cloudflare's friendly label for the `issue` tag
   - **CA domain name** → **`letsencrypt.org`**
   - **TTL** → **Auto**, then **Save**

   That one record is enough. It looks like a wildcard certificate would need a second rule, but the spec applies `issue` to wildcards whenever no wildcard-specific rule exists — so the dropdown's other options, *Only allow wildcards* (`issuewild`) and *Send violation reports to* (`iodef`), stay unused. The effect: no certificate authority other than Let's Encrypt can legitimately issue for your name
5. **Declare that the domain sends no mail.** You will never send from it, which currently leaves it free for anyone to spoof in phishing. Three records on the same **DNS → Records** page close that permanently:
   - **TXT**, name `@`, content `v=spf1 -all`
   - **TXT**, name `_dmarc`, content `v=DMARC1; p=reject;`
   - **MX**, name `@`, server `.`, priority `0`
6. **Settle the certificate settings the registrar runs on your behalf.** Cloudflare issues its own **Universal SSL** certificate for every zone, which is why a warning appears beside your CAA record saying *"Cloudflare will respond with additional CAA records"* — it injects entries permitting its own authorities so its issuance keeps working, quietly widening the restriction you just wrote. Under **SSL/TLS → Edge Certificates**:
   - **Disable Universal SSL** — the button's warning that "visitors will be unable to access the domain over HTTPS" does not apply here: nothing is hosted at or proxied through Cloudflare, and the certificate this build actually uses comes from Let's Encrypt through NPM over the DNS API, entirely independently. Disabling stops certificates being minted in your name for a service you do not use, and makes the CAA record mean what it says
   - **Certificate Transparency Monitoring → on** — free, and it emails you whenever any authority issues a certificate for your domain. It is the natural partner to the CAA record: CAA *prevents* unauthorised issuance, this *tells you* when something was issued anyway. Your own renewals will generate a notice every couple of months, which is confirmation rather than noise
   - **Always Use HTTPS**, **HSTS**, **Automatic HTTPS Rewrites**, **Total TLS**, and anything gated behind Advanced Certificate Manager → leave them. All of them act on traffic proxied through Cloudflare, and none of your traffic is
7. **Ignore the registrar's own recommendations.** Cloudflare will show a Recommendations panel urging you to add an A record so "visitors can reach" your domain, a `www` record, and MX records to receive mail. Every one of them assumes you are publishing a website, and acting on the A-record suggestion would point your domain at a real host on the public internet — exactly what this design forbids. The mail suggestion is already answered better than they propose: you are declaring that the domain sends and receives nothing, rather than configuring it to. The panel never goes away, and its persistence is confirmation the domain is doing its job
8. **Verify what is already on** → the registrar **Settings** tab, where **WHOIS privacy** should read *data redaction is currently enabled* (the button offers *Disable*, which is the action, not the state) and **Transfer to another registrar** should be locked — on a fresh registration the Unlock control is greyed out with *domain created within the last 60 days*, which is ICANN's new-registration lock doing a transfer lock's job for you. Then **DNS → Records** to confirm the list is otherwise **empty** — the only entries that should ever appear there are the `_acme-challenge` records Certbot creates and deletes during issuance

That last check is the one the build's threat model rests on: a domain that resolves to nothing publicly is what stops a purchased name from becoming an attack surface.

### Create the DNS API token
NPM's built-in Certbot proves you own the domain by publishing a temporary record into its DNS, which means it needs an API token scoped to exactly that. Make it now; you paste it in the next step.

> [!INPUT] dns-token-name | Cloudflare API token name | npm-certbot
> The label the token carries in Cloudflare's list — the only thing identifying it when you come back to revoke or rotate it. Name it after what holds it and what it does.

> [!SECRET] dns-api-token | DNS provider API token
> Scoped to edit only this domain's DNS. Shown once at creation; the field above records which token in Cloudflare this value belongs to.

On **Cloudflare**, this build's registrar:

1. In the dashboard, open **My Profile → API Tokens** and select **Create Token**
2. Choose the **Edit zone DNS** template — it exists precisely for this and pre-fills the right permission
3. **Token name** → the name from the field above
4. **Permissions** → the template sets **Zone · DNS · Edit**; leave it
5. **Zone Resources** → **Include → Specific zone → your domain**. Not "All zones" — this token should reach exactly one thing
6. **Client IP Address Filtering** and **TTL** → leave both empty; the container's address can change, and an expiring token means a renewal that fails silently months from now
7. **Continue to summary → Create Token**, then copy the value into the field above and your password manager — it is shown **once**

> [!DETAILS] The better free path — deSEC
> If the annual cost is the sticking point, **deSEC** beats DuckDNS on every axis and NPM supports it natively. It is run by a German non-profit, hands you a name like `yourname.dedyn.io`, and — unlike DuckDNS — gives you a **real DNS API with proper wildcard support and no one-TXT-record limit**, so certificates behave exactly as they would on a purchased domain. Still a borrowed name and still a third-party dependency, but without the compromises below. Take this over DuckDNS unless you have a specific reason not to.

> [!WARNING]
> **One DuckDNS drawback that bites this build in particular:** `duckdns.org` is a shared parent domain used heavily for malware and phishing, so it turns up periodically on reputation blocklists — potentially including lists **your own AdGuard subscribes to**. Watching your own DNS filter block your own services is a memorable way to spend an evening. A purchased domain or deSEC avoids the issue entirely.

> [!DETAILS] The free path with DuckDNS
> DuckDNS hands out free subdomains of `duckdns.org`. Claim one, copy the token from its dashboard, and your services become `proxmox.yourname.duckdns.org` and friends — NPM's provider list includes **DuckDNS**, credentials a single line: `dns_duckdns_token=your-token`. The trade: longer, visibly borrowed names, and DuckDNS allows only one TXT record at a time, so request exactly one certificate — the wildcard `*.yourname.duckdns.org`, which covers every service anyway. Everywhere below you see `*.kuzco.org`, read your DuckDNS name instead.

### Request the wildcard certificate
In NPM, open **Certificates**, click **Add Certificate**, and choose **Let's Encrypt via DNS** from the dropdown (its siblings are **Let's Encrypt via HTTP** and **Custom Certificate** — neither is for this build) — a wildcard can only be issued over DNS, and in the current interface you pick that route here, up front, rather than with a toggle inside the dialog. Then:

- **Domain Names** — `*.kuzco.org`, your own domain swapped in.
- **Key Type** — leave the default.
- **DNS Provider** — pick yours from the searchable list; the two fields below only appear once a provider is chosen.
- **Credentials File Content** — the box pre-fills a template for the chosen provider; replace it entirely with your real token in Certbot's Cloudflare format:

  ```ini
  dns_cloudflare_api_token = your-token-here
  ```

- **Propagation Seconds** — leave empty for the plugin's default.

There is no email field or terms-of-service box — Let's Encrypt stopped sending expiry emails in 2025, and current NPM handles the terms agreement itself. (If your NPM instead shows an **SSL Certificates** menu with an email field and an *I Agree* checkbox, it predates the v2.13 interface rewrite — run `update` from the container's Console to come current.)

Save, and after a short wait the certificate appears, valid for every name under your domain.

It will show an expiry roughly **90 days** out, which is normal rather than a problem: Let's Encrypt issues short-lived certificates deliberately, to limit the damage window if a key leaks and to force renewal to be automatic rather than a calendar reminder. NPM renews it at around 30 days remaining by repeating the DNS challenge with the stored token — nothing for you to do. It is also why the token was created without a TTL: an expiring token turns renewal into a silent failure that surfaces months later as certificate errors on every service at once. If Certificate Transparency Monitoring is on at the registrar, each renewal emails you, which doubles as passive proof the automation is alive. If it fails on timing, set **Propagation Seconds** to something patient like `120` and try again.

> [!NOTE]
> The dialog warns that these credentials are stored as plaintext in NPM's database and in a file. That is the trade for hands-off issuance and renewal: the proxy keeps your DNS token. A tightly scoped token and a strong NPM admin password are the mitigations.

> [!DETAILS] Covering the bare domain too
> A wildcard covers `anything.kuzco.org` but not plain `kuzco.org`. Every service on this page lives on a subdomain, so you may never care — but if you want the bare name to work, add `kuzco.org` alongside `*.kuzco.org` in the same certificate's Domain Names, and add a second, exact DNS rewrite for it in AdGuard (the next phase). Skip this on DuckDNS, where the one-TXT-record limit makes the combined request unreliable.

> [!DETAILS] Why no ports opened for this
> What ran was a **DNS-01 challenge**: Certbot used your token to publish a temporary TXT record at `_acme-challenge.kuzco.org`, Let's Encrypt looked it up in public DNS, confirmed you control the domain, and issued. No connection to your network was ever attempted. DNS-01 is also the only challenge that can issue wildcards — and the only one that needs no inbound port, which is exactly why this build uses it. Renewals repeat the dance with the stored token, untouched by you.

## Teach the LAN the names

### Point the wildcard at the proxy
In the AdGuard dashboard, open **Filters → DNS rewrites** and click **Add DNS rewrite**:

- **Domain** → `*.kuzco.org`
- **Answer** → your `proxy-ip`

With the wildcard, every name under your domain now answers with the proxy's address for every device that asks AdGuard.

A wildcard covers subdomains only, never the bare domain, so **add a second rewrite** — domain `kuzco.org`, same answer — if you included the bare name on the certificate. Two entries, one for `*.kuzco.org` and one for `kuzco.org`.

Verify from the **Mac**, in **Terminal**:

```bash
nslookup proxmox.kuzco.org
```

Expect the proxy's IP. The names resolve; nothing answers on them yet — that is the next phase.

> [!WARNING]
> **Read the `Server:` line in that output before believing the result.** It names the resolver that actually answered, and it should be your router or AdGuard. Anything else — a `100.64.x` address especially — means a **VPN client on that machine is intercepting DNS**, the query never reached AdGuard, and the `No answer` you are looking at says nothing about whether the rewrite works. These names exist only inside your AdGuard, so they cannot resolve through any tunnelled resolver. Disconnect the VPN and run it again. This will recur for as long as that machine runs a consumer VPN, so make the `Server:` line the first thing you check whenever a name misbehaves.

> [!TIP]
> **A name that failed once can keep failing after you fix it.** Resolvers cache negative answers as well as positive ones, so any lookup you tried *before* the rewrite existed — or through a VPN's resolver — leaves the router holding a "does not exist" result for minutes afterwards. It will serve that cached failure back to you while a direct query to AdGuard answers perfectly, which looks exactly like a broken configuration. Two ways to tell them apart: query a **name you have never asked for before** (if a fresh name resolves and the old one does not, it is the cache), or reboot the router to clear it outright.

> [!DETAILS] Carrying the names with you over Tailscale
> These names exist only inside AdGuard, so a phone off the LAN will not find them on its own. Once remote access is set up on the next page, the names can travel: on the Tailscale admin console's DNS page, add AdGuard's LAN IP under **Global nameservers** and enable **Override DNS servers** — tailnet devices then resolve through AdGuard, and `https://proxmox.kuzco.org` works from anywhere the subnet route reaches. The trade: with Override on, the phone's DNS depends on the server being up. The gentler variant is split DNS — send only `kuzco.org` lookups to AdGuard and leave the rest of the phone alone.

## Put every service behind it

### Give Proxmox the first name
The pattern you repeat for everything — in NPM, **Hosts → Proxy Hosts → Add Proxy Host**, then on the **Details** tab:

- **Domain Names**: `proxmox.kuzco.org`
- **Scheme**: `https` — Proxmox speaks HTTPS on its own port
- **Forward Hostname / IP**: your `proxmox-ip`
- **Forward Port**: `8006`
- **Websockets Support**: on — the noVNC console you use as the server's screen rides on a websocket and dies without it
- **Access List**: leave **Publicly Accessible** — no basic-auth gate in front; each service keeps its own login
- **Cache Assets**: off, the default — caching admin UIs trades staleness for nothing here
- **Block Common Exploits**: off, the default — a blunt pattern filter that can break legitimate app traffic

Then the **SSL** tab, every field:

- **SSL Certificate** → the `*.kuzco.org` certificate — not the dropdown's tempting **Request a new Certificate** entry (the wildcard already exists; **None** is the do-nothing default you are replacing)
- **Force SSL** → **on** — any plain-HTTP request redirects to HTTPS; it unlocks once a certificate is selected
- **HTTP/2 Support**, **HSTS Enabled**, **HSTS Sub-domains** → off, the defaults — none earns its keep on a LAN
- the tab's **Advanced** collapsible (Trust Upstream Forwarded Proto Headers) → leave collapsed

Save, then browse to `https://proxmox.kuzco.org`: the familiar login, a real padlock, nothing to click through.

> [!NOTE]
> The dialog has four tabs — **Details**, **Custom Locations**, **SSL**, and an **Advanced** gear at the right end of the tab bar. Only Details and SSL get touched, for every host on this page.

> [!NOTE]
> The proxy now talks to Proxmox's self-signed certificate and does not verify upstream certificates by default, so this just works. The warning you have clicked past since install was not fixed so much as moved to an encrypted-but-unverified hop inside your own LAN — a fair trade at home, and the browsers in your house never see it again.

### Tell Home Assistant to trust the proxy
Add the next host the same way — **Hosts → Proxy Hosts → Add Proxy Host**:

- **Domain Names** → `ha.kuzco.org`
- **Scheme** → `http`
- **Forward Hostname / IP** → `192.168.1.51`
- **Forward Port** → `8123`
- **Websockets Support** → **on**
- **SSL tab** → the `*.kuzco.org` wildcard, **Force SSL** → **on**

Save and browse to `https://ha.kuzco.org` — a deliberate roadblock: a bare **400: Bad Request**. Home Assistant OS refuses proxied requests until you name your proxy.

The fix lives in the **Home Assistant UI** at `http://192.168.1.51:8123`, not in NPM — since Home Assistant 2026.8 it is a settings screen, not a YAML edit:

1. **Settings → System → Network**, then scroll to the **HTTP server** section. Not there? Your Home Assistant predates it — see the callout below.
2. **Trust X-Forwarded-For** → **on** — lets HA read the real client address the proxy passes along.
3. **Trusted proxies** → add `192.168.1.54` — the only machine allowed to speak for clients.
4. **Save** — Home Assistant restarts itself.
5. After the restart, HA asks an administrator to **confirm the new network settings within five minutes** — confirm, or it reverts them (a guard against locking yourself out with a bad proxy config).
6. Reload `https://ha.kuzco.org` — the normal dashboard, behind a real lock.

> [!NOTE]
> The trusted proxy saves back as `192.168.1.54/32` — the same single address written as a one-address network, not a sign anything went wrong. Leave it that narrow; if you ever do mean a whole subnet, Home Assistant wants the *network* address there (`192.168.1.0/24`), never a host address wearing a broad mask (`192.168.1.54/24`).

> [!IMPORTANT]
> **No HTTP server section on that page? Update Home Assistant first.** That screen arrived in **2026.8** (5 August 2026); on anything older these two settings exist only as an `http:` block in `configuration.yaml`, which on HAOS means installing a file-editor app purely to write four lines the next upgrade deprecates. Skip that: **Settings → System → Updates → Home Assistant Core**, then come back and the section is there. Two reassurances before you press it, since this build otherwise defers updates until the collection is finished:
>
> - **Your port does not move.** 2026.8 changed the HAOS default to **80**, but only for brand-new installs — the release notes are explicit that ["If you are already running Home Assistant, nothing changes and there is nothing you need to do."](https://www.home-assistant.io/blog/2026/08/05/release-20268/) This VM keeps `8123`, so the proxy host you just built stays correct.
> - **Nothing else in the collection depends on the older version.** Zigbee2MQTT, Mosquitto, Matter Server and the Frigate integration are apps and HACS components with their own versions; a Core update does not disturb them.

> [!DETAILS] Reading the 400 if it persists
> The browser only shows the bare 400; the explanation is in Home Assistant's log (**Settings → System → Logs**). "Not set-up for reverse proxies" means the settings have not applied — check they survived the five-minute confirmation. "Received X-Forwarded-For header from an untrusted proxy" means the address under Trusted proxies does not match the proxy's. A history note, because old write-ups still show it: this used to be an `http:` block in `configuration.yaml`. On 2026.8 and later that YAML was imported once, at migration, and is **ignored afterwards** — adding it fresh does nothing but raise a Repairs issue — so make the change in the UI. And one forward-looking quirk: a *fresh* HAOS install now serves port **80** by default; existing installs like this one keep `8123`, but if HA is ever rebuilt, this proxy host's Forward Port follows it. The pattern generalizes — if a service errors through its new name but works by IP, hunt its settings for a "trusted proxy" or "allowed hosts" option.

### Work down the rack
Every remaining host is the **same dialog with four fields changed**. Nothing else varies — so rather than repeat the walk, here is the whole set in one place.

**Identical on every host**, without exception:

| Field | Value |
|---|---|
| Websockets Support | **on** |
| Access List | Publicly Accessible |
| Cache Assets | off |
| Block Common Exploits | off |
| SSL Certificate | the `*.kuzco.org` wildcard |
| Force SSL | **on** |
| HTTP/2, HSTS, HSTS Sub-domains | off |
| Custom Locations, Advanced tab | untouched |

**The four fields that change**, one row per host:

| Domain Names | Scheme | Forward Hostname / IP | Forward Port | Built on |
|---|---|---|---|---|
| `proxmox.kuzco.org` | **https** | `192.168.1.50` | `8006` | done above |
| `ha.kuzco.org` | http | `192.168.1.51` | `8123` | done above |
| `nas.kuzco.org` | http | `192.168.1.20` | `80` | now |
| `frigate.kuzco.org` | **https** | `192.168.1.52` | `8971` | now |
| `cloud.kuzco.org` | **https** | `192.168.1.58` | `443` | Nextcloud page |
| `vault.kuzco.org` | http | `192.168.1.56` | `8000` | Vaultwarden page |
| `home.kuzco.org` | http | `192.168.1.55` | `3000` | Homepage page |
| `status.kuzco.org` | http | `192.168.1.57` | `3001` | Uptime Kuma page |

**Create all eight in one sitting**, while the pattern is fresh — the better use of the time than the first four now and the rest as their pages arrive.

> [!NOTE]
> Forwarding is by IP, so nginx has nothing to resolve and reloads cleanly whether or not the container exists yet; a name whose service is not built simply returns **502 Bad Gateway** until it is — **502 means "not built yet", not "broken"**, worth remembering before you debug a proxy that is behaving perfectly. Doing them together also avoids the classic omission: one host added alone weeks later, missing Websockets or the certificate. And pre-creating a host does **not** do the service-side configuration in the table below — that still happens on each service's own page.

**Three services also need telling, on their own side** — the proxy host alone is not enough, and each fails in its own way through the new name while working fine by IP:

| Service | Where | What |
|---|---|---|
| Home Assistant | Settings → System → Network | Trust X-Forwarded-For on, proxy IP in Trusted proxies — **done above**, with the five-minute confirmation |
| Nextcloud | container console, `occ` | `trusted_domains`, `trusted_proxies`, `overwriteprotocol`, `overwrite.cli.url` — see below |
| Uptime Kuma | Settings → Reverse Proxy | Trust Proxy on |

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> The container running detection on the 1080 Ti — proxy its authenticated port, not the internal one.

> [!WARNING]
> Frigate splits its two ports: **8971** is the authenticated UI and API that reverse proxies should use, while **5000** is internal, unauthenticated access treated as admin regardless of login. Proxying 5000 would hand admin to anything that can resolve the name. Use 8971, and leave 5000 as the internal address the Home Assistant integration talks to.

> [!DETAILS] Frigate's "plain HTTP request was sent to HTTPS port"
> If `frigate.kuzco.org` answers with a 400 carrying that phrase, the proxy host's **Scheme** got set to `http` while Frigate's own TLS sits on at 8971 — its default. Fix it in NPM: edit the proxy host, flip Scheme to `https`, save; Frigate itself needs no change. (Old write-ups instead disable Frigate's TLS with a `tls: enabled: false` config block. That works, but this build keeps Frigate's TLS on — the admin login then never crosses the LAN in the clear, and every page here points at `https://192.168.1.52:8971` consistently.)

> [!DETAILS] Telling Nextcloud about its new name (for when you build it)
> Nextcloud comes later in this build; keep this for then. Two settings, both from the Nextcloud container's console at `/var/www/nextcloud` via the `occ` tool.
>
> Every hostname below is this build's real one, `kuzco.org` — the same value the *Your domain* field above records. The index is **not** a fixed number: run the `get` on its own first, count the entries it prints starting at **0**, and use the next number after the last one. A NextcloudPi install ships with roughly **eight** already (`localhost`, several `nextcloudpi` variants, the container IP, the detected public IP), so the next free index is usually **8** — reusing a number that is already listed silently overwrites that entry instead of adding yours.
>
> ```bash
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:get trusted_domains
> ```
>
> Then, with the real domain and the index you just counted:
>
> ```bash
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:set trusted_domains 8 --value=cloud.kuzco.org
> ```
>
> Second, the reverse-proxy settings. **`trusted_proxies` is indexed the same way, and on NextcloudPi index `0` is already taken** — a fresh NCP install ships `127.0.0.1` at `0` and `::1` at `1`, both used by its own local plumbing, so the proxy goes at **`2`**. Confirm with a read first; if your list differs, use whatever number comes after the last one:
>
> ```bash
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:get trusted_proxies
> ```
>
> ```bash
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:set trusted_proxies 2 --value=192.168.1.54
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:set overwriteprotocol --value=https
> sudo -E -u www-data php /var/www/nextcloud/occ config:system:set overwrite.cli.url --value=https://cloud.kuzco.org
> ```
>
> Position does not matter for `trusted_domains` — Nextcloud tests membership of that list, not where an entry sits — so if a name lands at a different index than planned, nothing needs correcting.
>
> Existing sync clients signed in against the IP keep working as long as that IP stays in `trusted_domains`; set up new devices with the new name.

> [!TIP]
> When you later build Uptime Kuma and put it behind the proxy, tell it so: **Settings → Reverse Proxy**, and under HTTP Headers set **Trust Proxy** on — its logs and rate limiting then see real client IPs instead of the proxy's.

### Decide what keeps its number
Walk the bookmarks bar and replace what you have today: `proxmox.`, `ha.`, `nas.`, `frigate.` — `cloud.`, `status.`, and more join the set as later pages bring their services up, every name behind the same lock, and Force SSL means even a typed `http://` lands on HTTPS.

Three addresses are different, though not in the way people usually assume. Adding a proxy host **never removes** the direct address, so this is not a choice between them:

- **NPM's admin interface**, `http://192.168.1.54:81`
- **AdGuard's dashboard**, `http://192.168.1.53`
- **Proxmox**, `https://192.168.1.50:8006`

**Worth proxying** — both admin interfaces above are plain HTTP, so those passwords currently cross the LAN in the clear, and a proxy host with the wildcard certificate is the cheapest fix for that.

**Never rely on the name**, because each of these can only fail in a way that takes its own name with it. AdGuard down means no DNS, so *nothing* in the house resolves, including a name pointing at AdGuard. A broken proxy-host entry can lock you out of the very interface that would correct it. Proxmox is the door you open to start a stopped proxy container in the first place.

So: add the hosts for the encryption, and keep those three raw addresses bookmarked and memorable. The rule is not "do not proxy them" — it is "never let the name be the only way in."

Machine-to-machine settings keep their IPs too. The Home Assistant ↔ Frigate integration stays on the LAN address at port `5000`, and Uptime Kuma's monitors should keep watching services at their direct addresses — through the proxy, every alert would be ambiguous (service down, or proxy down?). If you want the front door watched as well, add one HTTP(s) monitor pointed at a proxied name — that single check exercises the DNS rewrite, the proxy, and the certificate in one pass.
