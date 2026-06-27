---
title: Start Here
subtitle: What this build is, how it fits together, and the order to do it in
collection: My Build
order: 1
accent: amber
---

This collection is a complete, hands-on build of one all-in-one home server: a single full-tower PC that runs the smart home, the cameras, the file storage, and a handful of self-hosted services — all locally, all on hardware you own. Each page is a self-contained how-to for one stage of the build. Work through them top to bottom, in order, and at the end you have a quiet box in the basement running the whole house.

This first page is the map. Read it, gather the parts, set the server's address, then start building.

## Before you begin

### Know what you are building
One physical computer hosts everything. **Proxmox VE** (Proxmox Virtual Environment, a free virtualization platform) runs directly on the bare metal, and every service lives on top of it as either a virtual machine or a lightweight container:

- **Home Assistant OS** runs in its own **VM** (virtual machine) — the brain of the house. It talks to Zigbee, Matter, Lutron, the thermostats, and the cameras, and runs every automation.
- **TrueNAS** runs in a second **VM** and owns the bulk storage. Its disk controller is handed to it whole, so the **ZFS** (Zettabyte File System, a storage system with built-in data integrity) sees real, raw drives.
- **Frigate** (a local camera recorder with object detection) and the supporting services each run as a fast, low-overhead **LXC** (Linux Containers): Frigate, AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, and Uptime Kuma.

The single most important design decision — and the one that trips people up — is how the two add-in cards are treated. They go opposite ways:

> [!WARNING]
> **The GTX 1080 Ti graphics card stays on the host and is _shared_ into containers. The disk controller is _passed through whole_ to one VM.** Never swap these. Getting it backwards breaks GPU sharing or breaks the storage.

- **The GTX 1080 Ti is shared, not passed through.** The NVIDIA driver lives on the Proxmox host, and the host lends the one card into the LXCs that need it — Frigate detection, the Ollama **LLM** (large language model) runner, and faster-whisper speech-to-text — all at the same time. The Home Assistant VM reaches those services over the **LAN** (local area network). The card is deliberately *not* given to any single guest with **VFIO** (Virtual Function I/O, the kernel feature that hands a whole device to one VM).
- **The LSI 9300-8i HBA _is_ passed through.** This **HBA** (host bus adapter, the card the data disks plug into) gets VFIO'd in its entirety to the TrueNAS VM, so ZFS manages the raw disks directly with full health reporting and no risk of silent corruption.

> [!NOTE]
> One more dependency to remember: **start the Home Assistant VM before the Frigate container.** Frigate publishes to the **MQTT** (Message Queuing Telemetry Transport, a lightweight messaging broker) service that lives with Home Assistant, so the broker has to exist first. You set this start order explicitly on the Virtual Machines page so it survives every reboot.

### Understand the disk layout
Three different jobs, three different homes:

- The **500 GB NVMe** (Non-Volatile Memory Express, a fast solid-state drive) holds the Proxmox OS and the Frigate cache.
- **Two of the three IronWolf hard drives** become the TrueNAS **ZFS mirror** — your real, redundant file storage. These two hang off the passed-through HBA.
- **The third IronWolf** is the Frigate footage drive. It does *not* go on the HBA; it plugs into a **SATA** (Serial Advanced Technology Attachment, the common drive interface) port on the motherboard, because the host and Frigate need direct access to it.

All three hard drives mount in the fixed rear drive trays of the case, behind the motherboard tray — the removable front pods are not needed.

### Gather the parts
Check you have everything before you start — the later pages assume each piece is on hand.

> [!DETAILS] Core PC — board, CPU, power, case
> - **Motherboard:** ASUS ROG Maximus X Hero (Z370)
> - **CPU:** Intel i7-8700K
> - **RAM:** 32 GB
> - **PSU** (power supply unit)**:** EVGA 850W GQ (Gold) — ample for the GPU plus a stack of spinning disks
> - **Case:** Thermaltake View 71 full tower
> - **GPU:** EVGA GTX 1080 Ti FTW

> [!DETAILS] Storage — NVMe, disks, HBA
> - **500 GB NVMe** — Proxmox OS + Frigate cache
> - **3x Seagate IronWolf ST4000VN006 (4 TB)** — two form the TrueNAS ZFS mirror, one is the Frigate footage drive
> - **LSI/Broadcom 9300-8i HBA** — IT mode (Initiator-Target mode, where the card exposes raw disks instead of building its own array), pre-flashed; passed through to TrueNAS

> [!DETAILS] Network, power, and radios
> - **Netgear GS308EPP** managed switch with **PoE** (Power over Ethernet, power and data on one cable) for future cameras
> - **CyberPower CP1500PFCLCD UPS** (uninterruptible power supply, the battery backup) — monitored over **NUT** (Network UPS Tools)
> - **HA Connect ZBT-2** Zigbee coordinator (ember driver, paired with Zigbee2MQTT)
> - **HomePod mini** — the Thread border router and Apple Home hub

> [!DETAILS] What the house controls
> - **Locks:** 3x Aqara U400 (Matter-over-Thread), commissioned into Apple Home first, then shared to Home Assistant
> - **Cameras:** Reolink Video Doorbell WiFi (the black 4:3 model, wired off the door transformer) + Reolink RLC-510WA (5MP WiFi), both feeding Frigate
> - **Leak protection:** 12x Third Reality leak sensors, an Aqara Valve Controller T1 on the main shutoff lever, and Third Reality smart plugs acting as Zigbee routers
> - **Already in the house:** Lutron Caseta lights and shades (Pro bridge), 2x ecobee thermostats, Google/Nest speakers for announcements, and a Samsung Family Hub fridge

### Save your files and line up a second computer
Two things to handle before any hardware goes together — both easy to forget, both painful to discover late.

**The 500 GB NVMe currently has Windows and your files on it.** It becomes the Proxmox boot drive, and the install **erases the whole drive**. Copy anything you want to keep onto another machine or an external disk *before* you start — there is no undo once the installer runs.

**You also need a second, working computer nearby** — in this all-Apple house, your Mac. The server has no operating system yet, so every download and prep task happens on that other machine: fetching the Proxmox installer, downloading the board's BIOS, and writing the USB sticks. You also borrow a **monitor and keyboard** plugged straight into the server for the install itself, then unplug them and run everything from the Mac's browser once Proxmox is up.

> [!WARNING]
> Wiping the NVMe is irreversible. Confirm your files are copied off — and that a few of them actually open from the copy — before you reach the install.

> [!DETAILS] What to pull off the NVMe before it is wiped
> Most of what matters lives in a handful of places — work down this list on the Windows machine, then copy it all to an external drive or another PC and spot-check that it opens:
> - **Personal files** — `Documents`, `Desktop`, `Downloads`, `Pictures`, `Videos`. Downloads is the one people forget.
> - **Browser bookmarks and saved passwords** — export them from each browser's settings (delete any exported password file once it is safely imported elsewhere).
> - **License keys** — pull keys for paid software from purchase emails or each app's About/Account screen while you can still open it.
> - **App data** — paste `%APPDATA%` into a File Explorer address bar and skim for email clients, chat history, and configs worth keeping.

### Set the server's address
The whole collection starts from one number — the static address you give the Proxmox host. Set it now and every later page reuses it.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The static address for the server. Reach the web interface at `https://`-this-ip-`:8006` once Proxmox is installed. Every later page starts from this value.

> [!TIP]
> A few habits that make the build go smoothly:
>
> - **Each page is complete on its own.** The full steps for that stage are written inline and specialized to this exact hardware. You do not need any other reference.
> - **Sensitive values are credential fields, not plain text.** Anything secret — IP addresses, drive serials, usernames, passwords, tokens — is captured in a fill-in field that stays on this device and is never committed or synced. Plain hardware and choices are written out normally. Your real synced secret store is Vaultwarden; these fields are just a convenience as you follow along.
> - **The order is the plan.** Build top to bottom. When a later page says "after the GPU is shared in" or "once the mirror exists," it is pointing back at a stage you have already finished.

## The build, in order

### Work through the pages top to bottom
The pages are numbered in the exact sequence to build in. Do not skip ahead — most stages assume the previous one is finished.

1. **Start Here** — this page: the map and parts list.
2. **Hardware & BIOS** — seat the cards in the right slots and flip the firmware switches (virtualization and **VT-d** (Intel Virtualization Technology for Directed I/O) on) before any software goes on.
3. **Install Proxmox** — install Proxmox to the NVMe, switch to the free repository, and enable **IOMMU** (Input/Output Memory Management Unit, the hardware that isolates a device for passthrough).
4. **Containers** — how the lightweight LXC service containers are created and configured.
5. **Virtual Machines** — build the TrueNAS and Home Assistant VMs, and set the start-before-Frigate boot order.
6. **GPU Sharing & HBA Passthrough** — put the NVIDIA driver on the host and share the card into containers; VFIO the HBA to the TrueNAS VM.
7. **TrueNAS Storage** — build the ZFS mirror on the passed-through HBA and share folders over **SMB** (Server Message Block, the Windows/Mac file-sharing protocol).
8. **Protect Your Data** — snapshots, scrubs, disk-health alerts, and the encrypted offsite copy.
9. **Home Assistant & Zigbee2MQTT** — bring up Home Assistant and pair the Zigbee leak sensors, valve, and router plugs.
10. **Matter Locks** — commission the Aqara U400 locks into Apple Home, then share them to Home Assistant.
11. **Cameras, Doorbell & Frigate** — point the Reolink cameras at Frigate and run detection on the shared GPU.
12. **AdGuard** — the household DNS (Domain Name System) and ad-blocking resolver.
13. **Reverse Proxy** — clean hostnames and certificates with Nginx Proxy Manager.
14. **Remote Access** — reach everything from anywhere with Tailscale, no port-forwards.
15. **Nextcloud** — self-hosted files and photos, backed by the ZFS mirror.
16. **Vaultwarden** — the synced password vault and the build's secret store.
17. **Homepage** — a single dashboard linking every service.
18. **Uptime Kuma** — monitoring and alerts for the whole rack.
19. **Proxmox Backups** — scheduled backups of every guest, plus the host config.
20. **UPS & Safe Shutdown** — graceful shutdown on a power cut, over NUT.
21. **Automations** — the leak-to-valve safety rule, presence, locks, and climate logic.
22. **Voice — Siri & Local Assist** — both the Apple/Siri path and the fully-local voice assistant.
23. **Maintenance & Upkeep** — the monthly and quarterly routine that keeps it boring.

When you are ready, move on to **Hardware & BIOS** to seat the cards and prepare the firmware.
