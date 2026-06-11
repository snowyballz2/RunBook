---
title: Containers
subtitle: Your first general-purpose LXC container
collection: Proxmox Home Server
order: 4
accent: azure
---

## Create it

### Create a Debian container
Use a lightweight LXC container for services that don't need a full VM. From the web UI: **Create CT**, pick the Debian template, give it 2 cores and 2 GB of RAM to start.

> [!DETAILS] What would you actually run in one?
> A container shares the host's kernel, so it starts in about a second and idles at a few hundred MB of RAM — perfect for one small always-on service each. The home-server classics:
>
> - **Pi-hole / AdGuard Home** — network-wide ad blocking for every device in the house (the most popular first container)
> - **Jellyfin or Plex** — stream your movies, music, and photos to TVs and phones
> - **Nextcloud** — your own Google Drive / Photos replacement (the *Nextcloud* guide)
> - **Vaultwarden** — self-hosted Bitwarden password manager
> - **Paperless-ngx** — scan, archive, and search every document you own
> - **Uptime Kuma** — a dashboard that pings your services and alerts you when one dies (the *Uptime Kuma* guide)
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

## Get comfortable inside

### Log in at the Console
Select the container in the left tree and open **Console**. Log in as `root` with the password you set in the wizard — you're standing inside a small, fresh Debian machine.

> [!DETAILS] How to reach it over SSH instead
> The Debian standard template comes with an SSH server already running, but `ssh root@<ip>` with a **password** fails out of the box — Debian's sshd defaults root login to keys only (`PermitRootLogin prohibit-password`). Two honest paths:
>
> - If you filled in the **SSH Public Key** field in the Create CT wizard, key-based `ssh root@<ip>` already works. Done.
> - If not, get a shell the easy way first — the Console, or `pct enter 101` from the node's **Shell**, which drops you into a root shell with no password asked — and add your key:
>
> ```bash
> mkdir -p /root/.ssh && chmod 700 /root/.ssh
> # Paste your own public key:
> echo "ssh-ed25519 AAAA... you@laptop" >> /root/.ssh/authorized_keys
> ```
>
> You *can* instead set `PermitRootLogin yes` in `/etc/ssh/sshd_config` and `systemctl restart ssh`, but a guessable root password on the network is a worse trade than a key, even on a home LAN. (If a leaner template ever lacks sshd: `apt install -y openssh-server`.)

### Bring Debian up to date
Templates are built ahead of time, so the packages inside are already a little stale. First command in any new container:

```bash
apt update && apt full-upgrade -y
```

> [!DETAILS] Why full-upgrade rather than upgrade
> `full-upgrade` will also add or remove packages when dependencies have shifted since the template was built — the right tool for a first sync. For routine updates later, plain `apt upgrade` is the more conservative habit. While you're in there, `dpkg-reconfigure tzdata` sets the timezone so the container's logs match your clock.

## Run it like an appliance

### Make it start at boot
A useful container should survive a power cut without you remembering it exists. Select the container, open **Options**, and set **Start at boot** to Yes — or from the node's **Shell**:

```bash
# Swap in your container's ID:
pct set 101 -onboot 1
```

> [!DETAILS] Where the ordering knobs live
> The same **Options** panel has **Start/Shutdown order** and **Startup delay**, for when one guest must come up before another — a DNS container before everything that resolves names, say. On host shutdown, Proxmox asks each container to stop cleanly and waits up to 60 seconds by default before moving on.

### Grow the disk when it gets tight
That 8 GB starter disk can be enlarged live, no downtime. In the container's **Resources** panel, select the **Root Disk** row, then **Volume Action → Resize** and enter a **Size Increment (GiB)** — or:

```bash
pct resize 101 rootfs +4G
```

The filesystem inside grows along with it — unlike a VM, where the guest has to be resized separately (that story is in the *Virtual machines* guide).

> [!WARNING]
> This is one-way: shrinking a container disk is not supported. Grow in modest increments rather than one generous guess.

### Add cores or memory on the fly
In **Resources**, select the **Cores** or **Memory** row and click **Edit** — Proxmox hot-plugs most changes into the running container instantly, no reboot. The rare change that can't apply live shows in red as pending until the next restart.

```bash
pct set 101 -cores 4
pct set 101 -memory 4096   # MB
```

### Snapshot before you change anything
Snapshots are instant and nearly free. Before any risky change to a container — an upgrade, a config experiment — take one, so rollback is a single click.

> [!TIP]
> Name snapshots for *what you were about to do* ("before-adguard-upgrade"), not the date. Future-you will thank present-you.

> [!DETAILS] How to take and roll back a snapshot
> - Select the container in the left tree and open **Snapshots**.
> - Click **Take Snapshot**, give it a name that says what you were about to attempt, and an optional description.
> - To undo, select the snapshot in the list and click **Rollback** — everything since that snapshot is discarded.
> [!TIP]
> That's the whole lifecycle: create, log in, set-and-forget. When you're ready to give a container a real job, the *AdGuard Home* guide is the classic first one.
