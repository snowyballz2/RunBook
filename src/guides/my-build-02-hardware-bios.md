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

<svg viewBox="0 0 680 444" role="img" aria-label="Where each component mounts inside the Thermaltake View 71" style="width:100%;height:auto;max-width:680px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="678" height="442" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="27" style="fill:currentColor;font-size:14px;font-weight:600">Where everything mounts — View 71, left panel off</text>
<rect x="18" y="42" width="476" height="346" rx="10" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="30" y="60" style="fill:var(--color-ink-soft);font-size:10.5px">Thermaltake View 71 (full tower)</text>
<rect x="30" y="68" width="286" height="250" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<rect x="30" y="68" width="8" height="250" style="fill:var(--color-ink-faint);fill-opacity:0.45"/>
<text x="46" y="84" style="fill:var(--color-ink-soft);font-size:10px">ASUS Maximus X Hero · rear I/O at left edge</text>
<rect x="46" y="92" width="150" height="24" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="121" y="108" text-anchor="middle" style="fill:currentColor">ZBT-2 · USB (use extension)</text>
<rect x="120" y="130" width="190" height="34" rx="4" style="fill:#10b981;fill-opacity:0.14;stroke:#10b981"/>
<text x="215" y="151" text-anchor="middle" style="fill:currentColor">GTX 1080 Ti · top x16</text>
<rect x="120" y="176" width="104" height="22" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="172" y="191" text-anchor="middle" style="fill:currentColor">NVMe (M.2)</text>
<rect x="120" y="276" width="190" height="32" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="215" y="296" text-anchor="middle" style="fill:currentColor">9300-8i HBA · bottom x4</text>
<rect x="30" y="326" width="286" height="44" rx="4" style="fill:var(--color-ink-faint);fill-opacity:0.12;stroke:var(--color-line-strong)"/>
<text x="173" y="352" text-anchor="middle" style="fill:currentColor">EVGA 850W GQ · PSU (basement)</text>
<rect x="330" y="72" width="156" height="238" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="338" y="88" style="fill:var(--color-ink-soft);font-size:10px">Fixed rear trays</text>
<rect x="340" y="98" width="136" height="58" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="408" y="122" text-anchor="middle" style="fill:currentColor">IronWolf #1</text>
<text x="408" y="138" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">mirror → HBA</text>
<rect x="340" y="162" width="136" height="58" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="408" y="186" text-anchor="middle" style="fill:currentColor">IronWolf #2</text>
<text x="408" y="202" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">mirror → HBA</text>
<rect x="340" y="226" width="136" height="58" rx="4" style="fill:#f59e0b;fill-opacity:0.18;stroke:#f59e0b"/>
<text x="408" y="250" text-anchor="middle" style="fill:currentColor">IronWolf #3</text>
<text x="408" y="266" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">footage → board SATA</text>
<rect x="508" y="66" width="158" height="74" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="587" y="98" text-anchor="middle" style="fill:currentColor">CyberPower</text>
<text x="587" y="116" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">CP1500 UPS</text>
<rect x="508" y="152" width="158" height="56" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="587" y="184" text-anchor="middle" style="fill:currentColor">GS308EPP switch</text>
<text x="508" y="232" style="fill:var(--color-ink-soft);font-size:10px">↑ external to the case</text>
<rect x="20" y="404" width="14" height="14" rx="3" style="fill:#10b981;fill-opacity:0.14;stroke:#10b981"/>
<text x="40" y="415" style="fill:var(--color-ink-soft);font-size:10.5px">host-shared (GPU)</text>
<rect x="178" y="404" width="14" height="14" rx="3" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="198" y="415" style="fill:var(--color-ink-soft);font-size:10.5px">TrueNAS — mirror on the HBA</text>
<rect x="410" y="404" width="14" height="14" rx="3" style="fill:#f59e0b;fill-opacity:0.18;stroke:#f59e0b"/>
<text x="430" y="415" style="fill:var(--color-ink-soft);font-size:10.5px">Frigate footage (on the board)</text>
</svg>

*Two IronWolfs ride the HBA as the mirror; the third sits on a motherboard SATA port as Frigate's footage drive. The 1080 Ti stays on the host; only the HBA is passed through later.*

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

<svg viewBox="0 0 680 254" role="img" aria-label="PCIe slot plan on the Maximus X Hero" style="width:100%;height:auto;max-width:680px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="678" height="252" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="27" style="fill:currentColor;font-size:14px;font-weight:600">PCIe slot plan — Maximus X Hero</text>
<rect x="18" y="42" width="644" height="160" rx="10" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="40" y="74" style="fill:currentColor">PCIEX16_1 · CPU lanes · x16</text>
<rect x="360" y="57" width="282" height="26" rx="4" style="fill:#10b981;fill-opacity:0.14;stroke:#10b981"/>
<text x="501" y="74" text-anchor="middle" style="fill:currentColor">GTX 1080 Ti — stays on host</text>
<text x="40" y="112" style="fill:var(--color-ink-soft)">PCIEX16_2 · CPU lanes · x8</text>
<rect x="360" y="95" width="282" height="26" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong);stroke-dasharray:4 3"/>
<text x="501" y="112" text-anchor="middle" style="fill:var(--color-ink-soft)">— empty —</text>
<text x="40" y="150" style="fill:currentColor">M.2 slot · on board</text>
<rect x="360" y="133" width="282" height="26" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="501" y="150" text-anchor="middle" style="fill:currentColor">500 GB NVMe — OS + Frigate cache</text>
<text x="40" y="188" style="fill:currentColor">PCIEX4_3 · chipset · x4</text>
<rect x="360" y="171" width="282" height="26" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="501" y="188" text-anchor="middle" style="fill:currentColor">9300-8i HBA — passed to TrueNAS</text>
<text x="20" y="228" style="fill:var(--color-ink-soft);font-size:10.5px">Bottom chipset slot lands in its own clean IOMMU group — seat the HBA here, then force it to x4 in the BIOS.</text>
</svg>

*The two CPU-attached x16 slots feed the GPU; the chipset-attached bottom x4 slot is where the HBA isolates cleanly for passthrough.*

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

### Wire the power and data
With both cards seated, run every cable. The rule of thumb: **power comes from the PSU, data comes from the board — except the two mirror disks, whose data comes from the HBA.**

<svg viewBox="0 0 680 536" role="img" aria-label="Cabling map — power leads from the PSU and data leads from the board and HBA" style="width:100%;height:auto;max-width:680px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="678" height="534" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="27" style="fill:currentColor;font-size:14px;font-weight:600">Cabling — every lead from the PSU, board, and HBA</text>
<text x="20" y="52" style="fill:currentColor;font-size:12px;font-weight:600">① Power — from the EVGA 850W PSU</text>
<rect x="24" y="62" width="120" height="128" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="84" y="122" text-anchor="middle" style="fill:currentColor">EVGA 850W</text>
<text x="84" y="140" text-anchor="middle" style="fill:currentColor">GQ PSU</text>
<line x1="144" y1="92" x2="378" y2="80" style="stroke:#f43f5e;stroke-width:2"/>
<line x1="144" y1="120" x2="378" y2="124" style="stroke:#f43f5e;stroke-width:2"/>
<line x1="144" y1="150" x2="378" y2="169" style="stroke:#f43f5e;stroke-width:2"/>
<rect x="378" y="64" width="204" height="32" rx="4" style="fill:#10b981;fill-opacity:0.14;stroke:#10b981"/>
<text x="480" y="84" text-anchor="middle" style="fill:currentColor">GTX 1080 Ti — 2× PCIe 8-pin</text>
<rect x="378" y="108" width="204" height="32" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="480" y="128" text-anchor="middle" style="fill:currentColor">Board — 24-pin + 8-pin CPU</text>
<rect x="378" y="152" width="204" height="34" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="480" y="173" text-anchor="middle" style="fill:currentColor">3× IronWolf — 1 SATA-power each</text>
<line x1="18" y1="208" x2="662" y2="208" style="stroke:var(--color-line)"/>
<text x="20" y="232" style="fill:currentColor;font-size:12px;font-weight:600">② Data — from the board and the HBA</text>
<rect x="24" y="248" width="140" height="58" rx="6" style="fill:#6366f1;fill-opacity:0.14;stroke:#6366f1"/>
<text x="94" y="272" text-anchor="middle" style="fill:currentColor">9300-8i HBA</text>
<text x="94" y="290" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">1× SFF-8643 port</text>
<rect x="212" y="248" width="104" height="58" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="264" y="272" text-anchor="middle" style="fill:currentColor">SFF-8643 →</text>
<text x="264" y="290" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">4× SATA breakout</text>
<line x1="164" y1="277" x2="212" y2="277" style="stroke:#6366f1;stroke-width:2"/>
<line x1="316" y1="266" x2="470" y2="262" style="stroke:#6366f1;stroke-width:2"/>
<line x1="316" y1="292" x2="470" y2="302" style="stroke:#6366f1;stroke-width:2"/>
<rect x="470" y="246" width="188" height="32" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="564" y="266" text-anchor="middle" style="fill:currentColor">IronWolf #1 — mirror</text>
<rect x="470" y="286" width="188" height="32" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="564" y="306" text-anchor="middle" style="fill:currentColor">IronWolf #2 — mirror</text>
<text x="322" y="332" style="fill:var(--color-ink-soft);font-size:10px">+ 2 tails spare (grow later)</text>
<rect x="24" y="360" width="140" height="150" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="94" y="384" text-anchor="middle" style="fill:currentColor">Maximus X Hero</text>
<text x="36" y="412" style="fill:var(--color-ink-soft);font-size:10.5px">SATA port</text>
<text x="36" y="440" style="fill:var(--color-ink-soft);font-size:10.5px">M.2 slot</text>
<text x="36" y="468" style="fill:var(--color-ink-soft);font-size:10.5px">USB</text>
<line x1="164" y1="406" x2="470" y2="390" style="stroke:#10b981;stroke-width:2"/>
<line x1="164" y1="436" x2="470" y2="431" style="stroke:#10b981;stroke-width:2"/>
<line x1="164" y1="464" x2="470" y2="471" style="stroke:#10b981;stroke-width:2"/>
<rect x="470" y="374" width="188" height="32" rx="4" style="fill:#f59e0b;fill-opacity:0.18;stroke:#f59e0b"/>
<text x="564" y="394" text-anchor="middle" style="fill:currentColor">IronWolf #3 — footage</text>
<rect x="470" y="416" width="188" height="30" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="564" y="435" text-anchor="middle" style="fill:currentColor">500 GB NVMe</text>
<rect x="470" y="456" width="188" height="30" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="564" y="475" text-anchor="middle" style="fill:currentColor">ZBT-2 coordinator</text>
<rect x="22" y="512" width="14" height="11" rx="2" style="fill:#f43f5e"/>
<text x="42" y="521" style="fill:var(--color-ink-soft);font-size:10.5px">PSU power</text>
<rect x="150" y="512" width="14" height="11" rx="2" style="fill:#6366f1"/>
<text x="170" y="521" style="fill:var(--color-ink-soft);font-size:10.5px">HBA → mirror (SAS)</text>
<rect x="330" y="512" width="14" height="11" rx="2" style="fill:#10b981"/>
<text x="350" y="521" style="fill:var(--color-ink-soft);font-size:10.5px">motherboard data (SATA / M.2 / USB)</text>
</svg>

The footage drive and the NVMe both ride the board; only the two mirror disks hang off the HBA. The ZBT-2 is the one thing you leave unplugged for now — it goes into a USB port once Proxmox is up.

## Set the ASUS Maximus X Hero BIOS

Enter the BIOS by tapping `Del` repeatedly the moment the screen lights up on power-on. Work through these in order — the toggles live in different submenus, so do not stop after the first one.

### Update the BIOS first
Flash the latest Maximus X Hero firmware before touching any toggle, so the settings below sit on current microcode. This needs its own USB stick — it is **not** the Proxmox installer stick you make later.

1. On another computer, open the ASUS support page for the **ROG Maximus X Hero** (asus.com → Support → search "Maximus X Hero" → **Driver & Tools → BIOS & Firmware**) and download the **latest BIOS** file. Note the version number — you will confirm it after the flash.
2. Unzip the download. ASUS firmware must carry the exact filename EZ Flash expects, so run the bundled **BIOSRenamer** utility (included in the same zip) once — it renames the file for you.
3. Format a USB stick as **FAT32** and copy the renamed BIOS file to its **root** (not inside a folder).
4. Plug the stick into the server, enter the BIOS (`Del` on power-on), and open **EZ Flash 3** under the *Tool* menu. Point it at the file on the stick and confirm. The board flashes, reboots itself, and lands back in the BIOS — where you carry on with the toggles below. After the flash, the BIOS version shows on the **EZ Mode** main screen (and is listed in EZ Flash 3 itself) — confirm it matches the version you downloaded before continuing.

> [!WARNING]
> Do not interrupt the flash or cut power during it. A failed BIOS update on this board means a recovery dance you want to avoid — let EZ Flash run to completion.

> [!TIP]
> A firmware update occasionally moves or renames a toggle, so if one isn't where it's written below, use the BIOS search — press `F9` (or click the magnifier in Advanced Mode) and search for `VMX`, `VT-d`, or the slot name `PCIEX4_3` to jump straight to it.

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

> [!DETAILS] Confirm the toggles actually took
> Windows is still on the NVMe at this point — you do not wipe it until the OS install — so you can verify virtualization from the existing install: boot into Windows, press `Ctrl+Shift+Esc` for Task Manager → **Performance → CPU**, and the right-hand column should read **Virtualization: Enabled**. If you would rather not boot Windows, no stress — the Proxmox installer on the next stage warns loudly if hardware virtualization is missing, so a missed VMX or VT-d toggle surfaces there too.

> [!DETAILS] Why x4 mode and a chipset slot matter
> Passthrough hands an entire IOMMU group to one VM. If the HBA shares a group with other devices, passthrough either fails outright or yanks those neighbours into the VM with it. The CPU-attached x16 slots on this board commonly group with the GPU and other system-agent devices; the chipset-attached `PCIEX4_3` slot tends to sit alone. Pinning it to x4 keeps that grouping stable across reboots and firmware quirks. You will verify the actual group from the host shell once Proxmox is installed, before binding the card to VFIO.
