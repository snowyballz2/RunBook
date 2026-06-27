---
title: Start Here
subtitle: The map for my build — what runs where, and the order to do it in
collection: My Build
order: 1
accent: amber
---

This collection is my own house build of the *Proxmox Home Server* guides — not a re-teach, but a checklist of the exact hardware I bought and the choices I made, in the order I'm doing them. Each page points at its matching general guide for the full how-to and then adds only my specifics.

## The shape of it

One box runs everything. **Proxmox VE** is the host on the bare metal, and every service is a guest on top of it:

- **Home Assistant OS** runs in its own **VM** (virtual machine) — the brain of the house, talking to Zigbee, Matter, Lutron, and the cameras.
- **TrueNAS** runs in a **VM** too, and owns the storage: the **LSI 9300-8i HBA (host bus adapter) is passed through whole** (VFIO, Virtual Function I/O, the kernel feature that hands a whole device to one VM) so ZFS (Zettabyte File System) sees the raw disks, not virtual ones.
- Everything else runs as a lightweight **LXC** (Linux Containers) — Frigate, AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, Uptime Kuma.
- The **GTX 1080 Ti stays on the host**: the NVIDIA driver lives on Proxmox and is *shared into* the LXCs that need it (Frigate detection, Ollama, faster-whisper). It is **not** VFIO'd to any VM — only the HBA is.

> [!NOTE]
> The one passthrough rule for this build: **VFIO the HBA to TrueNAS, share the GPU into LXCs.** Mixing those up is the mistake to avoid — see *Frigate* for the host-driver/LXC sharing and *TrueNAS* for the HBA passthrough.

> [!TIP]
> Boot order matters: the **HA (Home Assistant) VM starts before the Frigate LXC**, because Frigate depends on HA's MQTT (Message Queuing Telemetry Transport) broker. Set the start/shutdown order in Proxmox so it survives a reboot.

## The parts

> [!DETAILS] Core PC — board, CPU, power, case
> - **Motherboard:** ASUS ROG Maximus X Hero (Z370)
> - **CPU:** Intel i7-8700K
> - **RAM:** 32 GB
> - **PSU:** EVGA 850W GQ (Gold)
> - **Case:** Thermaltake View 71 full tower
> - **GPU:** EVGA GTX 1080 Ti FTW

> [!DETAILS] Storage — NVMe, disks, HBA
> - **500 GB NVMe** — Proxmox OS + Frigate cache
> - **3x Seagate IronWolf ST4000VN006 (4 TB)** — two form the TrueNAS ZFS mirror, one is the Frigate footage drive
> - **LSI/Broadcom 9300-8i HBA** — IT mode, pre-flashed; passed through to TrueNAS
>
> Slot plan: 1080 Ti in the top x16 slot; HBA in the bottom x4_3 slot, set to x4 in BIOS (chipset-attached = clean IOMMU (Input/Output Memory Management Unit) group).

> [!DETAILS] Network, power, and radios
> - **Netgear GS308EPP** managed PoE+ switch (for future PoE cameras)
> - **CyberPower CP1500PFCLCD** UPS (monitored over NUT)
> - **HA Connect ZBT-2** Zigbee coordinator (ember / Zigbee2MQTT)
> - **HomePod mini** — Thread border router + Apple Home hub

> [!DETAILS] Devices the house controls
> - **Locks:** 3x Aqara U400 (Matter-over-Thread)
> - **Cameras:** Reolink Video Doorbell WiFi + Reolink RLC-510WA → Frigate
> - **Leak/valve:** 12x Third Reality leak sensors, Aqara Valve Controller T1, Third Reality smart plugs (Zigbee routers)
> - **Existing:** Lutron Caséta (lights + shades, Pro bridge), 2x ecobee, Google/Nest speakers, Samsung Family Hub fridge

## How to use this collection

> [!TIP]
> A few habits for reading these pages:
>
> - **Each page links its general guide.** The general guide has the full walkthrough; the My Build page only adds my values and the choices I made. Do the general guide's steps, then apply my specifics.
> - **Sensitive values are credential fields.** IPs, drive serials, usernames, passwords, and tokens live in **device-local fields** on the page — they never get committed and never leave this device. Hardware and choices are plain text. My real synced secret store is **Vaultwarden**; these fields are just convenience.
> - **The order is the plan.** This collection is laid out in the sequence I'm actually doing the work — top to bottom. Start at the top and follow the order numbers.

When you're ready, head to **page 2** — the hardware prep and BIOS settings (my specific slot plan, the VT-d (Intel Virtualization Technology for Directed I/O)/x4 switches), keyed to the *Prep & BIOS* general guide.
