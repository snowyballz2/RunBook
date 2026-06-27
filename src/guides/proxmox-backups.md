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
> The defaults are good: **ZSTD** compression is fast and effective, and **Snapshot** mode backs up running guests with the lowest downtime, at the cost of a small inconsistency risk. For VMs (virtual machines), the Qemu agent you enabled in the *Virtual machines* guide briefly freezes the filesystem during backup to improve consistency.

> [!WARNING]
> The default `local` storage is a directory on the Proxmox machine's own disk. Backups there protect against your mistakes, but not against that machine failing — point the job at separate hardware if you can.

> [!DETAILS] Sending backups to separate hardware
> If you built the NAS (network-attached storage) from the *TrueNAS* guide, it is the natural home for backups — different disks, different failure domain. Make a share for them, then in **Datacenter → Storage → Add** choose **SMB/CIFS** (or **NFS**), enter the NAS address, share, and credentials, and tick **VZDump backup file** under Content. Proxmox mounts it under `/mnt/pve/<name>`; select that as the backup job's Storage.
>
> If TrueNAS runs *as a VM on this same server*, its disks at least survive a Proxmox boot-disk failure — but anything that takes out the whole machine takes the backups too. Any other box on the network with an SMB (Server Message Block) or NFS share works the same way.

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

## Back up the host itself

### Save the host's own config off-box
Everything above protects your *guests*. None of it protects the **Proxmox host** — the hypervisor underneath. The backup job copies the VMs and containers as machines, but the host's own configuration lives on its boot disk, and `vzdump` never touches it. If that boot disk fails, you could restore every guest from the NAS and still be stranded: a fresh Proxmox install does not know your storage, your network, your passthrough, or your UPS (uninterruptible power supply) wiring.

> [!WARNING]
> A pile of vzdump archives is not a complete recovery plan on its own. Restoring them needs a working host first, and the dozen settings that make *this* host work — the bridges, the IOMMU (Input/Output Memory Management Unit) flags, the PCIe (Peripheral Component Interconnect Express)-passthrough commands — exist nowhere in those archives. Copy the host's config off the box now, while it still boots, or plan on rebuilding it from memory under pressure.

Copy these off the host and onto the NAS share (the same one the backup job already uses), and put the short secrets in your password manager too:

- **`/etc/pve`** — the cluster filesystem: every VM and container definition, plus your storage config. This is the heart of it.
- **`/etc/network/interfaces`** — your bridges (`vmbr0` and friends) from the *Proxmox install* groundwork. Get this wrong on a rebuild and nothing reaches the network.
- **`/etc/fstab`** — any mounts the host brings up at boot.
- **`/etc/modprobe.d`** — the IOMMU/VFIO (Virtual Function I/O) lines that make GPU and PCIe **passthrough** work, from the *Virtual machines* and GPU guides.
- **`/etc/nut`** — the **UPS**/NUT (Network UPS Tools) configuration from the *UPS and safe shutdown* guide.

> [!NOTE]
> Some of the passthrough setup is not in a file at all — it is the **`qm set`** commands you ran by hand, like the `serial=` line and the `hostpci` PCIe assignments. Those live only in `/etc/pve/qemu-server/<id>.conf`, which is inside `/etc/pve` above, but keep a plain-text note of the exact commands too. Re-running a command you saved is faster and surer than reverse-engineering it from a config file at 2 a.m.

> [!DETAILS] A tiny job to copy it to the NAS
> From the host **Shell**, roll the lot into one dated tarball on the backup share. The share is already mounted at `/mnt/pve/<name>` from the *Schedule it* step:
>
> ```bash
> # One archive of the host's config, dated, onto the NAS share:
> tar czf /mnt/pve/nas/host-config-$(hostname)-$(date +%F).tar.gz \
>   /etc/pve /etc/network/interfaces /etc/fstab /etc/modprobe.d /etc/nut
> ```
>
> Run it after any change to networking, storage, or passthrough — or drop it in a weekly `cron` job so it keeps pace on its own. It is small; keep a few generations. (`/etc/pve` is a live filesystem, so `tar` may warn that a file changed while reading — harmless for these config files.)

> [!TIP]
> The rebuild order after a **boot-disk failure**, once you have these copies:
> 1. **Reinstall Proxmox** fresh on the new disk — same version, same hostname and IP address.
> 2. **Restore the `/etc` bits** from your tarball, then **re-run the passthrough commands** (the `qm set ... serial=` and PCIe lines) and reboot so the IOMMU/VFIO config takes.
> 3. **Re-add the NAS storage** and **restore the guests** from vzdump, exactly as in *Know how to restore* above.
>
> Done in that order, the host comes back knowing its network, storage, and passthrough *before* the guests land on it — so the restored VMs and containers find the hardware they expect.
