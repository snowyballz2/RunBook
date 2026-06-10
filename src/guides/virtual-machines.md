---
title: Virtual machines
subtitle: Whole computers — Home Assistant, a NAS, Windows, and more
collection: Proxmox Home Server
order: 4
accent: spruce
---

### Spin up a generic VM
For anything that isn't a small Linux service — a Windows box, a full Linux desktop, an appliance OS — create a complete virtual machine with its own kernel. Home Assistant and the NAS each get their own step after this one.

```bash
# List your VMs and containers from the Proxmox shell:
qm list
pct list
```

> [!DETAILS] When a VM is the right tool (examples)
> A VM emulates a whole computer, so it can run anything — at the cost of more RAM and slower startup than a container. Reach for one when:
>
> - **It isn't Linux** — a Windows VM for that one stubborn Windows-only program, or to remote into from the couch
> - **It's an appliance OS that wants the whole machine** — Home Assistant OS and TrueNAS (each has its own step in this guide), or OPNsense if you ever want to be your own router vendor
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
> - **System** — defaults are fine, but tick the **Qemu Agent** checkbox so Proxmox can see the VM's IP and shut it down cleanly.
> - **Disks** — size to suit the OS; 32 GB covers most Linux installs.
> - **CPU** — 2 cores is a sensible start.
> - **Memory** — 2048–4096 MB depending on the guest.
> - **Network** — leave it on bridge **vmbr0** so the VM sits on your LAN like any other device.
> - **Windows guests** — the VirtIO defaults make the Windows installer see no disk. Either pick **SATA** for the disk and **Intel E1000** for the network, or attach the [virtio-win drivers ISO](https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso) as a second CD drive and load drivers during setup.
>
> Confirm, start the VM, and open **Console** to run the OS installer.

### Run Home Assistant OS
The workload many home servers exist for, with one trap: HAOS ships as a ready-made disk image, **not** an installer ISO — so skip the Create VM wizard here and use one of the two paths below.

> [!DETAILS] The quick way — helper script
> The community-scripts helper downloads the official HAOS image and builds the VM for you. Run it in the Proxmox shell and accept the defaults:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> Same rule as before: you are piping a script into a root shell, so read it first (the download-read-run habit from the *Install Proxmox* guide) and make that call yourself.

> [!DETAILS] The manual way — no scripts
> Five commands in the Proxmox shell, using only official sources — no helper scripts. Check the [HAOS releases page](https://github.com/home-assistant/operating-system/releases) for the latest version and substitute it for `17.3` below. Replace `100` with a **free VM ID** — a number no other VM or container is using; `qm list` and `pct list` show the taken ones, and the next free number is whatever the web UI's Create wizard would suggest. Replace `local-lvm` with your storage name if it differs.
>
> ```bash
> # 1. Download and unpack the official image:
> cd /tmp
> wget https://github.com/home-assistant/operating-system/releases/download/17.3/haos_ova-17.3.qcow2.xz
> unxz haos_ova-17.3.qcow2.xz
>
> # 2. Create the VM shell. HAOS needs UEFI boot with secure boot off,
> #    which is what the efidisk line sets up:
> qm create 100 --name haos --ostype l26 --bios ovmf \
>   --efidisk0 local-lvm:0,efitype=4m,pre-enrolled-keys=0 \
>   --cores 2 --memory 4096 --scsihw virtio-scsi-pci \
>   --net0 virtio,bridge=vmbr0 --agent enabled=1
>
> # 3. Import the image as the VM's disk and make it the boot disk:
> qm disk import 100 /tmp/haos_ova-17.3.qcow2 local-lvm --target-disk scsi0
> qm set 100 --boot order=scsi0
>
> # 4. Optional — the image defaults to 32 GB; grow it if you want room:
> qm disk resize 100 scsi0 64G
>
> # 5. Start it:
> qm start 100
> ```

> [!DETAILS] First contact
> Give it a few minutes on first boot — HAOS sets itself up unattended. Then browse to `http://homeassistant.local:8123`, or find the VM's IP in Proxmox (the VM's **Summary** tab shows it, thanks to the guest agent) and use `http://that-ip:8123`. From there the onboarding wizard takes over.

### Build a NAS with TrueNAS
TrueNAS turns a pile of disks into a proper network-storage appliance — shared folders, snapshots, and the ZFS filesystem guarding your data. Unlike HAOS it ships as a normal installer ISO, so the generic-VM wizard from the previous step is your starting point.

> [!DETAILS] Install TrueNAS in a VM
> 1. Download **TrueNAS Community Edition** from [truenas.com](https://www.truenas.com/download-truenas-community-edition/) and upload the ISO to Proxmox (the upload expandable in the previous step).
> 2. Run the Create VM wizard: 2 cores, **8192 MB memory** (TrueNAS is memory-hungry — ZFS uses RAM as cache; give it more if you can spare it), a 32 GB boot disk, network on `vmbr0`.
> 3. Install from the console, then browse to the address the console prints.

> [!DETAILS] Give it real disks — passthrough
> The part that makes it a *real* NAS: ZFS wants to manage whole physical drives, not virtual disks. In the **Proxmox host shell**:
>
> ```bash
> # Find your data disks' stable IDs (match model + serial):
> lsblk -o +MODEL,SERIAL
> ls -l /dev/disk/by-id/
>
> # Attach each disk to the VM (here VM 101, as its second disk):
> qm set 101 -scsi1 /dev/disk/by-id/ata-YOUR-DISK-ID
> ```
>
> Reboot the VM. The disks appear under **Storage** in TrueNAS — build a pool there. With two disks, choose a **mirror**: one drive can die and your data survives.
>
> Use disks with nothing on them you care about — TrueNAS will claim them entirely. And note for later: serious builds pass through a whole disk-controller card instead (PCIe passthrough — that is what the VT-d/IOMMU setting from the *Prep & BIOS* guide was for), but per-disk passthrough is the right starting point.
