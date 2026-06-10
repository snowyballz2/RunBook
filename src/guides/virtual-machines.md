---
title: Virtual machines
subtitle: Create a general-purpose VM with its own kernel
collection: Proxmox Home Server
order: 5
accent: spruce
---

### Spin up a generic VM
For anything that isn't a small Linux service — a Windows box, a full Linux desktop, an appliance OS — create a complete virtual machine with its own kernel. Home Assistant and the NAS each get their own guide in this collection.

```bash
# List your VMs and containers from the Proxmox shell:
qm list
pct list
```

> [!DETAILS] When a VM is the right tool (examples)
> A VM emulates a whole computer, so it can run anything — at the cost of more RAM and slower startup than a container. Reach for one when:
>
> - **It isn't Linux** — a Windows VM for that one stubborn Windows-only program, or to remote into from the couch
> - **It's an appliance OS that wants the whole machine** — Home Assistant OS and TrueNAS (each has its own guide in this collection), or OPNsense if you ever want to be your own router vendor
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
