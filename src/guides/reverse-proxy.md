---
title: Reverse Proxy
subtitle: A real name and a green lock for every service, with zero port-forwards
collection: Proxmox Home Server
order: 15
accent: emerald
---

## Why names and locks

### Understand the one front door
Look at what your bookmarks bar has become: `https://192.168.1.50:8006` with a certificate warning, `http://192.168.1.51:8123`, a TrueNAS IP, a Frigate port, a Nextcloud address every new device objects to. Each guide so far ended the same way — an IP, a port, and a warning this collection kept calling fine *for now*. This guide is where "for now" ends.

A reverse proxy is one small container that becomes the only address you browse to. You ask for `https://proxmox.example.com`; it reads the name, forwards the request to `192.168.1.50:8006` behind the scenes, and hands back the answer — over a connection covered by one real, browser-trusted certificate that serves every name at once. The tool here is **Nginx Proxy Manager** (NPM): nginx doing the proxying, with a web UI instead of config files.

Two rules survive untouched. The proxy serves your LAN (and, through the *Remote Access* guide, your tailnet) — **no router port-forwards, not for this, not ever**. And the certificate will arrive without exposing anything, which is the cleverest part of the whole guide.

> [!NOTE]
> This guide leans on the stack you have built: AdGuard Home from the *AdGuard Home* guide must be the house DNS, because that is how the new names will resolve, and the *Remote Access* subnet route is what carries them beyond your walls.

> [!DETAILS] Knowing what the proxy listens on — and what stays shut
> NPM's documentation describes three ports: **80** ("Public HTTP Port"), **443** ("Public HTTPS Port"), and **81** ("Admin Web Port"). "Public" there means "the side browsers connect to" — the docs assume some people host internet-facing sites and even suggest forwarding 80 and 443 at the router. You will not. Every port stays LAN-only, the certificate arrives over DNS in phase three with nothing reachable from outside, and your router's settings never change. Port 81 is the admin UI, for you alone.

## Stand up the proxy

### Run the install script
Same move as AdGuard and Nextcloud: in the Proxmox web UI, click your node, then **Shell**, and run the community-scripts helper — reading it first, the download-read-run habit from the *Install Proxmox* guide:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/nginxproxymanager.sh)"
```

When it asks **Default or Advanced**, pick **Advanced** and press Enter through the prefilled defaults — 2 cores, 2 GB RAM, an 8 GB disk, an unprivileged Debian 12 container — except networking: set a **static IP**, say `192.168.1.54`, the *AdGuard Home* move. The script finishes by printing "Access it using the following URL:" and `http://<IP>:81`. Before you open that, set **Options → Start at boot** in Proxmox — from today, a stopped proxy means every name in the house goes dark.

> [!WARNING]
> Every bookmark, certificate, and DNS rewrite below points at this one address. Pin it — static IP or DHCP reservation — and never let it move.

> [!INPUT] proxy-ip | Proxy container IP | 192.168.1.54

> [!NOTE]
> The catalog also carries `npmplus.sh` — a different project despite the similar name. The script above, `nginxproxymanager.sh`, is the one this guide is written against.

> [!DETAILS] Knowing what's inside the container
> Not Docker, despite what most NPM tutorials assume. The script builds everything from source inside the Debian container: OpenResty (the nginx flavor that does the actual proxying), the NPM app itself on Node.js 22 (source unpacked under `/opt/nginxproxymanager`, running from `/app`), and Certbot — the Let's Encrypt client, DNS plugins included — under `/opt/certbot`. Settings live in a SQLite file at `/data/database.sqlite`, and it all runs as two systemd services, `openresty` and `npm`. Two practical consequences: Docker advice from the wider internet (compose files, volume paths) does not apply here, and updating has its own command — open the container's **Console** and run `update`, which re-runs the installer's update path for NPM, OpenResty, and Certbot. Snapshot first, the *Containers* guide habit.

### Create your admin account
Browse to `http://192.168.1.54:81`. A welcome screen asks you to "Get started by creating your admin account." — **Full Name**, **Email address**, **New Password**. Give it a strong password, click **Save**, and you land in NPM's dashboard. This login controls where every name in your house points, so treat it accordingly.

> [!INPUT] npm-email | NPM admin email

> [!SECRET] npm-password | NPM admin password

> [!NOTE]
> Older write-ups — most of the internet, in fact — say to log in as `admin@example.com` with password `changeme` and change it immediately. That flow was removed in late 2025: current releases have no default user at all, just this wizard, and the container installs the latest release. If you ever meet the old default login instead, you are looking at an outdated install that deserves the `update` command.

## Get a domain and a wildcard certificate

### Accept what Let's Encrypt will not sign
Here is the wall this phase walks around: browser-trusted certificates come from public certificate authorities, and public CAs only certify *public* names — names rooted in the real DNS hierarchy, whose ownership they can verify. `home.arpa` is reserved precisely so it can never be public, which means no CA will ever issue a certificate for `proxmox.home.arpa`. (Let's Encrypt did start issuing certificates for IP addresses in January 2026 — but only public, internet-reachable ones, on six-day lifetimes. A `192.168.x.x` address remains impossible.)

So the *Install Proxmox* hostname advice splits cleanly in two, and both halves stand. For **machine hostnames**, nothing changes: `pve.home.arpa` stays exactly what it is. For **service names** — the ones you want locks on — you need a small piece of the public namespace that you genuinely own: a real domain, used purely for naming and certificates. Nothing about it will point at your house — no records with your home IP, no exposure — and the warning that expandable gave about *fake* public domains gets satisfied the only way it can be: by owning a real one. Expect roughly $10–15 a year for a common ending; judge by the renewal price, not the first-year offer. A zero-cost path exists too — DuckDNS, in the next step.

> [!DETAILS] Running your own certificate authority instead
> For names that never touch public DNS, Let's Encrypt's own documentation points at the other honest route: become your own certificate authority, with a tool like minica or step-ca, and issue certificates for whatever names you like — `home.arpa` included, fully offline. The catch is where the trust comes from: your CA's root certificate has to be installed by hand on every phone, laptop, and TV in the house, and on every device you ever add. It genuinely works, and it suits people who refuse to rent a name on principle. This guide buys the domain instead, because ten dollars a year is cheaper than that chore — but the option is real, and nothing else here forbids it.
>
> And the third honest answer is to not chase certificates at all: plain-HTTP addresses on your own LAN, wrapped in the already-encrypted tunnel from the *Remote Access* guide when you're away, is a defensible place to stop. The browser warnings are the only cost — the rest of this guide is for when you decide they've annoyed you enough.

### Get the domain — and DNS with an API
Buy the name at any registrar. The requirement that actually matters is not where you buy but where the domain's **DNS is hosted**: the next step needs NPM's built-in Certbot (the program that talks to Let's Encrypt) to publish a DNS record through an API. NPM ships support for 86 providers at the time of writing — Cloudflare, Porkbun, and deSEC are in the list, alongside Route 53, OVH, GoDaddy, Namecheap, and more — so register somewhere on that list, or point the domain's nameservers at a host that is. Then create an **API token** allowed to edit this domain's DNS, per your provider's docs, scoped as tightly as the provider allows.

> [!INPUT] domain-name | Your domain | example.com

> [!SECRET] dns-api-token | DNS provider API token
> Scoped to edit this one domain's DNS — Certbot uses it to prove ownership.

Create no other records. No A record with your home IP — nothing about this domain ever points at your house. From outside your LAN the names you are about to mint simply will not resolve, and that is the design working.

> [!DETAILS] Taking the free path with DuckDNS
> DuckDNS hands out free subdomains of `duckdns.org` — commonly cited as up to five per account. Claim `yourname.duckdns.org`, copy the token from its dashboard, and your services become `proxmox.yourname.duckdns.org` and friends. NPM's provider list includes **DuckDNS**, and the credentials are a single line: `dns_duckdns_token=your-duckdns-token`. Two honest trade-offs: the names are longer and visibly borrowed, and DuckDNS allows only one TXT record at a time — the Certbot plugin's README is blunt that you "cannot create certificates for multiple DuckDNS domains with one certbot call." So request exactly one name in the next step: the wildcard `*.yourname.duckdns.org`, which covers every service anyway. Everything else in this guide works identically — wherever you see `*.example.com`, read `*.yourname.duckdns.org`.

### Request the wildcard certificate
In NPM, open **Certificates** in the top navigation, click **Add Certificate**, and choose **Let's Encrypt via DNS**. In the dialog:

- **Domain Names** — `*.example.com`, with your own domain swapped in.
- **Key Type** — leave the default.
- **DNS Provider** — pick yours from the list.
- **Credentials File Content** — the box pre-fills a template for the chosen provider (Cloudflare's is one line, `dns_cloudflare_api_token=...`); replace the placeholder with your real token.
- **Propagation Seconds** — leave empty for the plugin's default.

Save, and after a short wait the certificate appears in the list, valid for every name under your domain. If it fails on timing — DNS changes take a moment to become visible — set **Propagation Seconds** to something patient like `120` and try again.

> [!NOTE]
> The dialog warns that these credentials are stored as plaintext in NPM's database and in a file. That is the trade for hands-off issuance and renewal: the proxy keeps your DNS token. A tightly scoped token and a strong NPM admin password are the mitigations.

> [!NOTE]
> If your NPM shows **SSL Certificates** in the menu and a **Use a DNS Challenge** toggle, plus email and terms-of-service boxes, you are on the pre-November-2025 interface — same ideas, older labels. The `update` command from the install expandable brings you current.

> [!DETAILS] Understanding why no ports opened for this
> What just ran was a **DNS-01 challenge**: Certbot used your token to publish a temporary TXT record at `_acme-challenge.example.com`, Let's Encrypt looked that record up in public DNS, confirmed you control the domain, and issued. No connection to your network was ever attempted — only your DNS provider was involved. DNS-01 is also the only challenge allowed to issue wildcards; Let's Encrypt's FAQ states flatly that "Wildcard issuance must use the DNS-01 challenge." The familiar alternative, HTTP-01, "can only be done on port 80" with the CA connecting *inbound* — the exact port-forward this collection will never create. Renewals repeat the same dance with the stored token, untouched by you.

> [!DETAILS] Covering the bare domain too
> A wildcard covers `anything.example.com` but not plain `example.com`. Every service in this guide lives on a subdomain, so you may never care — but if you want the bare name to work, add `example.com` alongside `*.example.com` in the same certificate's Domain Names. Skip this on DuckDNS, where the one-TXT-record limit makes the combined request unreliable.

## Teach the LAN the names

### Point the wildcard at the proxy
In the AdGuard dashboard, open **Filters → DNS rewrites** and click **Add DNS rewrite**. Domain: `*.example.com`. Answer: `192.168.1.54` — the proxy. The feature does what its description promises — "Allows to easily configure custom DNS response for a specific domain name" — and with the wildcard, every name under your domain now answers with the proxy's address for every device that asks AdGuard. Verify from any machine in the house:

```bash
nslookup proxmox.example.com
```

Expect `192.168.1.54`. The names resolve; nothing answers on them yet — that is the last phase.

> [!DETAILS] Matching the wildcard's fine print
> Three behaviors worth knowing. `*.example.com` matches subdomains at any depth — `a.b.example.com` included — but **not** the bare `example.com`; if you gave the bare domain a job in the certificate step, add a second, exact rewrite for it. Rewrites are global: every client resolving through AdGuard gets the same answer (per-client settings cover blocking and upstreams, not rewrites). And each rewrite has its own enable toggle, so the whole experiment can be switched off without deleting anything.

### Know which devices hear the names
These names exist only inside AdGuard — there are no public records, so the rest of the internet answers "no such domain." Map that against your house:

- **Everything using AdGuard** — the whole house, since the *AdGuard Home* guide's router change — resolves them.
- **Devices that bypass AdGuard** — a gadget with hardcoded DNS, or anything drifting to the public fallback you may have chosen as secondary DNS in that guide — cannot find the names at all. Less an error than a boundary: for those devices, the old ip:port addresses keep working.
- **Your phone, away from home** — the *Remote Access* subnet route happily carries traffic to `192.168.1.54`, but the phone's DNS lookups do not go through AdGuard on their own. One admin-console setting fixes that — the expandable below — and the same names then work from anywhere.

> [!DETAILS] Carrying the names with you over Tailscale
> On the [DNS page](https://login.tailscale.com/admin/dns) of the Tailscale admin console, add AdGuard's LAN IP (`192.168.1.53`) under **Global nameservers**, then enable the **Override DNS servers** toggle — in Tailscale's words, the switch that forces tailnet devices "to use the tailnet-defined DNS settings instead of its local DNS settings." Tailscale's docs note that a private nameserver like this needs subnet routing to be reachable — which the *Remote Access* guide already built. MagicDNS keeps answering the `*.ts.net` machine names itself; everything else flows to AdGuard, so `https://proxmox.example.com` works from the train, and as a side effect your phone's browsing is filtered through AdGuard wherever it goes.
>
> The honest trade: with Override on, the phone's DNS depends on AdGuard being reachable — if the server is down while you are out, lookups fail until you disconnect Tailscale. The gentler variant is Tailscale's **restricted nameservers** (split DNS): send only `example.com` lookups to AdGuard and leave the rest of the phone's DNS alone. Names still work everywhere; the ad blocking just stays home.

## Put every service behind it

### Give Proxmox the first name
The pattern you will repeat for everything: in NPM, open **Hosts → Proxy Hosts** and click **Add Proxy Host**. On the **Details** tab:

- **Domain Names**: `proxmox.example.com`
- **Scheme**: `https` — Proxmox speaks HTTPS on its own port
- **Forward Hostname / IP**: `192.168.1.50`
- **Forward Port**: `8006`
- **Websockets Support**: on — the noVNC console you use as the server's screen rides on a websocket and dies without it

Leave the other toggles at their defaults. Then the **SSL** tab: under **SSL Certificate**, choose the `*.example.com` certificate, and turn on **Force SSL** so any plain-http request gets redirected to HTTPS. Save, then browse to `https://proxmox.example.com`: the familiar login screen, a real padlock, and nothing to click through — for the first time since the *Install Proxmox* guide.

> [!NOTE]
> The proxy is now the one talking to Proxmox's self-signed certificate, and it does not verify upstream certificates by default — so this simply works. The warning you have clicked past since guide two was not so much fixed as moved to an encrypted-but-unverified hop inside your own LAN. For a home network, that is a fair trade — and the browsers in your house never see it again.

### Tell Home Assistant to trust the proxy
Add the next host the same way — `ha.example.com`, Scheme `http`, Forward Hostname / IP `192.168.1.51`, Forward Port `8123`, **Websockets Support** on, then the same SSL tab (wildcard certificate, **Force SSL**). Browse to `https://ha.example.com` and meet this guide's one deliberate roadblock: a bare **400: Bad Request**. Home Assistant refuses proxied requests until you name your proxy; its docs are explicit that requests from reverse proxies are blocked when these options are not set.

The fix is a few lines in `configuration.yaml`. On Home Assistant OS the way in is the **File editor** app: go to **Settings → Apps**, choose **Install app** (apps are what Home Assistant now calls add-ons), install **File editor**, toggle **Show in sidebar**, and start it. Open `configuration.yaml` from the sidebar and add:

```yaml
# configuration.yaml — Home Assistant
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 192.168.1.54    # the proxy container's IP — use yours
```

Save, restart Home Assistant, and reload `https://ha.example.com` — the normal dashboard, behind a real lock.

> [!DETAILS] Reading the 400 if it persists
> The browser only ever shows the bare 400; the explanation lives in Home Assistant's log. "A request from a reverse proxy was received … but your HTTP integration is not set-up for reverse proxies" means the `http:` block is missing or not loaded yet — restart again. "Received X-Forwarded-For header from an untrusted proxy" means the IP in `trusted_proxies` does not match the proxy's actual address. Two trip wires: YAML indentation is two spaces exactly, and if you ever list a whole subnet instead of one IP, the docs require the network address — `192.168.1.0/24`, not `192.168.1.50/24`. These settings only apply on restart; there is no hot reload.
>
> The pattern generalizes beyond Home Assistant, and is worth keeping for any service you ever proxy: if something errors through its new name but works fine by IP, go hunting in its settings for a "trusted proxy" or "allowed hosts" option — that's almost always the whole story.

### Work down the rack
Four more proxy hosts, same dialog. Every one gets the wildcard certificate and **Force SSL** on the SSL tab, and **Websockets Support** on — two of these need it outright, and it is harmless where unused:

- **TrueNAS** — `nas.example.com`, forwarding to whatever you type in the browser today: a bare-IP `http://` address means Scheme `http`, port `80`; if yours serves HTTPS with a self-signed certificate, `https` and `443`. The proxy accepts either without complaint.
- **Nextcloud** — `cloud.example.com`, Scheme `https`, your Nextcloud IP, port `443`. The first visit stops at **Access through untrusted domain** — the exact page the *Nextcloud* guide's expandable prepared you for. The fix is in the expandable below.
- **Uptime Kuma** — `status.example.com`, Scheme `http`, your Kuma IP, port `3001`. Its wiki is direct about why the websocket toggle matters: "Unlike other web apps, Uptime Kuma is based on WebSocket." With the toggle off, the dashboard never loads.
- **Frigate** — `frigate.example.com`, Scheme `http`, your Frigate IP, port **`8971`** — deliberately *not* the `5000` you have browsed since the *Frigate* guide. The warning below is the why.

> [!WARNING]
> Frigate's docs split its two ports plainly: 8971 is the authenticated UI and API — "Reverse proxies should use this port" — while 5000 is internal, unauthenticated access whose reach "should be limited"; requests there are treated as admin regardless of any login. Proxying 5000 would hand that to anything that can resolve the name. Use 8971, and let 5000 stay what it was: an internal address for the Home Assistant integration from the *Frigate* guide.

> [!DETAILS] Fixing Frigate's "plain HTTP request was sent to HTTPS port"
> If `frigate.example.com` answers with a 400 carrying that phrase, Frigate's own TLS is enabled on port 8971 while the proxy speaks plain HTTP to it. The documented fix is to turn Frigate's TLS off and let the proxy own encryption — in Frigate's config editor:
>
> ```yaml
> # config.yml — Frigate
> tls:
>   enabled: false
> ```
>
> Restart Frigate and try the name again.

> [!DETAILS] Telling Nextcloud about its new name
> Two settings, both from the Nextcloud container's console at `/var/www/nextcloud`, both via the occ tool the *Nextcloud* guide introduced. First, the untrusted-domain page: list what is currently trusted, then add the new name at the next free index (entries 0 through 2 taken means 3):
>
> ```bash
> sudo -E -u www-data php occ config:system:get trusted_domains
> sudo -E -u www-data php occ config:system:set trusted_domains 3 --value=cloud.example.com
> ```
>
> Second, the reverse-proxy settings the admin manual asks for — it says you must explicitly define the proxy servers Nextcloud is to trust, and the protocol and base URL it should generate links with:
>
> ```bash
> sudo -E -u www-data php occ config:system:set trusted_proxies 0 --value=192.168.1.54
> sudo -E -u www-data php occ config:system:set overwriteprotocol --value=https
> sudo -E -u www-data php occ config:system:set overwrite.cli.url --value=https://cloud.example.com
> ```
>
> Existing sync clients signed in against the IP keep working as long as that IP stays in `trusted_domains`; set up new devices with the new name.

> [!TIP]
> Once Uptime Kuma sits behind the proxy, tell it so: in Kuma, **Settings → Reverse Proxy**, and under HTTP Headers set **Trust Proxy** on — its logs and rate limiting then see real client IPs instead of the proxy's.

### Decide what keeps its number
Walk the bookmarks bar and replace: `proxmox.`, `ha.`, `nas.`, `cloud.`, `status.`, `frigate.` — six names, one lock, and Force SSL means even a typed `http://` lands on HTTPS. Three addresses deliberately stay raw, because they are the system's own foundations:

- **NPM's admin UI** at `http://192.168.1.54:81`. You could give the proxy a name routed through itself, but when the proxy is the thing that is sick, that name is no way to reach its controls.
- **AdGuard's dashboard** at its IP. The names are answered there — if AdGuard is down, every name is down with it, and the bookmark you fix that from cannot itself be a name.
- **Proxmox** at `https://192.168.1.50:8006`, the emergency door. A stopped proxy container takes every name in the house with it; this is the address you start it again from. Its certificate warning is no longer a daily companion — just the fallback's quirk.

Machine-to-machine settings keep their IPs too. The Home Assistant ↔ Frigate integration stays on `http://frigate-ip:5000`, and Uptime Kuma's monitors from the *Uptime Kuma* guide should keep watching services at their direct addresses — through the proxy, every alert would be ambiguous (service down, or proxy down?). If you want the new front door watched as well, add one more HTTP(s) monitor pointed at a proxied name: that single check exercises the DNS rewrite, the proxy, and the certificate in one pass.
