---
title: Virtual Machines
subtitle: The Home Assistant and TrueNAS VMs, and the boot order that keeps them honest
collection: My Build
order: 5
accent: spruce
---

This build runs two full virtual machines (VMs) on Proxmox: **Home Assistant OS** (the brain of the house) and **TrueNAS** (the storage server that owns the passed-through host bus adapter). Everything else on the box is a lightweight Linux Container (LXC). A VM emulates a whole computer with its own kernel, which is exactly what these two appliance operating systems want — and what lets the LSI 9300-8i HBA be handed whole to TrueNAS later. This page **builds the TrueNAS VM in full** and walks the Create VM wizard for your hardware. The Home Assistant OS VM is built on its own page (it uses a disk image, not the wizard), so here it gets a pointer; the shared "run them like appliances" steps at the end — start at boot, start order, snapshots, growing a disk — apply to both VMs once they exist.

> [!NOTE]
> Two VMs on this machine, no more. Service apps (AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma, Frigate) all run as LXCs — ten of those cost less RAM than one VM. Reach for a VM only when you need an appliance OS with its own kernel, which is the case for both Home Assistant OS and TrueNAS.

## Before you build

### Confirm the host is ready
Log in to the Proxmox web UI and confirm the host is in the state the earlier pages left it: **IOMMU (Input/Output Memory Management Unit) is enabled** and the 9300-8i HBA sits alone in its own IOMMU group (both done on the Install Proxmox page). The HBA is **not** bound to vfio-pci yet, and it is **not** attached to any VM — that is a separate later step on the GPU Sharing & HBA Passthrough page. So you build the TrueNAS VM here with **no HBA attached**; the controller gets passed through afterward, and only then do its disks appear for the pool. Neither VM ever gets the GPU.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The web UI answers at `https://`-this-IP-`:8006`. Log in as `root@pam`.

> [!SECRET] proxmox-root-password | Proxmox root password
> The password set during the Proxmox install. Record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build).

### Get the TrueNAS installer into Proxmox storage
TrueNAS ships as a standard installer **ISO**, and the server fetches it itself — no upload from a laptop. In the left tree, click the **local** storage under your node, then **ISO Images → Download from URL**, and paste the TrueNAS Community Edition `.iso` link from the official download page ([truenas.com/download-truenas-community-edition](https://www.truenas.com/download-truenas-community-edition/)). Wait for `TASK OK`.

> [!TIP]
> The download page lists a **SHA256** checksum next to the ISO. The **Download from URL** dialog has a **Verify** section — paste that checksum in and pick `SHA256`, and Proxmox confirms the file arrived intact before you boot it. Same habit you used for the Proxmox installer.

> [!NOTE]
> No Home Assistant OS media to fetch here — it is built on the Home Assistant & Zigbee page (it uses a disk image, not the wizard below). The wizard and install steps that follow are the TrueNAS VM only.

> [!WARNING]
> Do not VFIO-bind or pass the 1080 Ti to either VM. The GPU stays on the host and is shared into LXCs. The only PCIe passthrough on this build is the HBA into the TrueNAS VM (set up on the GPU Sharing & HBA Passthrough page). Home Assistant reaches detection and voice services over the LAN, not through a passed-through card.

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

Confirm — and do **not** add the HBA on this page. The TrueNAS install needs only the 32 GB boot disk; the data controller is attached later.

> [!DETAILS] Why the HBA is not attached here
> The 9300-8i is still claimed by the host's SAS driver at this point — it has not been bound to vfio-pci yet, so adding it as a PCI device now would either fail to pass through or pull the host's driver out from under it. The binding, the **Hardware → Add → PCI Device → All Functions** step, and the power-cycle all happen on the **GPU Sharing & HBA Passthrough page**. The whole controller is passed through (rather than individual disks) so TrueNAS sees the **two** mirror IronWolf disks as raw bare-metal drives with genuine SMART and real serials — no per-disk `serial=` plumbing. Those disks appear, and the mirrored pool is built, on the **TrueNAS Storage page**, after the passthrough is done. (The third IronWolf is Frigate's footage drive on a motherboard SATA port, so it stays with the host and never appears in TrueNAS.)

### Install from the console
Select the VM, click **Start**, then **Console**, and run the TrueNAS installer exactly as you would on physical hardware — it installs to the **32 GB NVMe boot disk** (the only disk it can see right now, which is correct). When it finishes and reboots, the console prints the management IP address.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> Pin it with a DHCP reservation on the router so it never moves.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — this is the web UI login.

### Eject the installer ISO
Once TrueNAS boots from its own disk, open the VM's **Hardware** tab, double-click the **CD/DVD Drive**, and choose **Do not use any media**. Otherwise it tries to boot the installer at every restart.

## The other VM: Home Assistant OS

The second VM — **Home Assistant OS**, the brain of the house — is built on its own page, the **Home Assistant & Zigbee page**, where it has the exact commands and credential fields. It is **not** built with the Create VM wizard above: Home Assistant OS ships as a ready-made `.qcow2` disk image rather than an installer ISO, so the image is pulled by the server (community helper script or a short run of `qm create` + `qm disk import`) and the VM boots straight to its own setup. The appliance steps below — start at boot, start order, snapshots, growing a disk — apply to it equally once it exists.

> [!NOTE]
> The **Qemu Agent** is built into both these appliance OSes — Home Assistant OS and TrueNAS — so unlike a plain Debian guest you never `apt-get` it. You only flip the VM-side half on: tick the VM's **Qemu Agent** option (in the Create VM wizard, or later under **Hardware / Options**). With it on, Proxmox can read the VM's IP, freeze the filesystem during backups, and — important later — shut the VM down cleanly when the battery backup orders the host down.

## Run them like appliances

### Start both at boot
An appliance should come back on its own after a power cut or host reboot. In each VM's **Options** tab, edit **Start at boot** and enable it — or from the host shell, swapping in each VM's ID:

```bash
qm set <truenas-vmid> -onboot 1
qm set <ha-vmid> -onboot 1
```

### Set the Start/Shutdown order — HA before Frigate
The same **Options** panel holds **Start/Shutdown order**, and on this build it is load-bearing. The **Home Assistant OS VM must start before the Frigate LXC**: Frigate publishes detection events to the Mosquitto MQTT broker that lives inside the Home Assistant stack, and VMs boot slower than containers. Without an explicit order, Frigate comes up first, finds no broker, and its Home Assistant entities stay dead until something restarts.

What you can set **now** is the order number on the Home Assistant VM (built on the Home Assistant & Zigbee page) — give it a low number so it starts first. The Frigate container does not exist yet; its matching higher order number is set on the **Cameras, Doorbell & Frigate page** when that container is created.

```bash
# Lower order number starts first. From the host shell, once the HA VM exists:
qm set <ha-vmid> -onboot 1 -startup order=1
# The Frigate side is set later, on the Cameras page, with a higher number (e.g. order=2).
```

> [!TIP]
> The same panel also has a **Startup delay** field. Because a VM boots noticeably slower than a container, you can give the Home Assistant VM a few seconds of head start there in addition to the lower order number — handy insurance that the broker is fully up before the Frigate container reaches for it.

> [!TIP]
> Enable **Start at boot** on every guest — TrueNAS, the Home Assistant VM, and all the service LXCs — so the whole stack returns on its own after an outage. Only the HA-before-Frigate ordering has to be exact; the rest can keep the defaults. When a battery-backup shutdown later orders the server down, the Qemu Agent channel you enabled above is what closes each VM cleanly instead of yanking its power.

### Snapshot before anything risky
Snapshots are instant and nearly free. Before an OS upgrade or a config experiment on either VM, select it in the left tree, open **Snapshots → Take Snapshot**, and name it for *what you're about to do* (`before-ha-core-upgrade`), not the date. For a running VM, tick **Include RAM** so a rollback returns it running exactly where it was. To undo, select the snapshot and click **Rollback** — everything since is discarded.

> [!WARNING]
> A snapshot is not a backup — it lives on the same disk as the VM. The off-box safety net is the Proxmox vzdump job that lands on the TrueNAS share (on the mirror, not the same NVMe as the VM); this build configures that once the mirror exists. Those guest archives stay on-site on the NAS — only the irreplaceable data gets pushed offsite later. Snapshots are for fast undo, not disaster recovery.

### Grow a disk later
When a VM's disk fills, adding space is a two-part job and Proxmox only does the first part. From the host, grow the virtual disk; then, inside the guest, extend the partition and filesystem into the new space. Shrinking isn't supported, so size changes are one-way.

```bash
# Check the disk name (scsi0, virtio0, ...) in the VM's Hardware tab first:
qm disk resize <vmid> scsi0 +16G
```

Both VMs make the guest-side half easy on this build. For TrueNAS the host-side resize is rarely needed at all — its data lives on the ZFS pool, not the boot disk. For Home Assistant OS, the guest-side step is essentially automatic: after the host-side `qm disk resize`, **reboot the VM** and HAOS detects the larger disk and expands its own data partition on boot. Confirm the new size landed under **Settings → System → Storage** in Home Assistant once it is back up.

> [!DETAILS] If a guest does not grow on its own
> Most appliance OSes (HAOS, TrueNAS) handle the in-guest expansion themselves. A plain Linux guest does not — there you would grow the partition with `parted` or `fdisk`, then the filesystem (`resize2fs` for ext4, or `pvresize` then `lvresize --resizefs` for LVM); `lsblk` shows which layout you have. This build has no such guests, so you should not need these by hand — but they are the fallback if a disk shows the new size at the host but not inside.
