---
title: Proxmox Backups
subtitle: Scheduled, restorable copies of every container and VM
collection: Proxmox Home Server
order: 12
accent: rose
---

## Why snapshots are not enough

### Understand why a snapshot is not a backup
A snapshot lives on the same storage as the guest it protects — if that disk dies, the snapshot dies with it. A backup is different: a complete, self-contained archive of the guest's configuration and data, restorable anywhere, even on a rebuilt server.

> [!NOTE]
> Proxmox backups are always *full* backups — the whole guest in one file, nothing left behind on the original disk. Snapshots undo mistakes; backups survive hardware.

## Schedule it

### Schedule automatic backups
Go to **Datacenter → Backup** and click **Add**. Pick a storage, choose a schedule from the dropdown (a quiet hour like `21:00` daily, or `sat 02:00` weekly), and set **Selection mode** to **All** so guests you create later are covered automatically.

> [!NOTE]
> The defaults are good: **ZSTD** compression is fast and effective, and **Snapshot** mode backs up running guests with the lowest downtime, at the cost of a small inconsistency risk. For VMs, the Qemu agent you enabled in the *Virtual machines* guide briefly freezes the filesystem during backup to improve consistency.

> [!WARNING]
> The default `local` storage is a directory on the Proxmox machine's own disk. Backups there protect against your mistakes, but not against that machine failing — point the job at separate hardware if you can.

> [!DETAILS] Sending backups to separate hardware
> If you built the NAS from the *TrueNAS* guide, it is the natural home for backups — different disks, different failure domain. Make a share for them, then in **Datacenter → Storage → Add** choose **SMB/CIFS** (or **NFS**), enter the NAS address, share, and credentials, and tick **VZDump backup file** under Content. Proxmox mounts it under `/mnt/pve/<name>`; select that as the backup job's Storage.
>
> If TrueNAS runs *as a VM on this same server*, its disks at least survive a Proxmox boot-disk failure — but anything that takes out the whole machine takes the backups too. Any other box on the network with an SMB or NFS share works the same way.

> [!DETAILS] Choosing what to keep — retention
> By default every backup is kept forever, which slowly fills the storage. On the job's **Retention** tab, a sane home setup is **Keep Daily** 7 and **Keep Weekly** 4 — a week of daily restore points plus a month of weekly ones, pruned automatically. Job-level retention overrides whatever the storage itself is configured to keep.

## Prove it works

### Know how to restore
Open the backup storage in the left tree and go to its **Backups** view (or the guest's own **Backup** tab), select an archive, and click **Restore**. Restoring over an existing guest returns it to the state in the archive — everything since is discarded. From the storage's Backups view, the dialog also accepts a different, unused **CT/VM ID** — restoring a *copy* alongside the original, the gentlest way to do the practice run below.

> [!TIP]
> A backup you have never restored is a hope, not a plan. Do one practice restore into a spare guest ID while nothing is on fire, just to see the process work.

> [!DETAILS] Restoring without touching the original
> From the host's **Shell** you can restore an archive into a brand-new guest ID, leaving the original running untouched:
>
> ```bash
> # VM backup into new ID 601:
> qmrestore /mnt/pve/nas/dump/vzdump-qemu-888-....vma.zst 601
> # Container backup into new ID 600:
> pct restore 600 /mnt/pve/nas/dump/vzdump-lxc-777-....tar.zst
> ```
>
> Swap in your storage path and the archive's real filename. This is also how you test restores safely.

> [!NOTE]
> One scope line worth keeping in mind: this job protects your *guests* — the containers and VMs as machines. The files on the NAS itself (documents, photos, camera footage) are in none of these archives — the TrueNAS VM's backup carries its small boot disk, not the passed-through data disks. Protecting what's *on* the NAS — snapshots, scrubs, an offsite copy — is the next guide's whole job.

> [!DETAILS] The bigger hammer: Proxmox Backup Server
> Proxmox makes a dedicated companion product, **Proxmox Backup Server**, that upgrades this job's full-archive approach to incremental, deduplicated backups with scheduled verification — after the first run only changed data moves, so dozens of restore points cost little more than one. The honest catch comes from its own documentation: "Installing the backup server directly on the hypervisor is not recommended" — PBS earns its keep on a separate machine, which is its own project. For a one-server home, the vzdump job above is right-sized; PBS is the upgrade path when your backups outgrow it.
