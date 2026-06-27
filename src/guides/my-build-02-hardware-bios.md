---
title: Hardware & BIOS
subtitle: Assemble the parts, seat the cards, and flip the firmware switches first
collection: My Build
order: 2
accent: azure
---

This is the bare-metal stage: get every part into the Thermaltake View 71, land the two add-in cards in the right PCIe (Peripheral Component Interconnect Express) slots, and set the ASUS ROG Maximus X Hero BIOS so virtualization and device passthrough work later. Do all of this before installing the host OS — the firmware switches here are easy to forget and annoying to discover missing once Proxmox VE (Proxmox Virtual Environment, PVE) is on.

## Assemble the parts

The platform is a Z370 build: an ASUS ROG Maximus X Hero board with an Intel i7-8700K and 32 GB RAM, fed by an EVGA 850W GQ Gold PSU (power supply unit) — ample for the GTX 1080 Ti plus a pile of spinning disks. Everything goes into the Thermaltake View 71 full tower.

### Mount the board, CPU, RAM, and PSU
1. Seat the i7-8700K and its cooler, fit the 32 GB RAM, and mount the Maximus X Hero in the View 71 on brass standoffs.
2. Install the EVGA 850W GQ in the bottom PSU shroud. Run the 24-pin and the 8-pin CPU power now; leave the PCIe power leads loose until the GPU is in.

### Place the three IronWolf drives
The build has three Seagate IronWolf ST4000VN006 4 TB drives. Two of them become a TrueNAS ZFS (Zettabyte File System) mirror; the third holds Frigate footage.

1. Mount all three IronWolfs in the View 71's **fixed rear drive trays** behind the motherboard tray. The removable front pods are not required for this build.
2. Cable the **two mirror drives to the LSI/Broadcom 9300-8i HBA (host bus adapter)**. These belong to the TrueNAS VM (virtual machine) and must hang off the HBA, not the board.
3. Cable the **single footage drive to a motherboard SATA (Serial Advanced Technology Attachment) port**. The host and the Frigate container need direct access to it, so it stays on the board — never on the HBA.
4. Mount the 500 GB NVMe (Non-Volatile Memory Express) drive on the board's M.2 slot. This is the Proxmox OS plus Frigate cache disk.

> [!TIP]
> Label the two mirror drives now and record their serials below. ZFS identifies disks by serial, and you will want to know which physical drive is which when one eventually fails. The footage drive can stay unlabelled — it is the lone one on a board SATA port.

> [!INPUT] zfs-mirror-disk1-serial | IronWolf mirror disk 1 serial
> [!INPUT] zfs-mirror-disk2-serial | IronWolf mirror disk 2 serial

### Fit the radio, switch, and UPS
These are not slot-related, but they go in with the build:

- **HA Connect ZBT-2** Zigbee coordinator — leave it boxed for now; it plugs into USB once the host is up.
- **Netgear GS308EPP** managed PoE (Power over Ethernet) switch — for future PoE cameras; wire the server's Ethernet through it.
- **CyberPower CP1500PFCLCD UPS** (uninterruptible power supply) — the server and switch plug into it; its USB data cable goes to the host for NUT (Network UPS Tools) monitoring later.

## Plan the PCIe slots

Two cards matter, and they have two different jobs. The GPU needs full bandwidth and stays on the host. The HBA needs to land in a **clean IOMMU (Input/Output Memory Management Unit) group** so it can be handed whole to the TrueNAS VM by VFIO (Virtual Function I/O) without dragging neighbouring devices along.

### Seat the GTX 1080 Ti in the top slot
1. Install the EVGA GTX 1080 Ti FTW in the **top x16 slot** (`PCIEX16/X8_1`). With nothing contending, it runs at full x16.
2. Connect both PCIe power leads from the EVGA PSU to the card.

The 1080 Ti is roughly 300 mm long. In the View 71 it clears the rear drive trays with room to spare, so there is no need to move anything for it.

> [!WARNING]
> The 1080 Ti is **not** passed through to any VM. The NVIDIA driver lives on the Proxmox host and is shared into the containers that need it (Frigate detection, Ollama, faster-whisper). Do not VFIO the GPU — only the HBA gets VFIO'd. Mixing these two up is the easy mistake in this build.

### Seat the 9300-8i HBA in the bottom slot
1. Install the LSI/Broadcom 9300-8i (already flashed to IT mode, Initiator-Target mode) in the **bottom x4 slot** (`PCIEX4_3`).
2. This slot is **chipset-attached**, which is exactly what produces a clean IOMMU group for passthrough — the CPU-attached upper slots tend to share groups with other devices.
3. Connect the two SAS-to-SATA (Serial Attached SCSI) fan-out cables from the HBA to the two mirror IronWolfs you cabled earlier.

## Set the ASUS Maximus X Hero BIOS

Enter the BIOS by tapping `Del` repeatedly the moment the screen lights up on power-on. Work through these in order — the toggles live in different submenus, so do not stop after the first one.

### Update the BIOS first
Flash the latest Maximus X Hero firmware before touching any toggle, so the settings below sit on current microcode. Use the board's built-in **EZ Flash** utility (under the *Tool* menu) with the firmware file on a FAT32 USB stick. Reboot back into the BIOS after it finishes.

> [!WARNING]
> Do not interrupt the flash or cut power during it. A failed BIOS update on this board means a recovery dance you want to avoid — let EZ Flash run to completion.

### Enable Intel Virtualization (VMX)
1. Go to *Advanced → CPU Configuration*.
2. Find **Intel (VMX) Virtualization Technology** (older firmware labels it *Intel Virtualization Technology*).
3. Set it to **Enabled**. This is the core CPU virtualization switch that lets Proxmox run VMs at all.

### Enable Intel VT-d
1. Go to *Advanced → System Agent (SA) Configuration* — a **different submenu** than VMX, so do not assume the first toggle covered it.
2. Find **VT-d** (Intel Virtualization Technology for Directed I/O) and set it to **Enabled**.
3. This is the switch that makes PCIe passthrough possible. Without it, the 9300-8i can never be handed to the TrueNAS VM.

### Set the bottom slot to x4 mode
1. In the onboard-devices / PCIe configuration section, find the lane setting for **`PCIEX4_3`** (the bottom slot, where the HBA now sits).
2. Force it to **x4** rather than Auto. This keeps the HBA's lane allocation fixed and predictable inside its chipset-attached group.

### Save and confirm
Press `F10`, confirm, and let the board reboot. Leave the monitor and keyboard attached for now — you will need them for the OS install.

> [!TIP]
> C-states (under *CPU Power Management*) are worth leaving on Enabled or Auto. This box idles 24/7, so the watts saved over a year add up. They are not load-bearing for passthrough, just good housekeeping.

> [!DETAILS] Why x4 mode and a chipset slot matter
> Passthrough hands an entire IOMMU group to one VM. If the HBA shares a group with other devices, passthrough either fails outright or yanks those neighbours into the VM with it. The CPU-attached x16 slots on this board commonly group with the GPU and other system-agent devices; the chipset-attached `PCIEX4_3` slot tends to sit alone. Pinning it to x4 keeps that grouping stable across reboots and firmware quirks. You will verify the actual group from the host shell once Proxmox is installed, before binding the card to VFIO.
