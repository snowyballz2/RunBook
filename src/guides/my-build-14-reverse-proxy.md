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

When it asks **Default or Advanced**, pick **Advanced** and press Enter through the prefilled defaults — 2 cores, 2 GB RAM, an 8 GB disk, an unprivileged Debian 13 container — except networking: set a **static IP** on `vmbr0`. The script finishes by printing `http://<IP>:81`. Before you open it, set **Options → Start at boot** in Proxmox — from today, a stopped proxy means every name in the house goes dark.

> [!INPUT] proxy-ip | Proxy container IP | 192.168.1.54
> You set this statically during the install — record it here and keep it out of the router's DHCP (Dynamic Host Configuration Protocol) pool; every name below points here.

> [!NOTE]
> The catalog also carries `npmplus.sh`, a different project despite the similar name. The script above, `nginxproxymanager.sh`, is the one this page is written against.

> [!DETAILS] What the proxy listens on — and what stays shut
> NPM's documentation describes three ports: **80** (its "Public HTTP Port"), **443** ("Public HTTPS Port"), and **81** (the "Admin Web Port"). "Public" there means "the side browsers connect to" — the docs assume some people host internet-facing sites and even suggest forwarding 80 and 443 at the router. You will not. Every port stays LAN-only, the certificate arrives over DNS later with nothing reachable from outside, and your router's settings never change. Port 81 is the admin interface, for you alone.

> [!DETAILS] What's inside the container — and how to update it
> Not Docker, despite most NPM tutorials. The script builds everything from source inside the Debian container: OpenResty (the nginx flavor that does the proxying), the NPM app on Node.js, and Certbot — the Let's Encrypt client with DNS plugins — running as the `openresty` and `npm` systemd services. Settings live in a SQLite file at `/data/database.sqlite`. Two consequences: Docker advice from the wider internet does not apply, and updating has its own command — open the container's **Console** and run `update`. Snapshot the container first.

### Create your admin account
Browse to the proxy at `http://<proxy-ip>:81` and log in with NPM's default credentials — **`admin@example.com`** / **`changeme`**. It immediately forces a first-run step: set your real **Full Name** and **Email address**, then a strong **New Password**. This login controls where every name in your house points, so make the password strong and record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build). Record it below too so this checklist stands on its own.

> [!INPUT] npm-email | NPM admin email

> [!SECRET] npm-password | NPM admin password

> [!NOTE]
> The default `admin@example.com` / `changeme` login is deliberately useless: NPM forces you to replace both the moment you first log in, so the account you actually keep is the one you just set. Do not skip recording the new password — there is no reset button, only a database edit.

## Get a domain and a wildcard certificate

### Accept what Let's Encrypt will not sign
Browser-trusted certificates come from public certificate authorities, and public authorities only certify *public* names whose ownership they can verify. No authority will ever sign a certificate for a `.home.arpa` or `192.168.x.x` address. So the naming splits in two: **machine hostnames** stay private (the host keeps its `.home.arpa` name), but **service names** — the ones you want locks on — need a small piece of the public namespace you genuinely own.

Buy a real domain, used purely for naming and certificates. Nothing about it will point at your house — no records with your home IP, no exposure. Expect roughly $10–15 a year; judge by the renewal price, not the first-year offer. A zero-cost path (DuckDNS) follows.

> [!DETAILS] The honest alternatives to buying a name
> Two other routes work. Run your own certificate authority with a tool like minica or step-ca and issue certificates for any name you like, fully offline — the catch is installing your authority's root certificate by hand on every Apple device in the house. Or skip certificates entirely: plain-HTTP addresses on your own LAN, wrapped in the encrypted tunnel from remote access when you are away, is a defensible place to stop. This build buys a cheap domain because it is less chore than either.

### Get the domain — and DNS with an API
What matters is not where you buy but where the domain's **DNS is hosted**: the next step needs NPM's built-in Certbot to publish a DNS record through an API (Application Programming Interface). NPM ships support for dozens of providers — Cloudflare, Porkbun, deSEC, Route 53, and more — so register somewhere on that list, or point the domain's nameservers at a host that is. Then create an **API token** scoped to edit only this domain's DNS, per your provider's docs.

> [!INPUT] domain-name | Your domain | example.com

> [!SECRET] dns-api-token | DNS provider API token
> Scoped to edit only this domain's DNS — Certbot uses it to prove ownership.

Create no other records. No A record with your home IP — nothing about this domain ever points at your house. From outside your LAN the names simply will not resolve, and that is the design working.

> [!DETAILS] The free path with DuckDNS
> DuckDNS hands out free subdomains of `duckdns.org`. Claim one, copy the token from its dashboard, and your services become `proxmox.yourname.duckdns.org` and friends — NPM's provider list includes **DuckDNS**, credentials a single line: `dns_duckdns_token=your-token`. The trade: longer, visibly borrowed names, and DuckDNS allows only one TXT record at a time, so request exactly one certificate — the wildcard `*.yourname.duckdns.org`, which covers every service anyway. Everywhere below you see `*.example.com`, read your DuckDNS name instead.

### Request the wildcard certificate
In NPM, open **SSL Certificates**, click **Add SSL Certificate**, and choose **Let's Encrypt**. In the dialog:

- **Domain Names** — `*.example.com`, your own domain swapped in.
- **Email Address** — for Let's Encrypt's expiry notices.
- **Use a DNS Challenge** — turn this **on**; a wildcard can only be issued this way, and it reveals the DNS fields below.
- **DNS Provider** — pick yours from the list.
- **Credentials File Content** — the box pre-fills a template for the chosen provider; replace the placeholder with your real `dns-api-token`.
- **Propagation Seconds** — leave empty for the plugin's default.
- **I Agree to the Let's Encrypt Terms of Service** — tick it.

Save, and after a short wait the certificate appears, valid for every name under your domain. If it fails on timing, set **Propagation Seconds** to something patient like `120` and try again.

> [!NOTE]
> The dialog warns that these credentials are stored as plaintext in NPM's database and in a file. That is the trade for hands-off issuance and renewal: the proxy keeps your DNS token. A tightly scoped token and a strong NPM admin password are the mitigations.

> [!DETAILS] Covering the bare domain too
> A wildcard covers `anything.example.com` but not plain `example.com`. Every service on this page lives on a subdomain, so you may never care — but if you want the bare name to work, add `example.com` alongside `*.example.com` in the same certificate's Domain Names, and add a second, exact DNS rewrite for it in AdGuard (the next phase). Skip this on DuckDNS, where the one-TXT-record limit makes the combined request unreliable.

> [!DETAILS] Why no ports opened for this
> What ran was a **DNS-01 challenge**: Certbot used your token to publish a temporary TXT record at `_acme-challenge.example.com`, Let's Encrypt looked it up in public DNS, confirmed you control the domain, and issued. No connection to your network was ever attempted. DNS-01 is also the only challenge that can issue wildcards — and the only one that needs no inbound port, which is exactly why this build uses it. Renewals repeat the dance with the stored token, untouched by you.

## Teach the LAN the names

### Point the wildcard at the proxy
In the AdGuard dashboard, open **Filters → DNS rewrites** and click **Add DNS rewrite**. Domain: `*.example.com`. Answer: your `proxy-ip`. With the wildcard, every name under your domain now answers with the proxy's address for every device that asks AdGuard. Verify from any Mac in the house:

```bash
nslookup proxmox.example.com
```

Expect the proxy's IP. The names resolve; nothing answers on them yet — that is the next phase.

> [!DETAILS] Carrying the names with you over Tailscale
> These names exist only inside AdGuard, so a phone off the LAN will not find them on its own. Once remote access is set up on the next page, the names can travel: on the Tailscale admin console's DNS page, add AdGuard's LAN IP under **Global nameservers** and enable **Override DNS servers** — tailnet devices then resolve through AdGuard, and `https://proxmox.example.com` works from anywhere the subnet route reaches. The trade: with Override on, the phone's DNS depends on the server being up. The gentler variant is split DNS — send only `example.com` lookups to AdGuard and leave the rest of the phone alone.

## Put every service behind it

### Give Proxmox the first name
The pattern you repeat for everything: in NPM, open **Hosts → Proxy Hosts** and click **Add Proxy Host**. On the **Details** tab:

- **Domain Names**: `proxmox.example.com`
- **Scheme**: `https` — Proxmox speaks HTTPS on its own port
- **Forward Hostname / IP**: your `proxmox-ip`
- **Forward Port**: `8006`
- **Websockets Support**: on — the noVNC console you use as the server's screen rides on a websocket and dies without it

Then the **SSL** tab: under **SSL Certificate** choose the `*.example.com` certificate, and turn on **Force SSL** so any plain-HTTP request redirects to HTTPS. Save, then browse to `https://proxmox.example.com`: the familiar login, a real padlock, nothing to click through.

> [!NOTE]
> The proxy now talks to Proxmox's self-signed certificate and does not verify upstream certificates by default, so this just works. The warning you have clicked past since install was not fixed so much as moved to an encrypted-but-unverified hop inside your own LAN — a fair trade at home, and the browsers in your house never see it again.

### Tell Home Assistant to trust the proxy
Add the next host the same way — `ha.example.com`, Scheme `http`, Forward to your `ha-ip`, port `8123`, **Websockets Support** on, then the same SSL tab (wildcard certificate, **Force SSL**). Browse to `https://ha.example.com` and meet a deliberate roadblock: a bare **400: Bad Request**. Home Assistant OS refuses proxied requests until you name your proxy.

The fix is a few lines in `configuration.yaml`. The way in is the **File editor** app: **Settings → Apps → Install app**, install **File editor**, toggle **Show in sidebar**, start it, open `configuration.yaml`, and add:

```yaml
# configuration.yaml — Home Assistant
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 192.168.1.54    # the proxy container's IP — use your proxy-ip
```

Save, restart Home Assistant, and reload `https://ha.example.com` — the normal dashboard, behind a real lock.

> [!DETAILS] Reading the 400 if it persists
> The browser only shows the bare 400; the explanation is in Home Assistant's log. "Not set-up for reverse proxies" means the `http:` block is missing or not loaded — restart again. "Received X-Forwarded-For header from an untrusted proxy" means the IP in `trusted_proxies` does not match the proxy's address. Two trip wires: YAML indentation is two spaces exactly, and a whole subnet must be written as the network address (`192.168.1.0/24`). These settings only apply on a full Home Assistant restart — there is no hot reload, so reloading the page or reloading YAML alone will not pick them up. The pattern generalizes — if a service errors through its new name but works by IP, hunt its settings for a "trusted proxy" or "allowed hosts" option.

### Work down the rack
More proxy hosts, same dialog. Every one gets the wildcard certificate and **Force SSL** on the SSL tab, and **Websockets Support** on — some need it outright and it is harmless elsewhere. The two services up at this point:

- **TrueNAS** — `nas.example.com`, forwarding to your `truenas-ip`. A bare-IP HTTP address means Scheme `http`, port `80`; if yours serves HTTPS with a self-signed certificate, `https` and `443`. The proxy accepts either.
- **Frigate** — `frigate.example.com`, Scheme `http`, the Frigate LXC's IP, port **`8971`** — deliberately *not* `5000`. The warning below is why.

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> The container running detection on the 1080 Ti — proxy its authenticated port, not the internal one.

> [!WARNING]
> Frigate splits its two ports: **8971** is the authenticated UI and API that reverse proxies should use, while **5000** is internal, unauthenticated access treated as admin regardless of login. Proxying 5000 would hand admin to anything that can resolve the name. Use 8971, and leave 5000 as the internal address the Home Assistant integration talks to.

More proxy hosts get added later, once their containers exist — come back and repeat this exact Add-Proxy-Host pattern each time a later page brings a new service up. Two you already know are coming:

- **Nextcloud** (built later in this build) — `cloud.example.com`, Scheme `https`, the Nextcloud IP, port `443`. The first visit stops at **Access through untrusted domain**; the fix is in the Nextcloud page (and recapped below for when you reach it).
- **Uptime Kuma** (built later in this build) — `status.example.com`, Scheme `http`, the Kuma IP, port `3001`. It is built on WebSocket, so with the toggle off the dashboard never loads — leave **Websockets Support** on.

> [!DETAILS] Frigate's "plain HTTP request was sent to HTTPS port"
> If `frigate.example.com` answers with a 400 carrying that phrase, Frigate's own TLS (Transport Layer Security) is on at port 8971 while the proxy speaks plain HTTP to it. Turn Frigate's TLS off and let the proxy own encryption — in Frigate's config editor:
>
> ```yaml
> # config.yml — Frigate
> tls:
>   enabled: false
> ```
>
> Restart Frigate and try the name again.

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

- **NPM's admin interface** at `http://<proxy-ip>:81`. When the proxy is the thing that is sick, a name routed through itself is no way to reach its controls.
- **AdGuard's dashboard** at its IP. The names are answered there — if AdGuard is down, every name is down with it.
- **Proxmox** at `https://<proxmox-ip>:8006`, the emergency door. A stopped proxy container takes every name with it; this is the address you start it again from.

Machine-to-machine settings keep their IPs too. The Home Assistant ↔ Frigate integration stays on the LAN address at port `5000`, and Uptime Kuma's monitors should keep watching services at their direct addresses — through the proxy, every alert would be ambiguous (service down, or proxy down?). If you want the front door watched as well, add one HTTP(s) monitor pointed at a proxied name — that single check exercises the DNS rewrite, the proxy, and the certificate in one pass.
