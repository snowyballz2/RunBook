---
title: Containers
subtitle: My Build — the service LXCs, unprivileged by default, and how to reach them
collection: My Build
order: 4
accent: rose
---

Most of the always-on services on this box are not full virtual machines — they are lightweight **LXC (Linux Containers)**. A container shares the Proxmox host's kernel instead of booting its own, so it starts in about a second and a fresh one idles in a few tens of megabytes. That is exactly the right shape for the small, single-purpose Linux services this build runs: **AdGuard Home, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma**, and **Frigate**. The two guests that need their own kernel — **Home Assistant OS** and **TrueNAS** — are full VMs (virtual machines) instead; everything else is a container.

> [!NOTE]
> The rule for this box: if it is a Linux service, it goes in an LXC. If it needs its own kernel or is not Linux (Home Assistant OS, TrueNAS), it gets a VM. Every container here is **unprivileged** unless a hardware passthrough forces otherwise — and on this build, exactly one does.

## Create a container

### Download a Debian template first
Container templates live in storage, and a fresh Proxmox install has none. Grab one before you create the first container:

- In the left tree, click the node, then the **local** storage under it.
- Open **CT Templates**, then click the **Templates** button.
- Find **debian** with the *standard* flavour and click **Download**.

When the task log says `TASK OK`, the template is ready in the wizard.

### Walk the Create CT wizard
Click **Create CT** (top right) and step through the tabs. These are the starter values for a plain service container on this build; the heavier guests get more later.

- **General** — accept the suggested **CT ID** (every guest gets a unique number starting at 100; the suggestion is the next free one), set a hostname (e.g. `adguard`), and set a root password. **Leave Unprivileged container ticked** (more below).
- **Template** — the Debian standard template you just downloaded.
- **Disks** — 8 GB is plenty to start; it grows live later.
- **CPU** — 2 cores.
- **Memory** — 2048 MB.
- **Network** — set IPv4 to **DHCP (Dynamic Host Configuration Protocol)** only for throwaway tests. Every real service on this build gets a **static IP address** instead, because other machines point *at* these containers and the address must never move.
- **Confirm** — tick **Start after created** and finish.

> [!WARNING]
> AdGuard Home is the household **DNS (Domain Name System)** — the whole house resolves names through it — and Nginx Proxy Manager holds every reverse-proxy route. Those two especially must have a fixed address. Pin a static IP in the **Network** tab (or a DHCP reservation on the router); never leave them on roaming DHCP.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The host these containers live on. Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to create and reach them.

### Leave "Unprivileged container" ticked
On the **General** tab, keep the **Unprivileged container** box ticked — the secure default on **PVE (Proxmox Virtual Environment) 9**. An unprivileged container maps its root to an ordinary unprivileged user on the host, so a break-out from inside lands as nobody-in-particular rather than host root. Every service container on this build is unprivileged: AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, and Uptime Kuma have no reason to touch host hardware.

> [!WARNING]
> The one exception is **Frigate**. Sharing the **GTX 1080 Ti** into it for ONNX (Open Neural Network Exchange) / CUDA (NVIDIA's GPU compute platform) detection means the container needs the host's NVIDIA device nodes, which an unprivileged mapping blocks. The Frigate LXC is therefore **privileged**, with the GPU lent in by `dev0:` device lines after the driver is on the host. That is the only privileged container here — keep the box ticked everywhere else.

> [!TIP]
> Most service guides skip this wizard entirely and use a one-command community helper script from the node's **Shell** that builds the container *and* installs the service in one pass. Knowing the wizard first means you always understand what the shortcut just did. A container built that way updates by typing `update` in its *own* console later — never by re-running the script on the host, which starts building a brand-new container.

## Get inside and settle it

### Log in at the Console
Select the container in the left tree and open **Console**. Log in as `root` with the password you set in the wizard — you are standing inside a small, fresh Debian machine. From the node's **Shell** you can also drop straight in with `pct enter 100` (swap in the container's ID), no password asked.

### Bring Debian up to date
Templates are built ahead of time, so the packages inside are a little stale. First command in any new container:

```bash
apt update && apt full-upgrade -y
dpkg-reconfigure tzdata   # match the container's clock to yours
```

`full-upgrade` also adds or removes packages when dependencies have shifted since the template was built — the right tool for a first sync. For routine updates later, plain `apt upgrade` is the more conservative habit.

### Reach it over SSH instead of the Console
The Debian standard template runs an SSH (Secure Shell) server, but `ssh root@<ip>` with a **password** fails out of the box — Debian defaults root login to keys only. Either fill the **SSH Public Key** field in the wizard up front, or get in once via the Console / `pct enter` and add your key:

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
echo "ssh-ed25519 AAAA... you@laptop" >> /root/.ssh/authorized_keys
```

> [!TIP]
> Day to day you will reach these services by their **web UIs at their static IPs**, not SSH — and from anywhere over Tailscale once that subnet route is up. The SSH key is for the occasional `apt` pass and config edit.

## Run it like an appliance

### Make it start at boot
A useful container should survive a power cut without you remembering it exists. Select it, open **Options**, and set **Start at boot** to Yes — or from the host shell:

```bash
pct set 100 -onboot 1      # swap in the container's ID
```

Enable this on **every** service container so the whole stack reassembles itself after mains returns.

> [!NOTE]
> The same **Options** panel holds **Start/Shutdown order**, which matters once on this build: the **Home Assistant OS VM must start before the Frigate LXC**, because Frigate points at the Mosquitto MQTT (Message Queuing Telemetry Transport) broker inside that VM. Give the HA VM a lower order number than Frigate so the broker is up first; the plain service containers can stay at the default.

### Grow the disk, cores, or memory live
That 8 GB starter disk enlarges with no downtime — in **Resources**, select the **Root Disk** row, then **Volume Action → Resize**, or:

```bash
pct resize 100 rootfs +4G
pct set 100 -cores 4
pct set 100 -memory 4096   # MB
```

The filesystem inside grows along with the disk — unlike a VM, where the guest has to be resized separately. Proxmox hot-plugs most core and memory changes into the running container instantly.

> [!WARNING]
> Disk growth is one-way: shrinking a container disk is not supported. Grow in modest increments rather than one generous guess — Nextcloud is the one most likely to want more room over time.

### Snapshot before you change anything
Snapshots are instant and nearly free. Before any risky change — an upgrade, a config experiment — open **Snapshots**, click **Take Snapshot**, and name it for *what you were about to do* (`before-adguard-upgrade`), not the date. To undo, select it and click **Rollback**; everything since is discarded.

> [!TIP]
> That is the whole container lifecycle on this build: create unprivileged, pin a static IP, update, set start-at-boot, snapshot before you tinker. The six service containers all follow it; Frigate is the only one that breaks the unprivileged default, and only because it borrows the GPU.
