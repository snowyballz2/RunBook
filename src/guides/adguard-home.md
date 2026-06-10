---
title: AdGuard Home
subtitle: Network-wide ad blocking for every device in the house
collection: Proxmox Home Server
order: 4
accent: spruce
---

### Create or reuse a container
The classic first service runs in a small Debian container — make one as in the *Containers* guide (2 cores and 2 GB is plenty), or let one command build the whole thing.

> [!DETAILS] Prefer one command instead?
> community-scripts has a script that creates a fresh container with AdGuard already installed — run it on the **Proxmox host** (not inside a container):
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/adguard.sh)"
> ```
>
> You still do the fixed-IP and router steps below afterwards.

### Install and set it up
**Give the container a fixed address first.** AdGuard is about to become your network's DNS server, so its address must never change — use your router's DHCP reservation page (same trick as the *Install Proxmox* guide) to pin the container's IP.

Then, in the container's **Console**, run the official installer:

```bash
curl -s -S -L https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh | sh -s -- -v
```

> [!NOTE]
> Same rule as ever for piped scripts — download and read it first if you prefer.

Finally, browse to `http://container-ip:3000` and walk the short setup wizard. Afterwards the dashboard lives at plain `http://container-ip` and DNS answers on port 53.

### Point your whole network at it
In your router's DHCP/DNS settings, set the DNS server to the container's IP. As devices renew their leases, every phone, TV, and laptop in the house starts using AdGuard automatically — open the dashboard and watch the query log fill up.
