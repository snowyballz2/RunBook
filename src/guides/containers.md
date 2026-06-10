---
title: Containers
subtitle: Small always-on services in lightweight LXC containers
collection: Proxmox Home Server
order: 3
accent: spruce
---

### Create a Debian container
Use a lightweight LXC container for services that don't need a full VM. From the web UI: **Create CT**, pick the Debian template, give it 2 cores and 2 GB of RAM to start.

> [!DETAILS] What would you actually run in one?
> A container shares the host's kernel, so it starts in about a second and idles at a few hundred MB of RAM — perfect for one small always-on service each. The home-server classics:
>
> - **Pi-hole / AdGuard Home** — network-wide ad blocking for every device in the house (the most popular first container)
> - **Jellyfin or Plex** — stream your movies, music, and photos to TVs and phones
> - **Nextcloud** — your own Google Drive / Photos replacement
> - **Vaultwarden** — self-hosted Bitwarden password manager
> - **Paperless-ngx** — scan, archive, and search every document you own
> - **Uptime Kuma** — a dashboard that pings your services and alerts you when one dies
> - **A Samba share** — turn spare disk space into a network drive
> - **A Docker host** — one bigger container running Docker Compose for everything else
> - Game servers, qBittorrent, the *arr media stack…
>
> The community-scripts project has one-command installers for nearly all of these — browse them at [community-scripts.org](https://community-scripts.org/). Same habit as always: read a script before piping it into a root shell.
>
> Rule of thumb: if it's a Linux service, use a container. If it needs its own kernel or isn't Linux, that's the *Virtual machines* guide.

> [!DETAILS] Download a template first
> Container templates live in storage, and a fresh install has none. Grab one before you create your first CT:
>
> - In the left tree, click your node, then the **local** storage under it.
> - Open **CT Templates**, then click the **Templates** button.
> - Find **debian** with the *standard* flavour in the list and click **Download**.
>
> When the task log says `TASK OK`, the template is ready to use in the wizard.

> [!DETAILS] The Create CT wizard, screen by screen
> Click **Create CT** (top right) and walk the tabs:
>
> - **General** — accept the suggested **CT ID** (every container and VM on the server gets a unique number, starting at 100 — the suggestion is simply the next free one), set a hostname (e.g. `debian-test`), and set a root password for the container.
> - **Template** — pick the Debian standard template you just downloaded.
> - **Disks** — around 8 GB is plenty to start; you can grow it later.
> - **CPU** — 2 cores.
> - **Memory** — 2048 MB.
> - **Network** — set IPv4 to **DHCP** to start. You can pin a static IP once you know the container earns its keep.
> - **Confirm** — tick **Start after created** and finish.
>
> Select the container in the tree and open **Console** to log in as `root` with the password you set.

### Set up AdGuard Home in the container
The classic first service: network-wide ad blocking for every device in the house. It runs inside the Debian container you just made.

> [!DETAILS] Install and set it up
> **Give the container a fixed address first.** AdGuard is about to become your network's DNS server, so its address must never change — use your router's DHCP reservation page (same trick as the *Install Proxmox* guide) to pin the container's IP.
>
> Then, in the container's **Console**, run the official installer:
>
> ```bash
> curl -s -S -L https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh | sh -s -- -v
> ```
>
> (Same rule as ever for piped scripts — download and read it first if you prefer.)
>
> Finally, browse to `http://container-ip:3000` and walk the short setup wizard. Afterwards the dashboard lives at plain `http://container-ip` and DNS answers on port 53.

> [!DETAILS] Point your whole network at it
> In your router's DHCP/DNS settings, set the DNS server to the container's IP. As devices renew their leases, every phone, TV, and laptop in the house starts using AdGuard automatically — open the dashboard and watch the query log fill up.

> [!DETAILS] Prefer one command instead?
> community-scripts has a script that creates a fresh container with AdGuard already installed — run it on the **Proxmox host** (not inside a container):
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/adguard.sh)"
> ```
>
> You still do the fixed-IP and router steps above afterwards.
