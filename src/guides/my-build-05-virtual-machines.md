---
title: Virtual Machines
subtitle: The Home Assistant and TrueNAS VMs, and the boot order that keeps them honest
collection: My Build
order: 5
accent: spruce
---

This build runs two full virtual machines (VMs) on Proxmox: **Home Assistant OS** (the brain of the house) and **TrueNAS** (the storage server that owns the passed-through host bus adapter). Everything else on the box is a lightweight Linux Container (LXC). A VM emulates a whole computer with its own kernel, which is exactly what these two appliance operating systems want — and what lets the LSI 9300-8i HBA be handed whole to TrueNAS later. This page builds both VMs, walks the Create VM wizard for your hardware, and sets the start order so the Frigate container never comes up before the broker it depends on.

> [!NOTE]
> Two VMs on this machine, no more. Service apps (AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma, Frigate) all run as LXCs — ten of those cost less RAM than one VM. Reach for a VM only when you need an appliance OS with its own kernel, which is the case for both Home Assistant OS and TrueNAS.

## Before you build

### Confirm the host is ready
Log in to the Proxmox web UI and confirm the host is in the state the earlier pages left it: the NVIDIA driver lives on the host and is shared into LXCs, and the 9300-8i HBA is VFIO-bound and ready to attach to the TrueNAS VM. Neither VM gets the GPU.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The web UI answers at `https://`-this-IP-`:8006`. Log in as `root@pam`.

> [!SECRET] proxmox-root-password | Proxmox root password
> The password set during the Proxmox install. Also in Vaultwarden.

### Get the install media into Proxmox storage
The two VMs need different kinds of media, and only one is a normal ISO:

- **TrueNAS** ships as a standard installer **ISO**. In the left tree, click the **local** storage under your node, then **ISO Images → Download from URL**, and paste the TrueNAS Community Edition download link so the server pulls it directly (faster than uploading from your laptop). Wait for `TASK OK`.
- **Home Assistant OS** ships as a **disk image (`.qcow2`)**, not an ISO — there is no installer to boot. You either run the community HAOS helper script from the Proxmox shell, or import the image manually with a short run of `qm` commands. The wizard steps below cover the ISO path (TrueNAS); the Home Assistant note flags where it diverges.

> [!WARNING]
> Do not VFIO-bind or pass the 1080 Ti to either VM. The GPU stays on the host and is shared into LXCs. The only PCIe passthrough on this build is the HBA into the TrueNAS VM. Home Assistant reaches detection and voice services over the LAN, not through a passed-through card.

## Build the TrueNAS VM

### Walk the Create VM wizard
Click **Create VM** (top right) and step through the tabs with these values:

- **General** — name it `truenas`. Accept the suggested VM ID (VMs and containers share one pool of ID numbers; the suggestion is the next free one).
- **OS** — pick the TrueNAS ISO you downloaded into local storage.
- **System** — leave the defaults, but tick **Qemu Agent** so Proxmox can read the VM's IP address and shut it down cleanly later.
- **Disks** — a **32 GB** boot disk on the NVMe is plenty; TrueNAS keeps its OS small and its data on the pool.
- **CPU** — **2 cores**.
- **Memory** — **8192 MB**. ZFS leans on RAM for its cache, so this is the one VM worth feeding generously.
- **Network** — leave it on bridge **vmbr0** so the VM sits on the LAN like any other device.

Confirm, but **don't add the HBA yet** — that happens after first boot.

> [!DETAILS] Attach the HBA after the wizard, before install
> Once the VM exists, open its **Hardware** tab → **Add → PCI Device**, select the 9300-8i, and tick **All Functions**. Add it to this VM only. With the whole controller passed through, TrueNAS sees the **two** mirror IronWolf disks as raw bare-metal drives with real SMART — no per-disk `serial=` plumbing. (The third IronWolf is Frigate's footage drive on a motherboard SATA port, so it stays with the host and never appears in TrueNAS.)

### Install from the console
Select the VM, click **Start**, then **Console**, and run the TrueNAS installer exactly as you would on physical hardware. When it finishes and reboots, the console prints the management IP address.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> Pin it with a DHCP reservation on the router so it never moves.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — this is the web UI login.

### Eject the installer ISO
Once TrueNAS boots from its own disk, open the VM's **Hardware** tab, double-click the **CD/DVD Drive**, and choose **Do not use any media**. Otherwise it tries to boot the installer at every restart.

## Build the Home Assistant OS VM

### Import the disk image, then size it
Home Assistant OS has no installer, so there is no OS-tab ISO to pick — you import its `.qcow2` disk image and point a VM at it. Run the HAOS helper script from the Proxmox shell, or do it by hand: download the image, `qm create` a shell VM, `qm importdisk` the image into local storage, attach it, and set the boot disk. Give this VM:

- **2 cores**
- **8192 MB RAM** — add-ons and integrations appreciate the headroom
- **32 GB disk** (the imported HAOS image, grown to taste)
- **Network on vmbr0**
- **BIOS = OVMF (UEFI)** with a small EFI disk — HAOS expects UEFI, unlike the TrueNAS ISO

Start the VM and open **Console**; HAOS boots straight to its own setup with no installer to walk.

> [!NOTE]
> The Qemu Agent is built into Home Assistant OS, so you don't `apt-get` it the way you would in a plain Debian guest — just tick the VM's **Qemu Agent** option (Hardware/Options) so the host half is on. For TrueNAS the agent is also already present in the appliance; again, only the VM-side option needs enabling.

### Pin its address
Give the VM a fixed IP address (a DHCP reservation on the router, or static under **Settings → System → Network** once HAOS is up) before anything points at it — the phone apps, dashboards, and the Frigate-to-broker link all use this number.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!INPUT] ha-owner-user | Home Assistant owner username

> [!SECRET] ha-owner-password | Home Assistant owner password
> The owner account can't be recovered. Keep it in Vaultwarden too, but record it here so this checklist stands alone.

## Run them like appliances

### Start both at boot
An appliance should come back on its own after a power cut or host reboot. In each VM's **Options** tab, edit **Start at boot** and enable it — or from the host shell, swapping in each VM's ID:

```bash
qm set <truenas-vmid> -onboot 1
qm set <ha-vmid> -onboot 1
```

### Set the Start/Shutdown order — HA before Frigate
The same **Options** panel holds **Start/Shutdown order**, and on this build it is load-bearing. The **Home Assistant OS VM must start before the Frigate LXC**: Frigate publishes detection events to the Mosquitto MQTT broker that lives inside the Home Assistant stack, and VMs boot slower than containers. Without an explicit order, Frigate comes up first, finds no broker, and its Home Assistant entities stay dead until something restarts.

```bash
# Lower order number starts first. From the host shell:
qm set <ha-vmid>      -onboot 1 -startup order=1
pct set <frigate-ctid> -onboot 1 -startup order=2
```

> [!TIP]
> Enable **Start at boot** on every guest — TrueNAS, the Home Assistant VM, and all the service LXCs — so the whole stack returns on its own after an outage. Only the HA-before-Frigate ordering has to be exact; the rest can keep the defaults. When a battery-backup shutdown later orders the server down, the Qemu Agent channel you enabled above is what closes each VM cleanly instead of yanking its power.

### Snapshot before anything risky
Snapshots are instant and nearly free. Before an OS upgrade or a config experiment on either VM, select it in the left tree, open **Snapshots → Take Snapshot**, and name it for *what you're about to do* (`before-ha-core-upgrade`), not the date. For a running VM, tick **Include RAM** so a rollback returns it running exactly where it was. To undo, select the snapshot and click **Rollback** — everything since is discarded.

> [!WARNING]
> A snapshot is not a backup — it lives on the same disk as the VM. The off-box safety net is the Proxmox vzdump job that lands on the TrueNAS share and syncs offsite; this build configures that once the mirror exists. Snapshots are for fast undo, not disaster recovery.

### Grow a disk later
When a VM's disk fills, adding space is a two-part job and Proxmox only does the first part. From the host, grow the virtual disk; then, inside the guest, extend the partition and filesystem into the new space. Shrinking isn't supported, so size changes are one-way.

```bash
# Check the disk name (scsi0, virtio0, ...) in the VM's Hardware tab first:
qm disk resize <vmid> scsi0 +16G
```

For TrueNAS this is rare — its data lives on the ZFS pool, not the boot disk. For Home Assistant OS, grow the partition from inside HAOS after the host-side resize.
