---
title: Maintenance & Upkeep
subtitle: The small monthly rhythm that keeps a Maximus X Hero server boring
collection: My Build
order: 24
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

One deliberate wrinkle on this host: the kernel is **pinned** (to the version recorded on the GPU/HBA Passthrough page) because the **550-branch** NVIDIA driver it was installed with stops building on newer kernels — it already fails on 6.17, and on the kernel 7.0 that Proxmox 9.2 made its default. Upgrades will keep installing newer kernels — that is fine and expected — but the host keeps booting the pinned one, so "the upgrade pulled a new kernel" does **not** mean a reboot switches to it. Leave the pin alone during routine updates. Lifting it is a planned window, not a wait: the **580 branch** builds on kernel 7.0 and is the last branch supporting the Pascal 1080 Ti — and the Voice page already moves the host onto it (Ollama demands ≥570). Once the host driver is 580: `proxmox-boot-tool kernel unpin`, reboot onto the current default kernel, confirm `nvidia-smi` still answers — and since the driver version changed, reinstall the matching userspace inside the Frigate, Ollama, and faster-whisper containers in the same sitting, per the note below. When you do reboot the host for any reason, pick a kind moment — it takes every guest down and back up, and the startup order reasserts itself on the way back: the Home Assistant VM (virtual machine) before the Frigate LXC (Linux Container), since Frigate publishes to the Mosquitto broker that lives with HA.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> Open the web UI at `https://`-this-ip-`:8006` and log in as **root@pam** to reach **Updates** and the node Shell.

> [!NOTE]
> This step updates the Proxmox host only. The NVIDIA driver on the host — the one shared into the Frigate, Ollama, and faster-whisper containers — rides along through `apt` as part of this upgrade; there is no separate driver dance most months. The exception: if the upgrade bumps the `nvidia-driver` version (compare what `nvidia-smi` reports before and after), the in-container userspace drivers in the Frigate, Ollama, and faster-whisper containers must be updated to the matching version before they can use the card again. Tailscale and NUT update the same way, because both were installed as host `apt` packages.

> [!WARNING]
> Update the host *before* adding a new toy, never alongside one. If something misbehaves after a combined session, you cannot tell whether the upgrade or the new guest broke it. One change at a time keeps every failure traceable.

### Walk the guests, one at a time
With the host current, give each guest its turn — and go strictly one at a time: snapshot first whenever an update looks major, update it, confirm it still answers, then move to the next. That order is what makes the walk safe: a breakage always has an obvious author, and the pre-update snapshot is the thing you fall back to when it does.

- **Service LXCs** (AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma): these went up with the community helper scripts, so each updates with a single `update` typed in its **Console**. Three exceptions worth remembering — AdGuard's `update` command just tells you it updates from its own web UI instead; Vaultwarden's `update` opens a two-option menu — pick **1 Update VaultWarden + Web-Vault** — then *recompiles from source*, so give it the half-hour and the headroom it asks for; and Nextcloud splits in two: `apt` covers its Debian layer, but the Nextcloud app itself updates only through the NCP (NextcloudPi) panel on port 4443, per the Nextcloud page.
- **Frigate LXC**: a plain Debian container under the hood — `apt update && apt full-upgrade` in its Console for the OS. Frigate itself does not update in place — when a new release matters, follow the path from the Cameras, Doorbell & Frigate page: snapshot first, build a fresh container with the script, and copy `/config` across.
- **Home Assistant OS (VM)**: updates from inside itself, on its **Settings → System → Updates** page — core, OS, and Apps (what Home Assistant called add-ons before 2026.2) each listed there. Each update's confirmation includes a **create a backup before updating** toggle — leave it on.
- **TrueNAS (VM)**: updates under **System → Update** in its web UI. Two prompts arrived with TrueNAS 25.10: an **Update Profile** dropdown — pick **General**, the stable track — and a save-configuration dialog before install; tick **Export Password Secret Seed** and keep that file with the host-config backups. (On an older 25.x the screen is plainer; the update itself lands you on the new one.)

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!DETAILS] Updating every container's OS in one pass
> community-scripts ships a host-side helper that visits each LXC and runs its OS updates. It asks three things — **Proceed?**, **Skip Not-Running Containers?**, then a checklist of containers to exclude — answer the checklist with any you would rather do by hand. From the node Shell:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/tools/pve/update-lxcs.sh)"
> ```
>
> Read it before you run it, as always — and an honest caveat: this updates the *OS packages* inside each container, not the applications. The services themselves still update through their own `update` command, one at a time, with the AdGuard, Vaultwarden, and Nextcloud quirks above.

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
- **Frigate's footage disk** — the third IronWolf on the motherboard SATA port. Check Frigate's own storage figures (its UI reports usage), or run `df -h /mnt/frigate-footage` in the node **Shell** — the node's **Disks** view shows the drive's health, not how full it is. Footage is replaceable, but a full disk still stops new recordings.
- **Nextcloud storage** — its data lives in the service LXC; glance at the usage in its admin view.
- **The host's own NVMe** — the one disk the three above quietly assume. The node's **Summary** shows root usage, and **local-lvm** in the left tree shows the thin pool every guest disk *and every snapshot* lives in. This is where the snapshot-before-update habit collects its tax: each pass leaves a snapshot behind, and a thin pool filled by stale ones ends with **every guest pausing on IO errors at once**. So close the loop each pass — once an updated guest has proven healthy, open its **Snapshots** tab and delete the pre-update snapshots it no longer needs.

### Glance at the card
One command in the node **Shell** keeps two promises from earlier pages:

```bash
nvidia-smi
```

The **temperature** is the early-warning line the Cooling page set up — a slow creep over months is how a drying pad or failing fan announces itself while it can still be serviced on your schedule. And the **process list** should show all three borrowers — Frigate, Ollama, and faster-whisper — because a missing one usually means a driver mismatch quietly benched it rather than anything crashing loudly.

> [!TIP]
> On the same pass, open **Datacenter → Backup** and check the job — the **Job Detail** button opens a "Backup Details" window listing exactly what the job covers — confirming **AdGuard** and **Nginx Proxy Manager (NPM)** are in the selection. Selection mode **All** includes them automatically, but a hand-picked list is one careless edit from dropping the two guests you can least afford to lose: AdGuard is the household's DNS (Domain Name System), and NPM holds every reverse-proxy route and certificate. Restore everything *except* those two and the rest is unreachable until you rebuild them by hand. While the job is open, glance at its **Retention** settings too — **Keep Daily 7** and **Keep Weekly 4** (set when the backup job was created) are what prune old archives so the share does not fill forever. If the ZFS pool keeps climbing, confirm retention is still set on the job and has not drifted to "keep all."

### Confirm last night's backup actually ran
A backup job you assume is running is not a backup. The run history is **not** on the Datacenter → Backup screen (its **Job Detail** button shows the job's settings and included disks, no runs). Read last night's run in the node's **Task History**: select the node in the left tree, open **Task History**, find last night's **VZDump** entry, and double-click it — the log should end **TASK OK**. And the archive should be sitting on the TrueNAS share where vzdump writes it. Green-on-the-schedule is not enough; an archive can fail to write while the schedule still shows it "ran." Confirm a fresh `vzdump-...` archive with last night's date actually exists (`.vma.zst` for the VMs, `.tar.zst` for the containers).

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
- **Disk health** — on the **Storage** dashboard, the pool's **Storage Health** card carries the scrub story (**Last Scan**, Last Scan Errors, Last Scan Duration — the Sunday scrub should be the most recent scan), and the **Disk Health** card carries S.M.A.R.T.: since 25.10, TrueNAS's Drive Health Management polls S.M.A.R.T. on its own every 90 minutes and raises Alerts, replacing the old hand-scheduled periodic tests. The two mirror IronWolfs report genuine S.M.A.R.T. data because the whole HBA is passed through to TrueNAS with VFIO (Virtual Function I/O), so there is no emulation in the way. Watch Frigate's footage disk from the Proxmox **Disks** view, since it lives on the host side, not on the HBA.

> [!INPUT] zfs-mirror-disk1-serial | IronWolf mirror disk 1 serial

> [!INPUT] zfs-mirror-disk2-serial | IronWolf mirror disk 2 serial
> Knowing the two mirror serials in advance turns a degraded-pool panic into a careful swap — the ST4000VN006s are identical at a glance, so the serial is the only safe way to tell which one to pull from the screw-plate mounts behind the View 71's motherboard tray.

### The physical quarter-hour
Once a quarter, look at the machine, not just its dashboards:

- **Dust** — an air-duster pass over the front intake filters and a look at the GPU fins through the glass; positive pressure delays dust, it does not repeal it.
- **Fans** — all five visibly spinning, nothing newly audible. A stalled fan only flags itself in firmware at boot, and this box rarely boots.
- **UPS battery** — in the node Shell, `upsc cyberpower@localhost` with the UPS at full charge; compare `battery.runtime` against the number from the UPS page's timed drill. Batteries live three to five years — a big slide in runtime, or `RB` appearing in `ups.status`, means a replacement pack, on your schedule rather than mid-outage.
- **BIOS keepsakes** — if a BIOS update happened this quarter, re-save the `PVE-BASE` profile (ASUS version-locks profiles). And remember the board's coin cell is a consumable: a clock that resets or settings that vanish after an outage means a fresh CR2032 and a profile load, per the Hardware & BIOS page — cheaper found here than the morning TrueNAS refuses to start because VT-d silently reverted.

> [!DETAILS] The night shift — every scheduled job in one place
> Everything this collection put on a clock, in Eastern summer time (the Nextcloud window is pinned to UTC, so it alone shifts an hour earlier in winter):
>
> | Time | Job |
> |---|---|
> | every 15 min | ZFS snapshots |
> | 12:00 a.m. Sunday | ZFS scrub |
> | 1–5 a.m. daily | Nextcloud maintenance window (UTC hour 5 opens a 4-hour window) |
> | 2:30 a.m. daily | Proxmox vzdump of every guest → NAS |
> | 3:00 a.m. Sunday | host-config tarball to the NAS |
> | 3:00 a.m. Monday | SMART short test, both mirror drives |
> | 4:00 a.m. on the 7th & 21st | SMART long test, one mirror drive each |
> | overnight daily | Home Assistant's own backup ("System optimal" picks its slot) |
>
> The overlaps are deliberate losses: vzdump runs inside Nextcloud's window and the scrub's tail can brush it on Sundays, but every job here is either a point-in-time snapshot or an ordinary transaction — simultaneous ones just run slower, at hours nobody is awake. If the server ever feels sluggish between 2 and 4 a.m., this table is the reason, not a fault.

### Let the rest come to you
Everything not on these two lists is event-driven, and you already built the events. Uptime Kuma shouts when a service dies, TrueNAS emails when a disk or scrub complains, and the NUT (Network UPS Tools) shutdown drill on the CyberPower UPS (uninterruptible power supply) proved a power cut handles itself. The Home Assistant leak automations already make the Third Reality sensors announce a wet floor on the Nest speakers. If no alert fires between passes, the server needs exactly none of your attention — which is the entire point of the build.
