---
title: AdGuard Home
subtitle: House-wide ad and tracker blocking, as a Proxmox container
collection: Proxmox Home Server
order: 4
accent: azure
---

## Create the container

### Pick your path: script or by hand
The helper script below builds a ready-to-go AdGuard container in about two minutes — that's the path these steps follow. Prefer no scripts? Install AdGuard into your own container instead (expand below), then skip ahead to the setup wizard.

> [!DETAILS] The manual way — into your own Debian container
> Make a container as in the *Containers* guide (2 cores and 2 GB is plenty), give it a **fixed IP** (set a static address in the container's Network config, or use your router's DHCP reservation page), then run the official installer in the container's **Console**:
>
> ```bash
> curl -s -S -L https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh | sh -s -- -v
> ```
>
> Same rule as ever for piped scripts — download and read it first if you prefer. Then continue at **Run the setup wizard** below.

### Run the install script
In the Proxmox web interface, click your node in the left sidebar, then click **Shell**. The script runs on the Proxmox host itself, not inside a VM or container. Paste this and press Return:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/adguard.sh)"
```

> [!NOTE]
> This uses the Proxmox community helper scripts — the successor to the well-known tteck scripts. Same habit as always: read a script before piping it into a root shell (the download-read-run habit from the *Install Proxmox* guide).

### Choose Advanced and set a static IP
When it asks **Default or Advanced**, pick **Advanced**. Accept the sensible defaults for CPU and RAM, but when it reaches networking, set a **static IP** instead of DHCP, for example `192.168.1.53`. Note down the IP you choose — you will use it everywhere below. Then let the script finish; it prints the setup URL when done.

> [!WARNING]
> AdGuard is about to become your network's DNS server, and its address must never change. A static IP is essential — if it ever moves, the whole house loses name resolution.

> [!DETAILS] How to pick a safe number
> Same rules as the server's own address: keep the first three numbers identical to your router's, and choose a final number **outside** your router's DHCP range so it can never be handed to another device. The static-IP expandable in the *Install Proxmox* guide walks through finding your gateway and DHCP range.

## Run the setup wizard

### Open the wizard
In a browser, go to the static IP you chose, on port 3000, and click **Get Started**:

```bash
http://192.168.1.53:3000
```

Swap in your own IP.

### Set the ports
Leave the **Admin Web Interface** on its default port, and leave the **DNS server** on port 53, listening on all interfaces. Click Next.

> [!NOTE]
> Port 53 is the standard DNS port. Listening on all interfaces is what lets every device on your network use AdGuard.

### Create your admin login
Set a username and a strong password for the dashboard, then finish the wizard. The dashboard now lives at the container's IP (no `:3000` needed anymore).

## Point your network at it

### Set AdGuard as your router's DNS
Log into your router, find the DHCP or DNS settings, and set the **primary DNS server** to AdGuard's static IP (`192.168.1.53` in this example). Save, and reboot the router if it asks. As devices renew their leases, every phone, TV, and laptop in the house starts using AdGuard automatically.

> [!TIP]
> Setting it once at the router covers every device automatically — phones, TVs, laptops — with nothing to configure per device.

### Decide on a fallback — a real tradeoff
The secondary DNS field is a genuine choice, not a formality:

- Leave it blank (or also point it at AdGuard) for the strongest blocking. The catch: if AdGuard or the server is down, the house has no DNS until it returns.
- Point it at a public resolver like `1.1.1.1` for resilience. The catch: some devices will quietly use it and bypass your blocking.

> [!NOTE]
> There is no perfect answer. For maximum blocking, AdGuard only. For never losing the internet if the box hiccups, add a public fallback and accept some leakage. Choose based on what you value more.

## Tune and verify

### Add a couple of blocklists
In the dashboard, go to **Filters → DNS blocklists**. AdGuard ships with a default list; add one or two well-regarded lists from the built-in catalog. More lists block more, but can occasionally break a site.

### Confirm it is actually blocking
From any computer on the network, check that a known ad or tracker domain gets blocked — a blocked domain returns `0.0.0.0` or no address:

```bash
nslookup doubleclick.net
```

Then open the **Query Log** in the dashboard. You should see live queries from your devices flowing in, with blocked ones marked.

> [!TIP]
> If a site you trust breaks, open the Query Log, find the blocked domain, and click to allow it. That is the normal way to fix the occasional false block.

## Keep it resilient

### Plan for the box going down
Now that AdGuard handles DNS for the whole house, the server going down means no name resolution for anyone. Two cheap mitigations: the public-fallback choice you made above, and a small UPS so the server rides out power blips.

### Optional: run a second AdGuard
For true redundancy you can run a second AdGuard instance on another machine (a Raspberry Pi is the classic choice) and list it as the secondary DNS, so if one is down the other answers. The open-source [adguardhome-sync](https://github.com/bakito/adguardhome-sync) tool keeps the two configurations identical.

> [!NOTE]
> For most homes, one AdGuard on a UPS plus a public fallback DNS is plenty. Add a second instance only if zero DNS downtime becomes important to you.
