---
title: Virtual Machines
subtitle: The Home Assistant and TrueNAS VMs, and the boot order that keeps them honest
collection: My Build
order: 6
accent: spruce
---

This build runs two full virtual machines (VMs) on Proxmox: **Home Assistant OS** (the brain of the house) and **TrueNAS** (the storage server that owns the passed-through host bus adapter). Everything else on the box is a lightweight Linux Container (LXC). A VM emulates a whole computer with its own kernel, which is exactly what these two appliance operating systems want — and what lets the LSI 9300-8i HBA be handed whole to TrueNAS later. This page **builds the TrueNAS VM in full** and walks the Create VM wizard for your hardware. The Home Assistant OS VM is built on its own page (it uses a disk image, not the wizard), so here it gets a pointer; the shared "run them like appliances" steps at the end — start at boot, start order, snapshots, growing a disk — apply to both VMs once they exist.

> [!NOTE]
> Two VMs on this machine, no more. Service apps (AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma, Frigate) all run as LXCs — ten of those cost less RAM than one VM. Reach for a VM only when you need an appliance OS with its own kernel, which is the case for both Home Assistant OS and TrueNAS.

## Before you build

### Confirm the host is ready
Log in to the Proxmox web UI, then confirm the host is in the state the earlier pages left it:

1. **IOMMU (Input/Output Memory Management Unit)** is enabled.
2. The 9300-8i HBA sits alone in its own IOMMU group.

Both were done on the Install Proxmox page.

> [!NOTE]
> The HBA is **not** bound to vfio-pci yet, and it is **not** attached to any VM — that is a separate later step on the GPU Sharing & HBA Passthrough page. So you build the TrueNAS VM here with **no HBA attached**; the controller gets passed through afterward, and only then do its disks appear for the pool. Neither VM ever gets the GPU.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The web UI answers at `https://192.168.1.50:8006`. Log in as `root@pam`.

> [!INPUT] proxmox-user | Proxmox web UI username | | root
> Not a choice — `root` is Proxmox's built-in administrator; the `@pam` suffix on the login screen just names its realm.

> [!SECRET] proxmox-root-password | Proxmox root password
> The password set during the Proxmox install. Record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build).

### Get the TrueNAS installer into Proxmox storage
TrueNAS ships as a standard installer **ISO**, and the server fetches it itself — no upload from a laptop:

1. Go to the official download page ([truenas.com/download-truenas-community-edition](https://www.truenas.com/download-truenas-community-edition/)).
2. Right-click the stable release's **Download** button.
3. Click **Copy Link Address**.
4. In Proxmox's left tree, click the **local** storage under your node.
5. Click **ISO Images**.
6. Click **Download from URL**.
7. Paste the `.iso` link.
8. Click **Query URL**.
9. Click **Download**.
10. Wait for `TASK OK`.

The link you want ends in `.iso` — the download page's own address is a web page, not the file. The **File name** field fills itself in and the size shows a couple of gigabytes once the URL resolves; if it stays empty and **MIME type** reads `text/html`, you pasted the page rather than the file.

> [!TIP]
> The download page lists a **SHA256** checksum next to the ISO. To verify it:
>
> 1. In the **Download from URL** dialog, click **Advanced**.
> 2. Paste the checksum into **Checksum**.
> 3. Set **Hash algorithm** to `SHA256`.
>
> Proxmox confirms the file arrived intact before you boot it — same habit you used for the Proxmox installer.

> [!NOTE]
> No Home Assistant OS media to fetch here — it is built on the Home Assistant & Zigbee2MQTT page (it uses a disk image, not the wizard below). The wizard and install steps that follow are the TrueNAS VM only.

> [!WARNING]
> Do not VFIO-bind or pass the 1080 Ti to either VM. The GPU stays on the host and is shared into LXCs. The only PCIe passthrough on this build is the HBA into the TrueNAS VM (set up on the GPU Sharing & HBA Passthrough page). Home Assistant reaches detection and voice services over the LAN, not through a passed-through card.

## Build the TrueNAS VM

### Walk the Create VM wizard
Click **Create VM** (top right) and step through the tabs with these values:

- **General → Name** → `truenas`
- **General → VM ID** → accept the suggested value — VMs and containers share one pool of ID numbers, so it's already the next free one
- **OS** → the TrueNAS ISO you downloaded into local storage
- **System → Machine** → `q35` — the modern chipset; Proxmox only supports native-PCIe passthrough on q35, so this is what lets the HBA arrive as a true PCIe device later
- **System → Qemu Agent** → ticked — so Proxmox can read the VM's IP address and shut it down cleanly later
- **Disks** → a `32 GB` boot disk on the NVMe — TrueNAS keeps its OS small and its data on the pool
- **CPU** → `1 socket, 2 cores` — sockets stay at 1 on any single-CPU machine; only the core count is a real choice
- **Memory** → `8192 MiB` (8 GB — TrueNAS's own minimum) — ZFS leans on RAM for its read cache, so this is the one VM worth feeding generously
- **Advanced → Ballooning Device** → unticked — fine for most VMs, but wrong for ZFS: the cache assumes it owns its memory outright, and ballooning lets the host claw it back under pressure
- **Network** → bridge `vmbr0` — so the VM sits on the LAN like any other device

Leave the rest, including the BIOS choice, at the defaults.

Click **Confirm** to create the VM.

Do not add the HBA on this page — the TrueNAS install needs only the 32 GB boot disk; the data controller is attached later.

> [!DETAILS] Why the HBA is not attached here
> The 9300-8i is still claimed by the host's SAS driver at this point — it has not been bound to vfio-pci yet, so adding it as a PCI device now would either fail to pass through or pull the host's driver out from under it. The binding, the **Hardware → Add → PCI Device → All Functions** step, and the power-cycle all happen on the **GPU Sharing & HBA Passthrough page**. The whole controller is passed through (rather than individual disks) so TrueNAS sees the **two** mirror IronWolf disks as raw bare-metal drives with genuine SMART and real serials — no per-disk `serial=` plumbing. Those disks appear, and the mirrored pool is built, on the **TrueNAS Storage page**, after the passthrough is done. (The third IronWolf is Frigate's footage drive on a motherboard SATA port, so it stays with the host and never appears in TrueNAS.)

### Install from the console
1. Select the VM.
2. Click **Start**.
3. Click **Console**.
4. Run the TrueNAS installer exactly as you would on physical hardware.

It installs to the **32 GB boot disk** (the only disk it can see right now, which is correct).

> [!DETAILS] Every prompt the installer shows, in order
> 1. **Boot menu** — let it time out, or press Enter on the default entry.
> 2. **Console setup menu** — choose **Install/Upgrade**.
> 3. **Destination media** — one ~32 GB QEMU disk is listed (the boot disk from the wizard). Press **spacebar** to tick it.
> 4. Click **OK**.
> 5. **"This erases everything on the disk" warning** — proceed; the disk is empty.
> 6. **Authentication method** — pick **Administrative user (`truenas_admin`)**.
> 7. Set the password. This is the web UI login — the two credential fields below record exactly this pair. Do not pick the root or configure-later options; the rest of this build assumes `truenas_admin`.
> 8. **"Allow EFI boot?"** — answer **No**. The wording feels backwards because it is written for physical hardware ("Yes for systems with newer components such as NVMe") — but what matters is the *VM's virtual firmware*, not the host's parts, and this VM's SeaBIOS default is exactly the "legacy BIOS boot workaround" case. Answering Yes on a SeaBIOS VM is the classic route to a "no bootable device" error after the reboot.
> 9. **Installation succeeded** — click **OK**.
> 10. Choose **Reboot System** from the menu. The VM's boot order tries the disk before the ISO, so the installer will not hijack the reboot; the ISO gets ejected in a moment.
> 11. After the reboot, the console shows the **Console Setup menu** with the web UI address at the top — a temporary DHCP address for now; the step below gives it its permanent one.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> The permanent address, set **statically inside TrueNAS** in the next step — it lives in the `.2–.99` static zone carved out on the Start Here page, alongside the host at `.50`. The first boot comes up on a temporary DHCP address from the console screen; that one is just for reaching the web UI once.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — this is the web UI login.

### Eject the installer ISO
Once TrueNAS boots from its own disk:

1. Open the VM's **Hardware** tab.
2. Double-click the **CD/DVD Drive**.
3. Choose **Do not use any media**.

Otherwise it tries to boot the installer at every restart.

### Give it its permanent address
The storage server is the one machine half this build leans on by address — backups, shares, Frigate's footage path — so it gets a device-set static in the protected zone, not a DHCP lease.

1. Browse to the temporary address the console showed (`http://` that IP).
2. Log in as `truenas_admin`.
3. Open **Network**.
4. On the **Interfaces** card, click the interface itself (the VM's single virtual NIC, `enp…`) to edit it.
5. Untick **DHCP**.
6. Add **`192.168.1.20/24`** under **Aliases**.
7. Save.
8. Park a second browser tab at `http://192.168.1.20` — the rollback countdown starts the moment you click **Test Changes** next.
9. Click **Test Changes**.
10. Jump to the parked tab.
11. Reload until the login appears.
12. Log in.
13. Click **Save Changes** — still inside the countdown.
14. Still under **Network**, open **Global Configuration**.
15. Set the **default gateway** to `192.168.1.1`.
16. Set a **DNS nameserver** (the router, or `1.1.1.1`).
17. In the same dialog, change **Domain** from `local` to `home.arpa`.

> [!TIP]
> Step 4 means the interface itself, not the **Static Routes** card beside it — its Add button looks inviting, but routes are for reaching *other* networks, and an entry there does not give this machine an address.

> [!WARNING]
> Confirming **Test Changes** is a race you have to win: the moment you click, the old tab's address vanishes and it can never reconnect, so the second tab must already be parked first. Lose the race and a "Network Reconnection Issue" dialog announces the rollback; nothing is broken, just try again.

> [!DETAILS] If the browser dance keeps rolling back
> The sturdier path, without a test/rollback countdown, is the **VM console menu, option 1 (Configure network interfaces)**:
>
> 1. Pick the interface.
> 2. Remove current settings when asked (a momentary blip).
> 3. Answer DHCP **no**.
> 4. Answer IPv4 **yes**.
> 5. Enter `192.168.1.20/24`.
> 6. Answer IPv6 **no**.
>
> The menu header updates to `.20` and the job is done.

> [!NOTE]
> A static interface does not inherit the gateway or DNS from DHCP, and without them TrueNAS cannot fetch updates or send alert emails. The domain change is the same reasoning as the Proxmox hostname: `.local` is mDNS's turf on a LAN full of Apple devices.

From here on, every page that asks for the TrueNAS IP means this address.

## Run them like appliances

The second VM — **Home Assistant OS**, the brain of the house — is built on its own page, the **Home Assistant & Zigbee2MQTT page**, where it has the exact commands and credential fields. It is **not** built with the Create VM wizard above: Home Assistant OS ships as a ready-made `.qcow2` disk image rather than an installer ISO, so the image is pulled by the server (community helper script or a short run of `qm create` + `qm disk import`) and the VM boots straight to its own setup. The appliance steps below — start at boot, start order, snapshots, growing a disk — apply to it equally once it exists.

> [!NOTE]
> The **Qemu Agent** is built into both these appliance OSes — Home Assistant OS and TrueNAS — so unlike a plain Debian guest you never `apt-get` it. You only flip the VM-side half on: tick the VM's **Qemu Agent** option (in the Create VM wizard, or later under **Hardware / Options**). With it on, Proxmox can read the VM's IP, freeze the filesystem during backups, and — important later — shut the VM down cleanly when the battery backup orders the host down.

### Start at boot
An appliance should come back on its own after a power cut or host reboot. Two ways, same result.

In the web UI:

1. Select the **truenas** VM in the left tree.
2. Open its **Options** tab.
3. Double-click **Start at boot**.
4. Tick it.
5. Click **OK**.
6. Double-click **Protection**.
7. Tick it.
8. Click **OK**.

Protection blocks deleting this VM until deliberately unticked — it carries the storage pool.

Or set both at once from the host shell:

1. Click **Datacenter**.
2. Click the **`pve`** node.
3. Click **Shell** — the same shell the post-install script ran in.

```bash
qm set 100 -onboot 1 -protection 1
```

`100` is the VM ID the wizard assigned, shown next to the VM's name in the left tree. Every later guest gets this same setting on the page that builds it.

> [!WARNING]
> **Prove unattended boot, do not assume it.** Some keypresses at the console are harmless — Enter at TrueNAS's boot menu only skips a countdown that expires by itself, and a key in a quiet console just wakes the blanked display. But one is fatal to the whole outage-recovery story: once the HBA is passed through on the GPU/HBA page, the VM's SeaBIOS can halt at `Press any key to continue...` after an option-ROM fault, and there it waits for a human that a 3 a.m. power cut does not provide. That page's `rombar=0` prevents it.
>
> Either way, prove it:
>
> 1. Stop the VM.
> 2. Start it.
> 3. Leave the console closed.
> 4. Load the web UI a couple of minutes later.
>
> If it answers, the VM boots with nobody watching — which is what an outage recovery actually requires.

### Set the Start/Shutdown order
Set **Start/Shutdown order** to **1** in the same **Options** panel, or run it from the host shell:

```bash
qm set 100 -startup order=1
```

> [!NOTE]
> This is load-bearing: TrueNAS gets the **lowest number**, so the storage boots first and — because shutdown runs the order in reverse — goes down last, after the guests that write to its shares.

That is all this page sets. The two guests that care about ordering take the next slots when their own pages build them — the Home Assistant VM becomes order=2 and Frigate order=3, so the broker Frigate depends on is always up first.

### Snapshot before anything risky
Snapshots are instant and nearly free. Before an OS upgrade or a config experiment on either VM:

1. Select it in the left tree.
2. Open **Snapshots**.
3. Click **Take Snapshot**.
4. Name it for *what you're about to do* (`before-ha-core-upgrade`), not the date.
5. For a running VM, tick **Include RAM** so a rollback returns it running exactly where it was.

To undo:

1. Select the snapshot.
2. Click **Rollback**.

Everything since is discarded.

> [!WARNING]
> A snapshot is not a backup — it lives on the same disk as the VM. The off-box safety net is the Proxmox vzdump job that lands on the TrueNAS share (on the mirror, not the same NVMe as the VM); this build configures that once the mirror exists. Those guest archives stay on-site on the NAS — only the irreplaceable data gets pushed offsite later. Snapshots are for fast undo, not disaster recovery.

### Grow a disk later
When a VM's disk fills, adding space is a two-part job and Proxmox only does the first part. From the host, grow the virtual disk; then, inside the guest, extend the partition and filesystem into the new space. Shrinking isn't supported, so size changes are one-way.

Before running it:

1. Check the disk name (`scsi0`, `virtio0`, …) in the VM's **Hardware** tab.
2. Note the VM's ID.

Both vary, so this is a someday command:

```bash
qm disk resize <vmid> scsi0 +16G
```

Both VMs make the guest-side half easy on this build. For TrueNAS the host-side resize is rarely needed at all — its data lives on the ZFS pool, not the boot disk. For Home Assistant OS, the guest-side step is essentially automatic:

1. After the host-side `qm disk resize`, reboot the VM.
2. Confirm the new size landed under **Settings → System → Storage** in Home Assistant once it is back up.

> [!NOTE]
> HAOS detects the larger disk and expands its own data partition on boot.

> [!DETAILS] If a guest does not grow on its own
> Most appliance OSes (HAOS, TrueNAS) handle the in-guest expansion themselves. A plain Linux guest does not, so you would need to:
>
> 1. Run `lsblk` to see which layout the guest uses.
> 2. Grow the partition with `parted` or `fdisk`.
> 3. Grow the filesystem with `resize2fs` (ext4).
> 4. For LVM, run `pvresize`.
> 5. Run `lvresize --resizefs`.
>
> This build has no such guests, so you should not need these by hand — but they are the fallback if a disk shows the new size at the host but not inside.
