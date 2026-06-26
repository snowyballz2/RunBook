---
title: Storage — TrueNAS + HBA Mirror
subtitle: A ZFS mirror on the passed-through HBA, plus the Frigate footage drive
collection: My Build
order: 4
accent: emerald
---

This is the execution checklist for my own build — each step points at the general guide for the full how-to, then states my specific value or choice. The HBA was already VFIO-passed to the TrueNAS VM back on the *PCIe Passthrough* page, so TrueNAS sees the raw IronWolf disks the moment it boots. Follow *TrueNAS* for the screens and *Protect TrueNAS Data* for the safety nets.

## Stand up the VM

### Create the TrueNAS VM
Build it from the normal installer ISO per *TrueNAS* (the Create VM wizard lives in *Virtual machines*). My VM: **2 cores, 8192 MB RAM** (ZFS lives on RAM — it's the one VM I'd give more if I had it spare), a **32 GB boot disk**, network on `vmbr0`. Install from the console, then detach the installer ISO so it stops re-launching at boot.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> The address the console prints after install. Pin it with a DHCP reservation on the router so it never moves.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin
> Current versions create `truenas_admin` — leave as-is unless yours differs.

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — the web UI login.

### Confirm the HBA is doing its job
The 9300-8i (IT mode) is already VFIO-passed from page 3 — no per-disk `serial=` plumbing on this build, which is the whole reason the card exists. Boot the VM and check **Storage → Disks**: I should see all **three Seagate IronWolf ST4000VN006 4TB** drives by their real model and serial, with genuine SMART, exactly as bare metal would.

> [!NOTE]
> Because the whole controller is passed through, SMART reaches TrueNAS directly — no "monitor from the host" blind spot like per-disk passthrough has. The *Protect TrueNAS Data* disk-health steps work from TrueNAS's own UI here.

> [!WARNING]
> All three disks will be claimed by ZFS. Nothing I care about is on them — that's by design.

## Build the pools

### Mirror two of the IronWolf disks
In **Storage → Create Pool**, build the data pool per *TrueNAS*: name it `tank`, **Layout → Mirror**, and select **two** of the three IronWolf drives. One disk can die and the data survives; usable space is one disk's worth (~4 TB).

> [!NOTE]
> Same model, same batch — the one failure a mirror can't absorb is both disks dying together. I accept that risk here because the irreplaceable data also goes offsite (below); bulk data is replaceable.

### Keep the third IronWolf off the mirror — it's Frigate's footage drive
The **third** ST4000VN006 is **not** part of `tank`. It's the dedicated **Frigate footage drive** (see *Frigate*) — camera recordings are bulk, replaceable, write-heavy data that has no business churning a mirror or eating snapshot space. Leave it as its own single-disk pool (or hand it to the Frigate LXC directly per the *Frigate* page). Either way: **no redundancy, no offsite, by choice.**

### Add a dataset for the share
On `tank`, add a dataset with the **SMB preset** per *TrueNAS* — `files` for general use, and a separate `backups` dataset so the build's safety copies stay out of my file snapshots.

## Share it

### Create the SMB user and share
TrueNAS needs one local SMB user before it'll share anything (*TrueNAS* covers the screens). One household user is fine to start.

> [!INPUT] smb-user | SMB share username

> [!SECRET] smb-password | SMB share password

Then create the **Windows (SMB) Share** on the `files` dataset and accept the prompt to start the SMB service. It answers at the VM's IP — connect from a Mac with `smb://` + my TrueNAS IP.

## Make it the backup hub

### Land the Proxmox backups on the NAS
Point both the **vzdump guest backups** and the **host-config backup** at a `backups` dataset on the share — the *Proxmox Backups* guide walks through mounting the share and aiming the job. This keeps every guest's archive on different disks than the guest itself.

> [!NOTE]
> HA needs one extra step the *Proxmox Backups* guide doesn't: in HA, **Settings → System → Storage**, add the SMB share as network storage with **Usage → backups**, then pick it in the backup settings. Until then HA backups sit on the VM's own disk.

### Snapshots, scrub, and disk health
Turn on the *Protect TrueNAS Data* safety nets on `tank`: periodic snapshots (a frequent short-lived task plus a daily long-lived one), confirm the default Sunday scrub, and let Drive Health Management watch the disks. Wire alerts to my email and **press both test buttons** — an untested alert chain is the silent failure I'm trying to avoid.

### Push the irreplaceable offsite to Backblaze B2
Set up a **Cloud Sync** task per *Protect TrueNAS Data*: **PUSH** to **Backblaze B2**, source = the irreplaceable data only (photos, documents), **COPY** mode, nightly, with **Remote Encryption** on. Camera footage and other bulk data stay **local-only** — B2 is reserved for what has no other home.

> [!WARNING]
> The B2 **encryption password and salt** go into Vaultwarden the moment I set them. Lose them and the offsite copy is unreadable by anyone, including me — and drill a one-off **PULL** restore once to prove the password actually unlocks the data.
