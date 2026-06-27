---
title: Services, Backups & Upkeep
subtitle: The last LXCs, the safety net, and the monthly rhythm
collection: My Build
order: 8
accent: spruce
---

## Spin up the service LXCs

### Stand up the six service containers
The heavy guests are done — Home Assistant (HA), TrueNAS, Frigate. These six are plain Debian LXCs (Linux Containers), each one a community-script install per its general guide, each pinned to a static IP address. Build them in any order; nothing here gates anything else. Snapshot habit from the *Containers* guide applies — snapshot before the first config change so a fumbled setting is one rollback away.

- **AdGuard Home** — household DNS (Domain Name System). See *AdGuard Home* (field `adguard-ip`, default `192.168.1.53`). This is the one the whole house depends on, so it earns the most care below.
- **Nextcloud** — files and photos, NCP appliance. See *Nextcloud* (`nextcloud-ip`, `192.168.1.52`).
- **Vaultwarden** — the synced secret store. See *Vaultwarden* (`vaultwarden-ip`, `192.168.1.56`). More on this below.
- **Homepage** — the single dashboard tying it all together. See *Homepage* (`homepage-ip`, `192.168.1.55`).
- **Nginx Proxy Manager** — clean names + certs in front of the lot. See *Reverse Proxy* (`proxy-ip`, `192.168.1.54`).
- **Uptime Kuma** — the watchman that tells you when one of the above dies. See *Uptime Kuma* (`kuma-ip`).

> [!NOTE]
> All credential fields these services need are already defined in their own guides — AdGuard's `adguard-admin-*`, NPM's `npm-*` and `dns-api-token`, Nextcloud's `nextcloud-*`/`ncp-panel-password`, Kuma's `kuma-*`, Vaultwarden's `vaultwarden-admin-token`. Fill them there as you build. This page adds no new fields.

> [!TIP]
> Point **NPM** at each of the others as you go (per *Reverse Proxy*), then add every clean URL to **Homepage** so the whole stack has one front door. Add each service to **Uptime Kuma** the moment it's up, while you remember the port — a monitor you didn't create can't go green.

## Reach it from anywhere

### Tailscale is already on the host
Remote access was wired early — *Remote Access* put Tailscale on the **Proxmox host** as a subnet router advertising `192.168.1.0/24`, with **Disable Key Expiry** set so the server never silently drops off the tailnet. That means every service above is reachable from the couch or a train at its normal LAN (local area network) address, through zero opened ports. Nothing to redo here — just confirm `tailscale status` on the host still shows the route, and that the phone (on mobile data, Wi-Fi off) can still load the Proxmox UI.

> [!NOTE]
> The household is all-Apple, so Apple sign-in on the tailnet keeps the identity in the family. Day to day, keep using the `192.168.1.x` LAN addresses — the subnet route makes the one set of bookmarks work at home and away.

## The safety net

### Schedule the vzdump job
Per *Proxmox Backups*: **Datacenter → Backup → Add**, **Selection mode: All** so guests created later are covered automatically, a quiet hour, ZSTD + Snapshot mode. Storage is the **TrueNAS SMB (Server Message Block) share** added under **Datacenter → Storage** — different disks from the boot NVMe (Non-Volatile Memory Express), so a Proxmox boot-disk failure doesn't take the archives with it. Retention: **Keep Daily 7, Keep Weekly 4**.

> [!WARNING]
> All-mode is right, but glance at the selection anyway — losing **AdGuard** (the house's DNS) or **NPM** (every proxy route and cert) and not noticing means restoring everything *except* the two guests that make the rest reachable. Both must be in the job.

### Back up the host's own config
The vzdump job saves the *guests*, never the **host**. Per *Proxmox Backups*, roll the host's config onto the same NAS (network-attached storage) share — `/etc/pve` (which carries the `qm set ... serial=` and `hostpci` passthrough lines for the HBA (host bus adapter) → TrueNAS and the GPU sharing), `/etc/network/interfaces`, `/etc/fstab`, `/etc/modprobe.d` (the IOMMU (Input/Output Memory Management Unit)/VFIO (Virtual Function I/O) lines), and `/etc/nut`. A weekly `cron` tarball keeps it current.

> [!NOTE]
> Keep a plain-text note of the by-hand passthrough commands too — the HBA VFIO assignment to TrueNAS and the GPU-into-LXC sharing exist only as commands you ran. Re-running a saved command at 2 a.m. beats reverse-engineering it from a config file.

### Send a copy offsite
The vzdump archives and the NAS data both want a copy off the property. Per *Protect TrueNAS Data*, a TrueNAS **Cloud Sync** task pushes to **Backblaze B2** on a schedule — that's the third copy that survives a fire or a theft, not just a dead disk.

## Power and survival

### NUT (Network UPS Tools), already on the host
The **CyberPower CP1500PFCLCD** is line-interactive with a USB data port, and NUT is configured on the host per *UPS Shutdown* (`usbhid-ups`, `MODE=standalone`, fields `nut-admin-user`/`nut-admin-password`). The shutdown chain waits out blips and only acts on `OB LB`, bringing guests down in **reverse startup order** — so HA outlives Frigate (the MQTT (Message Queuing Telemetry Transport) dependency), and the whole stack reassembles itself when mains returns, given the **Restore on AC Power Loss → power on** BIOS setting from *Prep & BIOS*.

> [!TIP]
> Expose NUT to the LAN read-only (`MODE=netserver`, the `hauser` account) so the HA VM (virtual machine)'s native NUT integration sees it — an automation on "On Battery" turns a 3 a.m. outage into a breakfast notification instead of a log mystery. And put the **GS308EPP switch** on a battery outlet too, so *Remote Access* keeps answering through a blip.

## Secrets, in their place

### Vaultwarden is the source of truth
Two stores, two jobs, no confusion: **Vaultwarden** is the synced secret vault — passwords, tokens, the long secrets that live across all the household's Apple devices and back up offsite with the rest. The **RunBook credential fields** scattered through these guides are deliberately *device-local*: they fill in this checklist on whatever device you're reading it on and never leave it. Put the real secrets in Vaultwarden; let the fields hold the per-device convenience copies.

> [!NOTE]
> Vaultwarden itself is in the vzdump job and the offsite B2 copy, so the vault that holds everything is itself protected two ways. Worth a one-time restore drill (below) on this guest specifically.

## Keep it boring

### The monthly pass
Per *Maintenance and Upkeep*, one twenty-minute sitting, same order: snapshot anything you're about to touch, update the **host** (*Updates → Refresh → Upgrade*; reboot if a kernel arrived), walk the guests one at a time (Debian LXCs get `apt update && apt full-upgrade`; HA and TrueNAS from their own UIs; AdGuard updates only from its web UI), then three glances — **Uptime Kuma** all green, last night's backup ended `TASK OK`, and nothing low on space (TrueNAS pool under **80%**, Frigate's footage drive, Nextcloud storage).

> [!NOTE]
> Tailscale and NUT need no separate update — both are `apt` packages on the host, so the host upgrade carries them along.

### The quarterly deep check
Four times a year, exercise what only matters when it's needed: one **practice restore** into a spare guest ID (delete after), confirm the **B2 Cloud Sync** last-run is recent, and read the disk tea leaves — latest **scrub** and **SMART** results on the ZFS (Zettabyte File System) mirror.

### Let the rest come to you
The events are already wired: **Uptime Kuma** pings when a service dies, **TrueNAS** emails on a disk or scrub complaint, the **HA** leak/UPS (uninterruptible power supply) automations shout when it counts. Between passes, if nothing alerts, the build wants none of your attention. That was the whole point.
