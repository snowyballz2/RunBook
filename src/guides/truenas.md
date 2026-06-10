---
title: TrueNAS
subtitle: A real NAS — ZFS pools on passed-through disks
collection: Proxmox Home Server
order: 7
accent: violet
---

## Install it

### Install TrueNAS in a VM
TrueNAS turns a pile of disks into a proper network-storage appliance — shared folders, snapshots, and the ZFS filesystem guarding your data. Unlike HAOS it ships as a normal installer ISO, so the wizard from the *Virtual machines* guide is your starting point.

1. Download **TrueNAS Community Edition** from [truenas.com](https://www.truenas.com/download-truenas-community-edition/) and upload the ISO to Proxmox (the upload expandable in the *Virtual machines* guide).
2. Run the Create VM wizard: 2 cores, **8192 MB memory** (TrueNAS is memory-hungry — ZFS uses RAM as cache; give it more if you can spare it), a 32 GB boot disk, network on `vmbr0`.
3. Install from the console, then browse to the address the console prints.

> [!NOTE]
> ECC RAM is ideal for ZFS data integrity but not required at home — most consumer boards don't support it, and that's fine.

> [!DETAILS] Skip the wizard — helper script
> community-scripts has a TrueNAS helper too: it builds the VM (2 cores, 8 GB RAM, 16 GB boot disk) and fetches the official ISO straight from download.truenas.com, letting you pick the version (default: latest stable). Run it in the Proxmox shell — read it first, as always:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/truenas-vm.sh)"
> ```
>
> It only builds the empty VM and attaches the installer — everything from the installer walkthrough below onward still applies, including the disk passthrough.

> [!DETAILS] What the installer asks, and your first login
> Boot the VM and pick **Install/Upgrade**. The installer asks which disk to install onto — pick the only one offered, the virtual boot disk (your data disks aren't attached yet; that's the next step, and it's deliberate). It then asks you to set a password for the administrative account — current versions name it `truenas_admin`. Write it down: when the VM reboots and the console prints the web address, those are exactly the credentials the login screen wants.
>
> When the install finishes, detach the installer: **Hardware → CD/DVD Drive → Do not use any media** (the eject step from the *Virtual machines* guide). If the VM keeps landing back in the installer at every boot, that's why.

### Give it real disks — passthrough
The part that makes it a *real* NAS: ZFS wants to manage whole physical drives, not virtual disks. In the **Proxmox host shell**:

```bash
# Find your data disks' stable IDs (match model + serial):
lsblk -o +MODEL,SERIAL
ls -l /dev/disk/by-id/

# Attach each disk to the VM (here VM 101) on its own slot —
# first data disk on scsi1, second on scsi2:
qm set 101 -scsi1 /dev/disk/by-id/ata-FIRST-DISK-ID
qm set 101 -scsi2 /dev/disk/by-id/ata-SECOND-DISK-ID
```

Reboot the VM. The disks appear under **Storage** in TrueNAS — build a pool there. With two disks, choose a **mirror**: one drive can die and your data survives.

> [!WARNING]
> Use disks with nothing on them you care about — TrueNAS will claim them entirely.

> [!NOTE]
> For later: serious builds pass through a whole disk-controller card instead (PCIe passthrough — that is what the VT-d/IOMMU setting from the *Prep & BIOS* guide was for), but per-disk passthrough is the right starting point.

## Make storage

### Create a mirrored pool
A pool is ZFS's big bucket: your physical disks fused into one storage unit. In the TrueNAS web interface, go to **Storage** and click **Create Pool** to open the Pool Creation Wizard — name the pool (lowercase, something like `tank`), set the **Layout** to **Mirror**, and select your two disks. The wizard ends on a **Review** screen; click **Create Pool** there to finalize.

> [!DETAILS] How the wizard picks the disks
> The **Automated Disk Selection** fields do the choosing for you: pick your drives' size in the **Disk Size** dropdown and set **Width** to 2, putting both disks in one mirrored vdev. Prefer to point at the disks yourself? Click **Manual Disk Selection** instead. A mirror needs at least two disks of the same size, and the pool's usable capacity is one disk's worth — the second holds the live copy. Pool names allow up to 50 lowercase alphanumeric characters.
>
> Only one spare disk? A single-disk pool works fine to start — just know it has zero redundancy until you add a mirror partner, so treat it accordingly.

### Add a dataset with the SMB preset
Datasets are the folders-with-superpowers inside a pool — each carries its own settings, and snapshot tasks target them individually. Go to **Datasets**, select the pool's root dataset, and click **Add Dataset**: enter a **Name** (say `files` — you can add more later, one per purpose: `backups`, `media`) and set **Dataset Preset** to **SMB**, then save.

> [!DETAILS] What the SMB preset actually changes
> It tunes the dataset for Windows-style sharing: case-insensitive filenames and NFSv4 ACLs, the permission style SMB expects. It also auto-fills the share name with the dataset name when you create the share in a moment. For a dataset that will never be shared, **Generic** is the right preset instead.

## Share it

### Create a user for the share
TrueNAS requires at least one local SMB user before it will create a share — and you cannot connect to shares as root or any built-in account. Go to **Credentials → Users**, click **Add**, and fill in a **Full Name**, a **Username**, and a strong password. Leave **SMB User** selected (it is by default) — that checkbox is what makes these credentials valid for share access.

> [!NOTE]
> These are the credentials you will type on every laptop and phone that connects. One shared household user is fine to start; you can add per-person users later.

### Create the SMB share
Go to **Shares** and click **Add** on the **Windows (SMB) Shares** widget. Point the path at your dataset — the share name pre-fills from the dataset name, courtesy of the SMB preset — and save. When TrueNAS prompts to enable or restart the **SMB service**, accept: that is what puts the share on the network.

### Connect from your computers
The share answers at the VM's IP. Enter your TrueNAS user's credentials when asked:

```bash
# Windows — type into a File Explorer address bar:
\\192.168.1.20\files

# macOS — Finder > Go > Connect To Server:
smb://192.168.1.20
```

Swap in your own VM's IP and share name.

> [!DETAILS] Making it stick across reboots
> ```bash
> # Windows — map a persistent drive letter:
> net use Z: \\192.168.1.20\files /PERSISTENT:YES
>
> # Linux — mount it with cifs:
> sudo mount -t cifs //192.168.1.20/files /mnt/files -o username=YOUR_USER
> ```

## Protect the data

### Schedule snapshots — and meet the scrub
Go to **Data Protection** and click **Add** on the **Periodic Snapshot Tasks** widget: pick your dataset, a schedule, and a **Snapshot Lifetime** (how long each one is kept). Snapshots are nearly free in ZFS — schedules as frequent as every 15 minutes are common.

The pool's other guardian is already on duty: TrueNAS generated a default **scrub task** — a routine integrity pass over the whole pool — when you created it, set to run every Sunday at 12:00 AM. You can see it in the **Scrub Tasks** widget on the same page.

> [!DETAILS] What a snapshot can and cannot save you from
> A snapshot is a point-in-time picture of the dataset — delete or overwrite a file by accident and you can reach back and recover it. But snapshots live in the same pool, on the same disks: they protect against fat fingers, not against the pool itself dying. One field to know: the **Naming Schema** must include the time elements `%Y`, `%m`, `%d`, `%H` and `%M`.

> [!NOTE]
> Honest accounting: a NAS is not a backup. The mirror survives one dead drive and snapshots survive accidental deletion — neither survives fire, theft, or both drives going at once. Anything you truly cannot lose needs a copy on separate hardware; the *Make it safe to tinker* guide covers that distinction and how to act on it.

> [!DETAILS] Make it the storage hub — and the offsite question
> Once the share works, the rest of the build can lean on it: point Proxmox's scheduled backups here (the *Make it safe to tinker* guide) and Home Assistant's backups too (the *Home Assistant OS* guide), so their safety copies live on different disks than the things they protect.
>
> For the small set of data you truly cannot lose, TrueNAS has built-in **Cloud Sync** tasks (**Data Protection → Cloud Sync Tasks**) that push encrypted copies to cloud storage on a schedule. The discipline that keeps costs sane: bulk, replaceable data — camera recordings, media — stays local-only; offsite is reserved for the irreplaceable.
