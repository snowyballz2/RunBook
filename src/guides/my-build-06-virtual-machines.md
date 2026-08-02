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
Log in to the Proxmox web UI and confirm the host is in the state the earlier pages left it: **IOMMU (Input/Output Memory Management Unit) is enabled** and the 9300-8i HBA sits alone in its own IOMMU group (both done on the Install Proxmox page). The HBA is **not** bound to vfio-pci yet, and it is **not** attached to any VM — that is a separate later step on the GPU Sharing & HBA Passthrough page. So you build the TrueNAS VM here with **no HBA attached**; the controller gets passed through afterward, and only then do its disks appear for the pool. Neither VM ever gets the GPU.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The web UI answers at `https://`-this-IP-`:8006`. Log in as `root@pam`.

> [!SECRET] proxmox-root-password | Proxmox root password
> The password set during the Proxmox install. Record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build).

### Get the TrueNAS installer into Proxmox storage
TrueNAS ships as a standard installer **ISO**, and the server fetches it itself — no upload from a laptop. First get the *direct file link*: on the official download page ([truenas.com/download-truenas-community-edition](https://www.truenas.com/download-truenas-community-edition/)), **right-click the stable release's Download button and Copy Link Address** — the link you want ends in **`.iso`**. Do not paste the download page's own address; that is a web page, not the file. Then in the left tree, click the **local** storage under your node, then **ISO Images → Download from URL**, paste the `.iso` link, and click **Query URL** — the **File name** field fills itself in and the size shows a couple of gigabytes. If instead the file name stays empty and **MIME type** says `text/html`, you pasted the page, not the file. Click **Download** and wait for `TASK OK`.

> [!TIP]
> The download page lists a **SHA256** checksum next to the ISO. In the **Download from URL** dialog, click **Advanced** to reveal the **Checksum** and **Hash algorithm** fields — paste the checksum in, pick `SHA256`, and Proxmox confirms the file arrived intact before you boot it. Same habit you used for the Proxmox installer.

> [!NOTE]
> No Home Assistant OS media to fetch here — it is built on the Home Assistant & Zigbee2MQTT page (it uses a disk image, not the wizard below). The wizard and install steps that follow are the TrueNAS VM only.

> [!WARNING]
> Do not VFIO-bind or pass the 1080 Ti to either VM. The GPU stays on the host and is shared into LXCs. The only PCIe passthrough on this build is the HBA into the TrueNAS VM (set up on the GPU Sharing & HBA Passthrough page). Home Assistant reaches detection and voice services over the LAN, not through a passed-through card.

## Build the TrueNAS VM

### Walk the Create VM wizard
Click **Create VM** (top right) and step through the tabs with these values:

- **General** — name it `truenas`. Accept the suggested VM ID (VMs and containers share one pool of ID numbers; the suggestion is the next free one).
- **OS** — pick the TrueNAS ISO you downloaded into local storage.
- **System** — set **Machine** to **q35** (the modern chipset; Proxmox only supports native-PCIe passthrough on q35, so this is what lets the HBA arrive as a true PCIe device later) and tick **Qemu Agent** so Proxmox can read the VM's IP address and shut it down cleanly later. Leave the rest, including the BIOS choice, at the defaults.
- **Disks** — a **32 GB** boot disk on the NVMe is plenty; TrueNAS keeps its OS small and its data on the pool.
- **CPU** — **1 socket, 2 cores**. Sockets stay at 1 on any single-CPU machine; only the core count is a real choice.
- **Memory** — **8192 MiB** (the field is in MiB, so that reads as 8 GB — TrueNAS's own minimum). ZFS leans on RAM for its read cache, so this is the one VM worth feeding generously. Expand **Advanced** on this tab and **untick Ballooning Device**: ballooning lets the host claw RAM back from a guest under pressure, which is fine for most VMs and wrong for ZFS — the cache assumes it owns its memory outright.
- **Network** — leave it on bridge **vmbr0** so the VM sits on the LAN like any other device.

Confirm — and do **not** add the HBA on this page. The TrueNAS install needs only the 32 GB boot disk; the data controller is attached later.

> [!DETAILS] Why the HBA is not attached here
> The 9300-8i is still claimed by the host's SAS driver at this point — it has not been bound to vfio-pci yet, so adding it as a PCI device now would either fail to pass through or pull the host's driver out from under it. The binding, the **Hardware → Add → PCI Device → All Functions** step, and the power-cycle all happen on the **GPU Sharing & HBA Passthrough page**. The whole controller is passed through (rather than individual disks) so TrueNAS sees the **two** mirror IronWolf disks as raw bare-metal drives with genuine SMART and real serials — no per-disk `serial=` plumbing. Those disks appear, and the mirrored pool is built, on the **TrueNAS Storage page**, after the passthrough is done. (The third IronWolf is Frigate's footage drive on a motherboard SATA port, so it stays with the host and never appears in TrueNAS.)

### Install from the console
Select the VM, click **Start**, then **Console**, and run the TrueNAS installer exactly as you would on physical hardware — it installs to the **32 GB boot disk** (the only disk it can see right now, which is correct).

> [!DETAILS] Every prompt the installer shows, in order
> 1. **Boot menu** — let it time out, or press Enter on the default entry.
> 2. **Console setup menu** — choose **Install/Upgrade**.
> 3. **Destination media** — one ~32 GB QEMU disk is listed (the boot disk from the wizard). Press **spacebar** to tick it, then OK.
> 4. **"This erases everything on the disk" warning** — proceed; the disk is empty.
> 5. **Authentication method** — pick **Administrative user (`truenas_admin`)** and set the password. This is the web UI login — the two credential fields below record exactly this pair. Do not pick the root or configure-later options; the rest of this build assumes `truenas_admin`.
> 6. **"Allow EFI boot?"** — answer **No**. The wording feels backwards because it is written for physical hardware ("Yes for systems with newer components such as NVMe") — but what matters is the *VM's virtual firmware*, not the host's parts, and this VM's SeaBIOS default is exactly the "legacy BIOS boot workaround" case. Answering Yes on a SeaBIOS VM is the classic route to a "no bootable device" error after the reboot.
> 7. **Installation succeeded** — OK, then **Reboot System** from the menu. The VM's boot order tries the disk before the ISO, so the installer will not hijack the reboot; the ISO gets ejected in a moment.
> 8. After the reboot, the console shows the **Console Setup menu** with the web UI address at the top — a temporary DHCP address for now; the step below gives it its permanent one.

> [!INPUT] truenas-ip | TrueNAS VM IP | 192.168.1.20
> The permanent address, set **statically inside TrueNAS** in the next step — it lives in the `.2–.99` static zone carved out on the Start Here page, alongside the host at `.50`. The first boot comes up on a temporary DHCP address from the console screen; that one is just for reaching the web UI once.

> [!INPUT] truenas-admin-user | TrueNAS admin username | | truenas_admin

> [!SECRET] truenas-admin-password | TrueNAS admin password
> Set during install — this is the web UI login.

### Eject the installer ISO
Once TrueNAS boots from its own disk, open the VM's **Hardware** tab, double-click the **CD/DVD Drive**, and choose **Do not use any media**. Otherwise it tries to boot the installer at every restart.

### Give it its permanent address
The storage server is the one machine half this build leans on by address — backups, shares, Frigate's footage path — so it gets a device-set static in the protected zone, not a DHCP lease. Browse to the temporary address the console showed (`http://` that IP), log in as `truenas_admin`, then:

1. Open **Network**, and on the **Interfaces** card click the interface itself (the VM's single virtual NIC, `enp…`) to edit it: untick **DHCP**, add **`192.168.1.20/24`** under **Aliases**, and save. Not the **Static Routes** card beside it — its Add button looks inviting, but routes are for reaching *other* networks, and an entry there does not give this machine an address.
2. TrueNAS offers **Test Changes** with a rollback timer, and confirming it is a race you have to win: the old tab can never reconnect (its address just vanished), so **park a second tab at `http://192.168.1.20` before you click**. Click **Test Changes**, jump to the parked tab, reload until the login appears, log in, and click **Save Changes** — all inside the countdown. Lose the race and a "Network Reconnection Issue" dialog announces the rollback; nothing is broken, just try again.
3. The no-race alternative, and the sturdier path if the browser dance keeps rolling back: the **VM console menu, option 1 (Configure network interfaces)**. Console changes apply without the test/rollback countdown — pick the interface, remove current settings when asked (a momentary blip), answer DHCP **no**, IPv4 **yes**, enter `192.168.1.20/24`, IPv6 no. The menu header updates to `.20` and the job is done.
4. Still under **Network**, open **Global Configuration** and set the **default gateway** (`192.168.1.1`) and a **DNS nameserver** (the router, or `1.1.1.1`) — a static interface does not inherit these from DHCP, and without them TrueNAS cannot fetch updates or send alert emails. While in that dialog, change **Domain** from `local` to `home.arpa` — the same reasoning as the Proxmox hostname: `.local` is mDNS's turf on an all-Apple LAN.

From here on, every page that asks for the TrueNAS IP means this address.

## Run them like appliances

The second VM — **Home Assistant OS**, the brain of the house — is built on its own page, the **Home Assistant & Zigbee2MQTT page**, where it has the exact commands and credential fields. It is **not** built with the Create VM wizard above: Home Assistant OS ships as a ready-made `.qcow2` disk image rather than an installer ISO, so the image is pulled by the server (community helper script or a short run of `qm create` + `qm disk import`) and the VM boots straight to its own setup. The appliance steps below — start at boot, start order, snapshots, growing a disk — apply to it equally once it exists.

> [!NOTE]
> The **Qemu Agent** is built into both these appliance OSes — Home Assistant OS and TrueNAS — so unlike a plain Debian guest you never `apt-get` it. You only flip the VM-side half on: tick the VM's **Qemu Agent** option (in the Create VM wizard, or later under **Hardware / Options**). With it on, Proxmox can read the VM's IP, freeze the filesystem during backups, and — important later — shut the VM down cleanly when the battery backup orders the host down.

### Start at boot
An appliance should come back on its own after a power cut or host reboot. Two ways, same result. In the web UI: select the **truenas** VM in the left tree, open its **Options** tab, double-click **Start at boot**, tick it, **OK**. Or from the **host shell** — **Datacenter → the `pve` node → Shell**, the same shell the post-install script ran in:

```bash
qm set 100 -onboot 1
```

`100` is the VM ID the wizard assigned, shown next to the VM's name in the left tree. Every later guest gets this same setting on the page that builds it.

### Set the Start/Shutdown order
The same **Options** panel holds **Start/Shutdown order**, and on this build it is load-bearing: TrueNAS gets the **lowest number**, so the storage boots first and — because shutdown runs the order in reverse — goes down last, after the guests that write to its shares. Set it to **1** in the panel, or:

```bash
qm set 100 -startup order=1
```

That is all this page sets. The two guests that care about ordering take the next slots when their own pages build them — the Home Assistant VM becomes order=2 and Frigate order=3, so the broker Frigate depends on is always up first.

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
