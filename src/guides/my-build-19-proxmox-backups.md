---
title: Proxmox Backups
subtitle: Scheduled vzdump of every guest to the NAS, plus the host's own config and a rebuild order
collection: My Build
order: 19
accent: amber
---

This box runs a lot of machines: the Home Assistant and TrueNAS VMs (virtual machines), the Frigate LXC (Linux Container), and the row of service containers — AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma. This page makes every one of them restorable, on this hardware or a rebuilt one, and then protects the thing the guest backups quietly assume: the **Proxmox host** underneath them.

> [!NOTE]
> A snapshot lives on the same storage as the guest it protects — if that disk dies, the snapshot dies with it. A backup is different: a complete, self-contained archive of the guest, restorable anywhere. Proxmox vzdump backups are always *full* backups — the whole guest in one file. Snapshots undo mistakes; backups survive hardware.

## Send backups to the NAS, not the boot disk

### Add the TrueNAS share as backup storage
The 500GB NVMe (Non-Volatile Memory Express) boot drive holds the Proxmox OS and Frigate's cache — it is the last place backups belong, because a backup on the same disk as everything it protects dies with that disk. The natural home is the `backups` dataset on the TrueNAS ZFS (Zettabyte File System) mirror: different drives, a different failure domain, reached over SMB (Server Message Block). Once the mirror exists and that dataset is shared, add it to Proxmox.

In the Proxmox web interface at `https://`-the-host-IP-`:8006`, go to **Datacenter → Storage → Add → SMB/CIFS**. Give it an ID like `nas-backups`, enter the TrueNAS address as the **Server**, pick the `backups` **Share**, fill in the SMB **Username** and **Password**, and under **Content** tick **VZDump backup file** (and **Disk image** only if you want it as general storage too). Proxmox mounts it under `/mnt/pve/nas-backups`.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20

> [!INPUT] smb-user | SMB share username

> [!SECRET] smb-password | SMB share password

> [!WARNING]
> The TrueNAS VM lives *on this same server*. Its disks survive a Proxmox boot-disk failure — so guest backups landing there are still restorable after a fresh install — but anything that takes out the whole machine takes them too. That is exactly why the offsite copy to Backblaze B2 exists for the irreplaceable files; the guest archives here are the on-site, fast-restore tier.

## Schedule the guest backups

### Schedule automatic vzdump of every guest
Go to **Datacenter → Backup** and click **Add**. Set **Storage** to `nas-backups`, choose a schedule from the dropdown — a quiet hour like `02:30` daily works on this build — and set **Selection mode** to **All** so any guest you create later is covered without touching the job again.

> [!NOTE]
> The defaults are right here: **ZSTD** compression is fast and effective, and **Snapshot** mode backs up running guests with the least downtime. For the Home Assistant and TrueNAS VMs, the QEMU guest agent briefly freezes the filesystem during backup for a cleaner, more consistent archive.

> [!DETAILS] Mind the start order and the Frigate footage disk
> Two build-specific notes. First, the household start/shutdown order is **Home Assistant VM before the Frigate LXC** because Frigate depends on HA's Mosquitto MQTT (Message Queuing Telemetry Transport) broker — but vzdump backs each guest up independently, so the backup job does not disturb that ordering. Second, the Frigate LXC's *footage* lives on the third IronWolf on a motherboard SATA (Serial ATA) port, which is replaceable camera video — exclude that mount point from the Frigate job (its **Backup** checkbox on that mount) so you archive the container, not terabytes of recordings.

> [!DETAILS] Choosing what to keep — retention
> By default every backup is kept forever and slowly fills the share. On the job's **Retention** tab, a sane home setup is **Keep Daily** 7 and **Keep Weekly** 4 — a week of daily restore points plus a month of weekly ones, pruned automatically. Job-level retention overrides whatever the storage is configured to keep.

### Know how to restore — and prove it
Open `nas-backups` in the left tree and go to its **Backups** view (or a guest's own **Backup** tab), select an archive, and click **Restore**. Restoring over an existing guest returns it to the archived state — everything since is discarded. From the storage's Backups view the dialog also accepts a different, unused **CT/VM ID**, restoring a *copy* alongside the original — the gentlest way to do a practice run.

> [!TIP]
> A backup you have never restored is a hope, not a plan. Do one practice restore of a small service container — Uptime Kuma is a good victim — into a spare guest ID while nothing is on fire, just to watch the process work.

> [!DETAILS] Restoring into a fresh ID from the host shell
> From the host **Shell** you can restore an archive into a brand-new guest ID, leaving the original untouched:
>
> ```bash
> # VM backup (e.g. Home Assistant) into new ID 901:
> qmrestore /mnt/pve/nas-backups/dump/vzdump-qemu-100-....vma.zst 901
> # Container backup (e.g. AdGuard) into new ID 900:
> pct restore 900 /mnt/pve/nas-backups/dump/vzdump-lxc-110-....tar.zst
> ```
>
> Swap in the archive's real filename. This is also how you test restores safely.

> [!NOTE]
> Scope worth keeping straight: this job protects your *guests* — the VMs and containers as machines. The files *inside* TrueNAS (documents, photos) are in none of these archives, and the TrueNAS VM's backup carries only its small boot disk, not the passed-through mirror data. Protecting what is on the NAS — snapshots, the Sunday scrub, the offsite copy — is handled separately for the storage itself.

## Back up the host itself

### Save the host's own config off-box
Everything above protects your guests. None of it protects the **Proxmox host** — the hypervisor underneath. vzdump copies the VMs and containers as machines, but the host's own configuration lives on the NVMe boot disk and vzdump never touches it. If that disk fails, you could restore every guest from the NAS and still be stranded: a fresh Proxmox install does not know this box's storage, its network bridges, its passthrough, or its UPS (uninterruptible power supply) wiring.

> [!WARNING]
> A pile of vzdump archives is not a complete recovery plan on its own. Restoring them needs a working host first, and the handful of settings that make *this* host work — the bridge, the VT-d / IOMMU (Input/Output Memory Management Unit) flags, the VFIO (Virtual Function I/O) bind for the HBA (host bus adapter), the GPU `dev0:` shares — exist nowhere in those archives. Copy the host's config off the box now, while it still boots, or plan on rebuilding it from memory under pressure.

Copy these off the host and onto the same `nas-backups` share, and put the short secrets in Vaultwarden too:

- **`/etc/pve`** — the cluster filesystem: every VM and container definition, plus your storage config. This is the heart of it, and it contains each guest's `*.conf`, including the passthrough lines below.
- **`/etc/network/interfaces`** — the `vmbr0` bridge and any others. Get this wrong on a rebuild and nothing reaches the LAN (local area network).
- **`/etc/fstab`** — any mounts the host brings up at boot, including the third IronWolf footage disk on its SATA port.
- **`/etc/modprobe.d`** — the VFIO bind line `options vfio-pci ids=...` that claims the LSI 9300-8i HBA for the TrueNAS VM, keeping it out of a host SAS (Serial Attached SCSI) driver's hands.
- **`/etc/modules`** — the early-load `vfio`, `vfio_iommu_type1`, and `vfio_pci` modules that bring the VFIO stack up at boot.
- **`/etc/nut`** — the NUT (Network UPS Tools) configuration that talks to the CyberPower CP1500PFCLCD over USB and shuts the host down cleanly on a long outage.

> [!NOTE]
> Some of the passthrough setup is not in a file at all — it is the **`qm set`** commands you ran by hand. The HBA assignment to the TrueNAS VM (`qm set <truenas-vmid> -hostpci0 0000:01:00.0,pcie=1`) lives inside `/etc/pve/qemu-server/<id>.conf`, and the GPU `dev0: /dev/nvidia0` shares live in `/etc/pve/lxc/<ctid>.conf` for the Frigate, Ollama, and faster-whisper containers — both are inside `/etc/pve` above. But keep a plain-text note of the exact commands too. Re-running a command you saved is faster and surer than reverse-engineering it from a config file at 2 a.m.

> [!DETAILS] A tiny job to copy it to the NAS
> From the host **Shell**, roll the lot into one dated tarball on the backup share, already mounted at `/mnt/pve/nas-backups`:
>
> ```bash
> # One dated archive of the host's config, onto the NAS share:
> tar czf /mnt/pve/nas-backups/host-config-$(hostname)-$(date +%F).tar.gz \
>   /etc/pve /etc/network/interfaces /etc/fstab /etc/modprobe.d /etc/nut /etc/modules
> ```
>
> Run it after any change to networking, storage, or passthrough — or drop it in a weekly `cron` job so it keeps pace on its own. It is small; keep a few generations. (`/etc/pve` is a live filesystem, so `tar` may warn that a file changed while reading — harmless for these config files.)

> [!INPUT] proxmox-root-password | Proxmox root password

### Walk the rebuild order
After a boot-disk failure, the order matters: bring the host back knowing its hardware *before* the guests land on it, so the restored VMs and containers find what they expect.

1. **Reinstall Proxmox** fresh on a new NVMe — same version, and re-enter the host IP, hostname, and root password from your records.
2. **Redo the BIOS groundwork** if the board was reset: VT-d (Intel's IOMMU) and Virtualization (VMX) enabled, and the bottom `x4_3` slot set to x4 — the HBA's clean IOMMU group depends on it.
3. **Restore the `/etc` bits** from the host-config tarball, then **re-run the passthrough commands**: the `qm set ... -hostpci0` HBA line for TrueNAS and a `update-initramfs -u` so the VFIO bind takes. Reboot, and confirm `lspci -k` shows `Kernel driver in use: vfio-pci` on the 9300-8i.
4. **Reinstall the NVIDIA driver on the host** and confirm `nvidia-smi`, so the GPU `dev0:` shares into Frigate, Ollama, and faster-whisper work once those containers return.
5. **Re-add the `nas-backups` SMB storage** (Datacenter → Storage), then **restore the guests** from vzdump.
6. **Mind the dependency order on first boot**: start the Home Assistant VM before the Frigate LXC so the MQTT broker is up first.

> [!TIP]
> The honest test of this whole page is a host you have never lost. Once a year, read the rebuild list top to bottom and confirm each piece still exists where it says — the host-config tarball is recent, the `qm set` notes match the live config, and a guest restores into a spare ID. A recovery plan you have rehearsed is calm; one you are reading for the first time mid-disaster is not.
