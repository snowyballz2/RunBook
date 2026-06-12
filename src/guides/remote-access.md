---
title: Remote Access
subtitle: Reach your server from anywhere, with zero port-forwards
collection: Proxmox Home Server
order: 3
accent: spruce
---

## Why this comes third

### Understand the payoff
Everything you have so far — a web UI at `https://192.168.1.50:8006` (or whatever IP you wrote down) — answers only at home. This guide fixes that now, while the server is still empty, because of the payoff: once it is done, the entire rest of this collection can be built from anywhere. Every later step happens in a browser or a shell, and after today both reach your server from the couch, the office, or a train — and every service you build later will be reachable the same way.

It also keeps the rule this collection lives by: **no router port-forwards, ever.** Your network stays exactly as closed to the internet as it is right now.

> [!NOTE]
> This guide assumes the *Install Proxmox* guide is done: the server is on Ethernet with a static IP, and you can log in to the web UI from a browser on your LAN.

> [!DETAILS] Understanding why no ports get opened
> The traditional way to reach a home server is a port-forward: a router rule that says "anyone on the internet who knocks on this port gets sent to the server." It works, but that door stands open to the whole internet, around the clock.
>
> Tailscale — the tool this guide uses — inverts that. Every device makes only *outbound* connections, and the docs are explicit: "Most of the time, you don't need to open any firewall ports for Tailscale." Devices find each other directly using NAT traversal, and when a direct path is impossible, traffic falls back to Tailscale's relay servers (called DERP) — slower than a direct connection, but it gets through. Later, `tailscale status` on the server will tell you whether a connection is direct or relayed.
>
> The result: the Proxmox UI and everything you build behind it are reachable only by devices signed in to your private network, and your router's settings never change.

## Put your server on a tailnet

### Create your Tailscale account
Tailscale calls your private network a *tailnet*, and it is created the moment you first log in. Go to [tailscale.com](https://tailscale.com/) and sign up — it takes a minute and the Personal plan is $0, free forever. There is no Tailscale password to invent: by design Tailscale is not an identity provider, so you sign in with an account you already have — Google, Microsoft, GitHub, or Apple — or with a passkey.

> [!DETAILS] Choosing which login to use
> The full list of supported identity providers: Apple, Google (including Gmail and Google Workspace), GitHub, Microsoft (including Microsoft accounts, Office365, and Entra ID), Okta, OneLogin, and custom OIDC providers — plus passkeys for any tailnet you are authorized to join.
>
> Pick the account you are most certain you will still control in five years; it *is* your Tailscale identity, and your tailnet is created when you first log in with it. The same account goes on every device in this guide — that is what puts them all on the same network.

### Install Tailscale on the Proxmox host

Tailscale's official guidance for Proxmox is to install directly on the host — Proxmox is Debian underneath, so the standard Debian packages are the right ones. Open the server's shell in the web UI (select your node, then **Shell**) and run the four commands below; they are Tailscale's official Debian Trixie instructions with `sudo` removed, because this shell is already root.

```bash
# 1. Add Tailscale's signing key:
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null

# 2. Add the package repository:
curl -fsSL https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list

# 3. Install:
apt-get update
apt-get install tailscale
```

> [!DETAILS] Why this method, and not the install script
> Note what those two `curl` commands do *not* do: execute anything. One downloads a signing key, the other a one-line repo definition (open the `.list` URL in your browser and read it — it is genuinely one line), and then apt installs a normally signed package. Nothing is piped into a shell, which is why this is the default here.
>
> Tailscale also offers an official one-liner that detects your OS and does the same setup:
>
> ```bash
> curl -fsSL https://tailscale.com/install.sh | sh
> ```
>
> It is fine — but it is still a script piped into a root shell, so apply the download-read-run habit from the *Install Proxmox* guide:
>
> ```bash
> curl -fsSL https://tailscale.com/install.sh -o tailscale-install.sh
> less tailscale-install.sh
> sh tailscale-install.sh
> ```

> [!DETAILS] Running Proxmox VE 8 instead of 9
> Proxmox VE 9 is built on Debian 13 "Trixie" — that is why the commands above say `trixie`, and if you installed PVE 9.2 in the last guide they are correct as written. Proxmox VE 8 is built on Debian 12 "Bookworm"; on PVE 8, swap the two repo lines:
>
> ```bash
> curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
> curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list
> ```
>
> Then the same `apt-get update` and `apt-get install tailscale`.

> [!DETAILS] Choosing the host over a VM or container
> Tailscale's documentation for Proxmox is titled "Tailscale on a Proxmox host" — installing on the host itself is the officially documented path, with no caveats attached. You will also find community tutorials that put Tailscale inside a container instead; Tailscale's docs do not cover that approach, and it ties your remote access to a container that has to be running. On the host, remote access is up the moment the server is — even with nothing else built yet, which is exactly your situation today.
>
> If you prefer the container route anyway, the catch is the tunnel device: with the container stopped, add these two lines to its config at `/etc/pve/lxc/<id>.conf` on the host, then start it and install Tailscale inside as you would on any Debian:
>
> ```bash
> lxc.cgroup2.devices.allow: c 10:200 rwm
> lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
> ```

### Connect the server to your tailnet

In the same shell, run:

```bash
tailscale up
```

The output prints a URL — open it in the browser on your everyday computer (the server has no desktop of its own, as you know by now), sign in with the account from the first step, and the server joins your tailnet. Confirm with `tailscale ip -4`, which prints the server's new Tailscale address.

> [!DETAILS] Knowing what the server just received
> Every device on a tailnet gets an IP in the `100.x.y.z` range, and it is deliberately stable — it stays the same "no matter where nodes move to in the physical world" and will not change for as long as the device stays registered. So the server now has two addresses: the LAN IP you picked during install, and a `100.x` address that other tailnet devices can reach from anywhere. The next phase extends that reach to everything else in your house.

### Stop the server's key from expiring

By default a tailnet device must re-authenticate every 180 days, and a server that silently drops off the network while you are away defeats the whole point. On the [Machines page](https://login.tailscale.com/admin/machines) of the admin console, find the server's row, open the **…** menu at the far right, and select **Disable Key Expiry**.

> [!DETAILS] Deciding which devices get this treatment
> Tailscale's own recommendation is to disable expiry on "trusted servers, subnet routers, or remote IoT devices that are hard to reach" — this server is about to be both of the first two. Your phone and laptop can keep the 180-day default; re-authenticating there is a ten-second sign-in.
>
> Two more facts worth keeping: a subnet router whose key expires *stops routing* — which is exactly why this step comes before the next phase — and an already-expired key can be renewed with `tailscale up --force-reauth`. That command can drop the connection while it runs, so never use it over a remote session unless you have another way in.

## Open the road to the whole LAN

### Enable IP forwarding
Right now the tailnet reaches exactly one machine. A *subnet router* fixes that: in Tailscale's words, subnet routers "act as gateways between your tailnet and physical subnets" — your server will announce your home network, in three short steps: forward, advertise, approve. First, forwarding: a gateway has to pass packets between two networks, which Linux refuses to do until told. In the server's shell, run:

```bash
echo 'net.ipv4.ip_forward = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
sysctl -p /etc/sysctl.d/99-tailscale.conf
```

> [!DETAILS] Knowing what those three lines do
> The first two lines write one kernel setting each — "forward IPv4 packets" and "forward IPv6 packets" — into a small config file, and because the file lives in `/etc/sysctl.d/`, the settings survive reboots. The third line applies them immediately so you do not have to reboot now. These are the exact commands from Tailscale's subnet router documentation, minus `sudo` (the Proxmox shell is already root).

### Advertise your home subnet

Still in the server's shell, tell Tailscale which network the server can hand out. Use *your* subnet: take the server's IP from the install guide, keep the first three numbers, and end with `.0/24` — a server at `192.168.1.50` means a subnet of `192.168.1.0/24`.

```bash
tailscale set --advertise-routes=192.168.1.0/24
```

> [!DETAILS] Adapting the example to your network
> The `/24` means "the standard home network" — the same mask the Proxmox installer used. Worked examples:
>
> - Server at `192.168.1.50` → `--advertise-routes=192.168.1.0/24`
> - Server at `192.168.0.50` → `--advertise-routes=192.168.0.0/24`
> - Server at `10.0.0.50` → `--advertise-routes=10.0.0.0/24`

> [!DETAILS] Seeing `tailscale up --advertise-routes` in older tutorials
> Older guides pass `--advertise-routes` to `tailscale up`. That still works, but `tailscale up` expects you to re-specify *all* your settings every time you run it — an easy way to accidentally undo something. `tailscale set` changes just the one setting, and it is the form Tailscale's current documentation uses. Prefer it.

### Approve the route in the admin console

Advertised routes do nothing until an admin — you — approves them, so a stray device can never quietly announce itself as a gateway. Open the [Machines page](https://login.tailscale.com/admin/machines), select the server (its row now shows a **Subnets** badge), go to the **Subnets** section and select **Edit** — in the **Edit route settings** panel, tick `192.168.1.0/24` under **Subnet routes** and select **Save**.

> [!NOTE]
> Your other devices need nothing extra: per Tailscale's docs, "Android, iOS, macOS, tvOS, and Windows automatically pick up your new subnet routes." Only Linux clients opt in manually, with `tailscale set --accept-routes`.

> [!DETAILS] Skipping manual approval in future (autoApprovers)
> If you ever re-advertise routes and do not want to revisit the console, Tailscale's `autoApprovers` setting in the tailnet policy file approves specified routes automatically when advertised by an authorized user. With one server and one route, the manual click you just did is all you need — file this away for later.

## Prove it from your phone

### Put Tailscale on your phone
A phone on mobile data is the cleanest possible test: a device that is definitely not on your network, reaching an address that should only exist on your network. Install Tailscale from the App Store (iOS 15 or later) or Google Play (Android 8 or later), open it, choose **Get Started**, and sign in with the same account you used for the server. The phone will ask permission to add a VPN configuration — accepting that prompt is what switches the connection on.

> [!DETAILS] Walking through the phone setup
> - **iOS** — launch the app, select **Get Started**, accept the prompt to install a VPN configuration (and the push-notification prompt), then **Log in** with your identity provider.
> - **Android** — the same flow: **Get Started**, accept the VPN configuration prompt, then sign in with Google or **Sign in with other**.
>
> Signing in with the same account is the whole trick: every device you authenticate joins your tailnet, the same private network the server is on.

### Open Proxmox from anywhere

Turn off Wi-Fi so the phone is genuinely on mobile data, check the Tailscale app shows it is connected, and browse to `https://192.168.1.50:8006` — the server's normal LAN address. You will meet the same certificate warning as in *Install Proxmox* (**Advanced**, then **Proceed**), and then the familiar login screen — served to a phone nowhere near your house, through zero opened ports. From here on, every guide in this collection works from wherever you happen to be.

> [!NOTE]
> One honest limitation: every path in this guide runs through the Proxmox host. If the server is powered off, crashed, or wedged mid-boot while you are away, remote access is down with it, and nothing here can bring it back remotely. Tailscale can fail over between two subnet routers, but that requires a second always-on machine — for a one-server build, a dead host means a trip home, or a housemate and a power button.

> [!DETAILS] Touring the Machines page
> The [Machines page](https://login.tailscale.com/admin/machines) now lists both devices. Three things worth knowing:
>
> - **Tailscale IPs** — every device has an address in the `100.x.y.z` range, stable for as long as the device stays registered. `https://` followed by the server's `100.x` address and `:8006` reaches the web UI too.
> - **MagicDNS names** — MagicDNS "automatically registers DNS names for devices in your network," on by default for new tailnets, in the form `machine-name.tailnet-name.ts.net`. Names come from each device's hostname, so the server appears as `pve` (or whatever you chose in the installer).
> - **Renaming** — rename any machine from this page, or on the device with `tailscale set --hostname=<name>`; its MagicDNS name follows.
>
> Day to day, keep using the LAN IP: thanks to the subnet route, it is the one address that reaches the server *and* everything else at home, from anywhere.
>
> One optional extra: the server can also be an **exit node** (`tailscale set --advertise-exit-node`, approved on the Machines page like the subnet route). Selecting it on your phone routes *all* the phone's traffic through home — useful on hostile Wi-Fi, off by default, and entirely separate from the subnet route you already approved.

> [!DETAILS] Quieting the certificate warning (optional)
> The warning is the same self-signed-certificate situation as in *Install Proxmox*, and clicking through remains fine for now. If you would rather be rid of it when connecting over Tailscale, the official "Tailscale on a Proxmox host" guide documents two fixes: a short script that installs a Tailscale-issued HTTPS certificate into Proxmox (with a cron job suggested to keep it renewed), or Tailscale Serve, which proxies the web UI behind a valid certificate (both fixes run in the Proxmox host's shell):
>
> ```bash
> tailscale serve --bg https+insecure://localhost:8006
> ```
>
> Both are extras, not requirements — nothing later depends on them.

> [!DETAILS] Confirming this all stays free
> Everything in this guide runs on Tailscale's free Personal plan: $0 forever, up to 6 users, unlimited devices for those users — subnet routing and **Disable Key Expiry** included. If you read elsewhere that the free plan is "3 users / 100 devices," that is the old limit; Tailscale's own pricing FAQ confirms the Personal plan now allows 6 users, and user devices are "free and unlimited."
