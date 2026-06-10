---
title: TrueNAS
subtitle: A real NAS — ZFS pools on passed-through disks
collection: Proxmox Home Server
order: 7
accent: violet
---

### Install TrueNAS in a VM
TrueNAS turns a pile of disks into a proper network-storage appliance — shared folders, snapshots, and the ZFS filesystem guarding your data. Unlike HAOS it ships as a normal installer ISO, so the wizard from the *Virtual machines* guide is your starting point.

1. Download **TrueNAS Community Edition** from [truenas.com](https://www.truenas.com/download-truenas-community-edition/) and upload the ISO to Proxmox (the upload expandable in the *Virtual machines* guide).
2. Run the Create VM wizard: 2 cores, **8192 MB memory** (TrueNAS is memory-hungry — ZFS uses RAM as cache; give it more if you can spare it), a 32 GB boot disk, network on `vmbr0`.
3. Install from the console, then browse to the address the console prints.

### Give it real disks — passthrough
The part that makes it a *real* NAS: ZFS wants to manage whole physical drives, not virtual disks. In the **Proxmox host shell**:

```bash
# Find your data disks' stable IDs (match model + serial):
lsblk -o +MODEL,SERIAL
ls -l /dev/disk/by-id/

# Attach each disk to the VM (here VM 101, as its second disk):
qm set 101 -scsi1 /dev/disk/by-id/ata-YOUR-DISK-ID
```

Reboot the VM. The disks appear under **Storage** in TrueNAS — build a pool there. With two disks, choose a **mirror**: one drive can die and your data survives.

> [!WARNING]
> Use disks with nothing on them you care about — TrueNAS will claim them entirely.

> [!NOTE]
> For later: serious builds pass through a whole disk-controller card instead (PCIe passthrough — that is what the VT-d/IOMMU setting from the *Prep & BIOS* guide was for), but per-disk passthrough is the right starting point.
