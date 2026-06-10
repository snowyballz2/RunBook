---
title: Home Assistant OS
subtitle: The official image — scripted or fully by hand
collection: Proxmox Home Server
order: 6
accent: spruce
---

### Create the HAOS VM
The workload many home servers exist for, with one trap: HAOS ships as a ready-made disk image, **not** an installer ISO — so skip the Create VM wizard and use one of the two paths below.

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

### First contact
Give it a few minutes on first boot — HAOS sets itself up unattended. Then browse to `http://homeassistant.local:8123`, or find the VM's IP in Proxmox (the VM's **Summary** tab shows it, thanks to the guest agent) and use `http://that-ip:8123`. From there the onboarding wizard takes over.
