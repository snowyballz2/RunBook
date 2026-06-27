---
title: Hardware, BIOS & Slots
subtitle: The parts, where each card goes, and the firmware switches to flip first
collection: My Build
order: 2
accent: azure
---

> [!NOTE]
> This is the build-specific checklist for the *Prep & BIOS* guide. That guide has the full why and the step-by-step; this page is just my exact parts, slot plan, and BIOS settings. Do this on bare metal before installing Proxmox.

### The parts going in
The core of the build is a Z370 platform I already own, with two add-in cards that matter for passthrough later.

- **Board / CPU / RAM** — ASUS ROG Maximus X Hero (Z370) + i7-8700K + 32 GB RAM.
- **PSU (power supply unit)** — EVGA 850W GQ (Gold). Ample for a 1080 Ti plus a pile of spinning disks; no concerns.
- **Case** — Thermaltake View 71 full tower.
- **GPU** — EVGA GTX 1080 Ti FTW (~300 mm long).
- **HBA (host bus adapter)** — LSI/Broadcom 9300-8i, IT mode (Initiator-Target mode), bought pre-flashed (white-box). This is the card that gets VFIO (Virtual Function I/O)'d to TrueNAS.
- **Coordinator / UPS (uninterruptible power supply) / switch (not slot-related, just going in the build)** — HA Connect ZBT-2 Zigbee coordinator, CyberPower CP1500PFCLCD UPS, Netgear GS308EPP PoE+ (Power over Ethernet) switch.

> [!NOTE]
> The 1080 Ti is ~300 mm. In the View 71 it clears the HDD cage fine — no need to pull or move the cage. If a future longer card ever changes that, the cage is modular.

### The PCIe (Peripheral Component Interconnect Express) slot plan
Two cards, two goals: give the GPU full bandwidth, and land the HBA in a clean IOMMU (Input/Output Memory Management Unit) group so it passes through to the TrueNAS VM (virtual machine) by itself.

- **GTX 1080 Ti → top x16 slot** (`PCIEX16/X8_1`). Runs at x16 with nothing else contending. The NVIDIA driver lives on the Proxmox **host** and is shared into the LXCs (Frigate, Ollama, faster-whisper) — see *Frigate* — so this card is **not** passed through to any VM.
- **9300-8i HBA → bottom x4 slot** (`PCIEX4_3`). This slot is **chipset-attached**, which is exactly what gives a clean IOMMU group for VFIO passthrough — the point the *TrueNAS* guide makes about putting the HBA in a chipset slot.

> [!WARNING]
> VFIO **only** the HBA → TrueNAS VM. Do **not** VFIO the GPU — it stays on the host and is shared into LXCs. Mixing those two up is the easy mistake here.

### BIOS settings to flip
Enter the BIOS (`Del` on this ASUS board) and set these. The *Prep & BIOS* guide has the menu paths for ASUS Z-series boards; here are my specific values.

1. **Update the BIOS first.** Do this before anything else so the toggles below sit on current firmware.
2. **Intel Virtualization (VMX)** (Virtual Machine Extensions) — *Advanced → CPU Configuration*. Newer ASUS BIOSes label it **Intel (VMX) Virtualization Technology**. Set **Enabled**.
3. **Intel VT-d (Intel Virtualization Technology for Directed I/O)** — *Advanced → System Agent (SA) Configuration* (a different submenu than VMX, so don't stop after the first toggle). Set **Enabled**. This is what makes HBA passthrough possible.
4. **Set `PCIEX4_3` to x4 mode** — in the onboard-devices / PCIe configuration section, force the bottom slot to **x4**. This keeps the HBA's lane allocation clean and predictable in its chipset-attached group.

Save with `F10` and confirm on exit.

> [!TIP]
> C-states (Enabled/Auto) are worth leaving on — this box idles 24/7, so the saved watts add up. The general guide covers this; it's not load-bearing for passthrough.

### Verify IOMMU groups later
Don't take the slot plan on faith — confirm it once Proxmox is installed. From the **host shell** after first boot, check that the 9300-8i sits in its own IOMMU group (alone, or only with its own functions) before you bind it to VFIO and hand it to the TrueNAS VM.

> [!NOTE]
> If the HBA shares a group with other devices, passthrough either fails or drags neighbours along. The chipset-attached `PCIEX4_3` slot + x4 mode above is chosen precisely to avoid that — verifying just proves it. The *TrueNAS* guide picks up from here with the VFIO bind and `qm set` passthrough.
