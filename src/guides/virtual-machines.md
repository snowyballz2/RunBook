---
title: Virtual machines
subtitle: Create a general-purpose VM with its own kernel
collection: Proxmox Home Server
order: 6
accent: violet
---

## Create it

### Spin up a generic VM (virtual machine)
For anything that isn't a small Linux service — a Windows box, a full Linux desktop, an appliance OS — create a complete virtual machine with its own kernel. The *Home Assistant OS* and *TrueNAS* guides build on this one.

```bash
# List your VMs and containers from the Proxmox shell:
qm list
pct list
```

> [!DETAILS] When a VM is the right tool (examples)
> A VM emulates a whole computer, so it can run anything — at the cost of more RAM and slower startup than a container. Reach for one when:
>
> - **It isn't Linux** — a Windows VM for that one stubborn Windows-only program, or to remote into from the couch
> - **It's an appliance OS that wants the whole machine** — the *Home Assistant OS* and *TrueNAS* guides in this collection, or OPNsense if you ever want to be your own router vendor
> - **You want a sandbox** — a Linux desktop to experiment in: snapshot it, break it, roll back, repeat
> - **It needs kernel control or a GPU** — passthrough and custom kernel modules behave better in a VM
>
> Everything else — the everyday self-hosted services — belongs in containers, where ten of them cost less RAM than one Windows VM.

> [!DETAILS] Upload an ISO to Proxmox
> ISOs live in storage, same as container templates:
>
> - In the left tree, click the **local** storage under your node, then **ISO Images**.
> - Click **Upload** and pick the ISO from the machine your browser is on, or
> - Click **Download from URL** and paste a direct link so the server fetches it itself — faster for big images.
>
> Wait for the upload task to report `TASK OK` before you build the VM.

> [!DETAILS] Create VM wizard essentials
> Click **Create VM** (top right) and walk the tabs:
>
> - **General** — give it a name and accept the suggested VM ID (containers and VMs share one pool of ID numbers; the suggestion is the next free one).
> - **OS** — pick your uploaded ISO from local storage.
> - **System** — defaults are fine, but tick the **Qemu Agent** checkbox so Proxmox can see the VM's IP address and shut it down cleanly.
> - **Disks** — size to suit the OS; 32 GB covers most Linux installs.
> - **CPU** — 2 cores is a sensible start.
> - **Memory** — 2048–4096 MB depending on the guest.
> - **Network** — leave it on bridge **vmbr0** so the VM sits on your LAN (local area network) like any other device.
> - **Windows guests** — the VirtIO defaults make the Windows installer see no disk. Either pick **SATA** for the disk and **Intel E1000** for the network, or attach the [virtio-win drivers ISO](https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso) as a second CD drive and load drivers during setup.
>
> Confirm, start the VM, and open **Console** to run the OS installer.

## Install the OS

### Run the installer in the Console
Start the VM, select it in the left tree, and click **Console**. The VM boots from the ISO you attached, and you walk the OS installer exactly as you would on physical hardware — partitioning, user account, reboot at the end.

> [!TIP]
> If a Windows installer reports no disk to install to, that is the VirtIO driver situation from the **Create VM wizard essentials** expandable above — load the drivers from the virtio-win CD, or rebuild with SATA and E1000.

### Install the QEMU guest agent
The guest agent is a small service inside the VM that lets Proxmox shut it down cleanly, show its IP address on the Summary page, and freeze the filesystem during backups. It only works when both halves are in place: the **Qemu Agent** option on the VM (the checkbox you ticked in the wizard) and the agent package inside the guest. It pays off later, too — when a battery backup orders the server down in a later guide, this channel is what shuts every VM down gracefully instead of hoping the guest honors a generic power signal.

```bash
# Inside a Debian or Ubuntu guest:
apt-get install qemu-guest-agent
systemctl start qemu-guest-agent
systemctl enable qemu-guest-agent
```

> [!NOTE]
> The explicit start and enable matter — depending on the distribution, the agent might not start automatically after installation.

> [!DETAILS] Installing the agent on a Windows guest
> The agent comes on the same virtio-win drivers ISO from the wizard step. Attach it as a CD drive, open it in the guest, and run the **virtio-win-guest-tools** wizard — it installs the QEMU Guest Agent along with the SPICE agent for a smoother console. If you only want the agent itself, the MSI lives on the ISO at `guest-agent\qemu-ga-x86_64.msi`. Verify it is running from PowerShell:
>
> ```powershell
> Get-Service QEMU-GA
> ```

> [!DETAILS] Turning the agent option on after the fact
> If the wizard checkbox was missed, the VM-side half lives in the VM's **Options** panel — edit **QEMU Guest Agent** and enable it, or from the host shell:
>
> ```bash
> qm set 100 --agent 1
> ```
>
> Swap in your own VM ID. The agent package in the guest does nothing until this option is on.

### Eject the installer ISO
Once the OS boots from its own disk, take the installer out of the virtual drive: open the VM's **Hardware** tab, double-click the **CD/DVD Drive**, and select **Do not use any media**. The VM stops offering the installer at every boot, and the ISO file back in storage can be deleted whenever you want the space.

## Run it like an appliance

### Start it at boot
An appliance should come back on its own after a power cut or a host reboot. In the VM's **Options** tab, edit **Start at boot** and enable it — or from the host shell:

```bash
qm set 100 -onboot 1
```

> [!NOTE]
> The same **Options** panel holds **Start/Shutdown order** and **Startup delay** — the knob for when one guest must come up before another (the *Containers* guide documents it from the LXC (Linux Containers) side). It matters here because VMs boot slower than containers: if a later service depends on something this VM provides, that service can start first and find nothing waiting. The classic case is the *Home Assistant OS* VM, which runs the Mosquitto MQTT (Message Queuing Telemetry Transport) broker that the *Frigate* container talks to — give the HA (Home Assistant) VM a lower order number so it starts first and the broker is ready before anything reaches for it.

### Grow the disk later
When the disk fills up, adding space is a two-part job, and Proxmox only does the first part. From the host, grow the virtual disk — then, inside the guest, grow the partition and filesystem into the new space, because the guest knows nothing about it until you do. Shrinking is not supported, so size changes are one-way.

```bash
# From the Proxmox host shell — check the disk name (scsi0, virtio0, ...) in the Hardware tab:
qm disk resize 100 scsi0 +16G
```

> [!DETAILS] Growing the partition inside the guest
> The second half depends on the guest OS:
>
> - **Windows** — open Disk Management and extend the volume into the new unallocated space.
> - **Linux** — grow the partition with `parted` or `fdisk`, then the filesystem: `resize2fs` for ext4, or `pvresize` followed by `lvresize --resizefs` if the install uses LVM. `lsblk` shows which layout you have.
>
> This second step is a VM-only chore — containers do not need it, because Proxmox grows a container's filesystem for you.

### Snapshot before you change anything
Snapshots are instant and nearly free. Before any risky change to a VM — an OS upgrade, a config experiment — take one, so rollback is a single click.

> [!TIP]
> Name snapshots for *what you were about to do* ("before-gpu-passthrough"), not the date. Future-you will thank present-you.

> [!DETAILS] How to take and roll back a snapshot
> - Select the VM in the left tree and open **Snapshots**.
> - Click **Take Snapshot**, give it a name that says what you were about to attempt, and an optional description.
> - For a running VM, the **Include RAM** checkbox also saves its memory state, so rollback returns it running exactly where it was.
> - To undo, select the snapshot in the list and click **Rollback** — everything since that snapshot is discarded.
