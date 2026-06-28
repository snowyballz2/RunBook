---
title: Maintenance & Upkeep
subtitle: The small monthly rhythm that keeps a Maximus X Hero server boring
collection: My Build
order: 23
accent: spruce
---

A home server earns its keep by being forgettable. The drives in this box — the 500GB NVMe (Non-Volatile Memory Express) running Proxmox, the two IronWolf ST4000VN006s in the ZFS (Zettabyte File System) mirror on the LSI 9300-8i HBA (host bus adapter), the third IronWolf holding Frigate footage on a motherboard SATA (Serial ATA) port — all of it should sit there doing its job between your visits. This page is the visit: a twenty-minute pass once a month, plus one deeper drill each quarter. Do it on a calendar and the build stays the quiet appliance the rest of these pages were aiming for.

> [!NOTE]
> Almost everything else is event-driven, and earlier pages already wired the events. Uptime Kuma pings you when a service dies, TrueNAS emails when an IronWolf or a scrub complains, and Network UPS Tools (NUT) on the CyberPower CP1500PFCLCD handles a power cut on its own. The monthly pass is the one piece that still needs a human, because "did the backup run?" and "is anything filling up?" are questions nothing asks for you.

## Stay current

### Update the Proxmox host first
Update the host (the i7-8700K / Z370 machine, Proxmox VE) before touching anything else, and before installing anything new. In the Proxmox web interface, select the node in the left tree, open **Updates**, click **Refresh** to pull the package list, then **Upgrade**. The same thing happens from the node **Shell** if you prefer:

```bash
apt update
apt full-upgrade
```

If the upgrade pulls a new kernel, finish with a host reboot to actually run it — but pick a kind moment, because rebooting the host takes every guest down and back up with it. The order this build cares about reasserts itself on the way back up: the Home Assistant VM (virtual machine) must be running before the Frigate LXC (Linux Container), since Frigate's detections publish to the Mosquitto broker the Zigbee and camera stack depends on.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach **Updates** and the node Shell.

> [!NOTE]
> This step updates the Proxmox host only. The NVIDIA driver on the host — the one shared into the Frigate, Ollama, and faster-whisper containers — rides along through `apt` as part of this upgrade; there is no separate driver dance most months. Tailscale and NUT update the same way, because both were installed as host `apt` packages.

> [!WARNING]
> Update the host *before* adding a new toy, never alongside one. If something misbehaves after a combined session, you cannot tell whether the upgrade or the new guest broke it. One change at a time keeps every failure traceable.

### Walk the guests, one at a time
With the host current, give each guest its turn — and go strictly one at a time: snapshot first whenever an update looks major, update it, confirm it still answers, then move to the next. That order is what makes the walk safe: a breakage always has an obvious author, and the pre-update snapshot is the thing you fall back to when it does.

- **Service LXCs** (AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma): these went up with the community helper scripts, so each updates with a single `update` typed in its **Console**. Two exceptions worth remembering — AdGuard's `update` command just tells you it updates from its own web UI instead, and Vaultwarden's `update` *recompiles from source*, so give it the half-hour and the headroom it asks for.
- **Frigate LXC**: a plain Debian container under the hood — `apt update && apt full-upgrade` in its Console for the OS, with the Frigate image itself following its own update path.
- **Home Assistant OS (VM)**: updates from inside itself, on its **Settings → System → Updates** page — core, OS, and add-ons each listed there.
- **TrueNAS (VM)**: updates under **System → Update** in its web UI.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!DETAILS] Updating every container's OS in one pass
> community-scripts ships a host-side helper that visits each LXC and runs its OS updates, with a menu to skip any you would rather do by hand. From the node Shell:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/update-lxcs.sh)"
> ```
>
> Read it before you run it, as always — and an honest caveat: this updates the *OS packages* inside each container, not the applications. The services themselves still update through their own `update` command, one at a time, with the AdGuard and Vaultwarden quirks above.

## Make it a rhythm

### Do the monthly pass
One sitting, roughly twenty minutes, the same order every time. Put a recurring "server pass" event on the calendar — that is the entire scheduling system this needs.

1. **Snapshot** anything you are about to touch.
2. **Update the host**, and reboot if a kernel arrived.
3. **Walk the guests**, one at a time, confirming each still answers.
4. **Glance at the dashboards** — Uptime Kuma all green, and the points below.

> [!INPUT] kuma-ip | Uptime Kuma container IP | 192.168.1.57
> The single page that tells you, at a glance, whether everything is still answering.

### Glance at free space
A full disk fails loudly and at the worst time, so this glance is its own habit. Three places hold most of the risk on this build:

- **TrueNAS ZFS pool** — on the **Storage** dashboard, keep the mirror under roughly **80%** full. Past that, ZFS slows down and snapshots have nowhere to grow. This pool also holds the nightly Proxmox backups, so it creeps up from two directions.
- **Frigate's footage disk** — the third IronWolf on the motherboard SATA port. Check it from the Proxmox node's **Disks** view or in Frigate's own storage figures. Footage is replaceable, but a full disk still stops new recordings.
- **Nextcloud storage** — its data lives in the service LXC; glance at the usage in its admin view.

> [!TIP]
> While you are in **Datacenter → Backup**, open the job and confirm **AdGuard** and **Nginx Proxy Manager (NPM)** are actually in the selection. Selection mode **All** includes them automatically, but a hand-picked list is one careless edit from dropping the two guests you can least afford to lose: AdGuard is the household's DNS (Domain Name System), and NPM holds every reverse-proxy route and certificate. Restore everything *except* those two and the rest is unreachable until you rebuild them by hand. While the job is open, glance at its **Retention** settings too — **Keep Daily 7** and **Keep Weekly 4** (set when the backup job was created) are what prune old archives so the share does not fill forever. If the ZFS pool keeps climbing, confirm retention is still set on the job and has not drifted to "keep all."

### Confirm last night's backup actually ran
A backup job you assume is running is not a backup. In **Datacenter → Backup**, click into the job and read its task log — the most recent run should end **TASK OK**, and the archive should be sitting on the TrueNAS share where vzdump writes it. Green-on-the-schedule is not enough; an archive can fail to write while the schedule still shows it "ran." Confirm a fresh `.vzdump` file with last night's date actually exists.

> [!WARNING]
> Vaultwarden is the guest where "probably backed up" is unacceptable — it holds every secret this build runs on. If its container is in the nightly job and last night's run is TASK OK, the vault is covered. If the backup glance ever shows a gap, fix that before anything else on the list.

## Drill what you cannot see

### Run the quarterly restore drill
Four times a year, exercise the things that only matter when they are needed — starting with the one nobody tests until it is too late: can you actually restore a backup? In the Proxmox web UI, pick a recent archive from the backup storage and **Restore** it into a *spare, unused* VM/LXC ID. Boot it, confirm it comes up as expected, then delete it. The point is not the spare guest; it is proving the archives on the NAS (network-attached storage) are real and restorable, on a calm afternoon rather than a bad one.

> [!TIP]
> Pin the restore drill to a guest that would genuinely hurt to lose — rotate through Vaultwarden, Home Assistant, and Nginx Proxy Manager across the year, so each gets proven restorable at least annually.

### Confirm the offsite copy and the disks
While you are in the quarterly mood, check the two long-game protections:

- **Offsite to Backblaze B2** — in TrueNAS **Data Protection**, confirm the Cloud Sync task's recent runs succeeded. The encrypted offsite copy of the irreplaceable files is the one backup you cannot eyeball, so its run history is the only proof it is moving. Once a year, also do the end-to-end pull-and-decrypt drill — that is the only test of the B2 encryption secret, the value most likely to have rotted by the time you reach for it.
- **Disk health** — read the latest ZFS scrub result and the S.M.A.R.T. status on the **Storage** dashboard's health widgets. The two mirror IronWolfs report genuine S.M.A.R.T. data because the whole HBA is passed through to TrueNAS with VFIO (Virtual Function I/O), so there is no emulation in the way. Watch Frigate's footage disk from the Proxmox **Disks** view, since it lives on the host side, not on the HBA.

> [!INPUT] zfs-mirror-disk1-serial | IronWolf mirror disk 1 serial

> [!INPUT] zfs-mirror-disk2-serial | IronWolf mirror disk 2 serial
> Knowing the two mirror serials in advance turns a degraded-pool panic into a careful swap — the ST4000VN006s are identical at a glance, so the serial is the only safe way to tell which one to pull from the View 71's rear trays.

### Let the rest come to you
Everything not on these two lists is event-driven, and you already built the events. Uptime Kuma shouts when a service dies, TrueNAS emails when a disk or scrub complains, and the NUT (Network UPS Tools) shutdown drill on the CyberPower UPS (uninterruptible power supply) proved a power cut handles itself. The Home Assistant leak automations already make the Third Reality sensors announce a wet floor on the HomePod mini and Nest speakers. If no alert fires between passes, the server needs exactly none of your attention — which is the entire point of the build.
