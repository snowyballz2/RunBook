---
title: Hardware & BIOS
subtitle: Assemble the parts, seat the cards, and flip the firmware switches first
collection: My Build
order: 2
accent: azure
---

This is the bare-metal stage: get every part into the Thermaltake View 71, land the two add-in cards in the right PCIe (Peripheral Component Interconnect Express) slots, and set the ASUS ROG Maximus X Hero BIOS so virtualization and device passthrough work later. Do all of this before installing the host OS — the firmware switches here are easy to forget and annoying to discover missing once Proxmox VE (Proxmox Virtual Environment, PVE) is on.

## Assemble the parts

The platform is a Z370 build: an ASUS ROG Maximus X Hero board with an Intel i7-8700K and 32 GB RAM, fed by a Thermaltake Toughpower Grand RGB 850W Gold PSU (power supply unit, fully modular) — ample for the GTX 1080 Ti plus a pile of spinning disks. Everything goes into the Thermaltake View 71 full tower.

<svg viewBox="0 0 680 444" role="img" aria-label="Where each component mounts inside the Thermaltake View 71" style="width:100%;height:auto;max-width:680px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="678" height="442" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="27" style="fill:currentColor;font-size:14px;font-weight:600">Where everything mounts — View 71, left panel off</text>
<rect x="18" y="42" width="476" height="346" rx="10" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="30" y="60" style="fill:var(--color-ink-soft);font-size:10.5px">Thermaltake View 71 (full tower)</text>
<rect x="30" y="68" width="286" height="250" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<rect x="30" y="68" width="8" height="250" style="fill:var(--color-ink-faint);fill-opacity:0.45"/>
<text x="46" y="84" style="fill:var(--color-ink-soft);font-size:10px">ASUS Maximus X Hero · rear I/O at left edge</text>
<rect x="46" y="92" width="150" height="24" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="121" y="108" text-anchor="middle" style="fill:currentColor">ZBT-2 · USB (later)</text>
<rect x="120" y="130" width="190" height="34" rx="4" style="fill:#10b981;fill-opacity:0.14;stroke:#10b981"/>
<text x="215" y="151" text-anchor="middle" style="fill:currentColor">GTX 1080 Ti · top x16</text>
<rect x="120" y="176" width="104" height="22" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="172" y="191" text-anchor="middle" style="fill:currentColor">NVMe (M.2)</text>
<rect x="120" y="276" width="190" height="32" rx="4" style="fill:#6366f1;fill-opacity:0.16;stroke:#6366f1"/>
<text x="215" y="296" text-anchor="middle" style="fill:currentColor">9300-8i HBA · bottom x4</text>
<rect x="30" y="326" width="286" height="44" rx="4" style="fill:var(--color-ink-faint);fill-opacity:0.12;stroke:var(--color-line-strong)"/>
<text x="173" y="352" text-anchor="middle" style="fill:currentColor">Toughpower 850W · PSU (basement)</text>
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
2. Install the Toughpower Grand RGB 850W in the bottom PSU shroud. Run the 24-pin and the 8-pin CPU power now; leave the PCIe power leads loose until the GPU is in.

### Place the three IronWolf drives
The build has three Seagate IronWolf ST4000VN006 4 TB drives. Two of them become a TrueNAS ZFS (Zettabyte File System) mirror; the third holds Frigate footage.

1. Mount all three IronWolfs in the View 71's **fixed rear drive trays** behind the motherboard tray. The removable front pods are not required for this build.
2. The **two mirror drives belong on the LSI/Broadcom 9300-8i HBA (host bus adapter)**, not the board — they follow the HBA into the TrueNAS VM (virtual machine). Leave their data connectors empty for now; you cable them once the HBA is seated below.
3. Cable the **single footage drive to a motherboard SATA (Serial Advanced Technology Attachment) port**. The host and the Frigate container need direct access to it, so it stays on the board — never on the HBA.
4. Mount the 500 GB NVMe (Non-Volatile Memory Express) drive on the board's M.2 slot. This is the Proxmox OS plus Frigate cache disk.

Here is the tray plate itself — traced from the actual part, hole for hole. The plate is stamped with its own manual (`A: 3.5" HDD`, `B: 2.5" HDD/SSD`), and the stamps on the metal are always the authority:

<svg viewBox="0 0 680 640" role="img" aria-label="Schematic of the View 71 drive tray plate traced from the actual part, with A and B hole positions, hook tabs, and the rail it hangs on" style="width:100%;height:auto;max-width:680px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="678" height="638" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="28" style="fill:currentColor;font-size:14px;font-weight:600">The View 71 tray plate — traced from the part</text>
<text x="20" y="46" style="fill:var(--color-ink-soft);font-size:10px">Face shown = the side the drive sits on. Hole positions approximate; the stamped letters win.</text>
<rect x="170" y="74" width="100" height="24" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<rect x="80" y="90" width="280" height="450" rx="14" style="fill:var(--color-surface-2);stroke:var(--color-line-strong);stroke-width:1.6"/>
<circle cx="220" cy="86" r="6" style="fill:var(--color-paper);stroke:currentColor;stroke-width:1.4"/>
<text x="234" y="80" style="fill:currentColor;font-size:9.5px">lock-screw hole — this end is UP</text>
<rect x="140" y="540" width="30" height="16" rx="3" style="fill:#10b981;fill-opacity:0.25;stroke:#10b981"/>
<rect x="250" y="540" width="30" height="16" rx="3" style="fill:#10b981;fill-opacity:0.25;stroke:#10b981"/>
<text x="80" y="572" style="fill:#10b981;font-size:9.5px">hook tabs — these bite into the rail slots first</text>
<rect x="96" y="118" width="248" height="404" rx="8" style="fill:none;stroke:var(--color-ink-faint);stroke-width:1.2;stroke-dasharray:6 4"/>
<text x="220" y="238" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:9.5px">IronWolf footprint — PCB side down</text>
<circle cx="114" cy="137" r="6" style="fill:none;stroke:#6366f1;stroke-width:1.6"/>
<text x="126" y="132" style="fill:#6366f1;font-size:9px">B</text>
<circle cx="313" cy="143" r="6" style="fill:none;stroke:#6366f1;stroke-width:1.6"/>
<text x="298" y="138" style="fill:#6366f1;font-size:9px">B</text>
<rect x="109" y="264" width="28" height="50" rx="12" style="fill:none;stroke:var(--color-line-strong);stroke-width:1.2"/>
<circle cx="123" cy="277" r="5.5" style="fill:none;stroke:#6366f1;stroke-width:1.6"/>
<circle cx="123" cy="301" r="5.5" style="fill:none;stroke:#6366f1;stroke-width:1.6"/>
<text x="143" y="282" style="fill:#6366f1;font-size:9px">B</text>
<text x="143" y="306" style="fill:#6366f1;font-size:9px">B</text>
<rect x="246" y="262" width="28" height="52" rx="12" style="fill:none;stroke:var(--color-line-strong);stroke-width:1.2"/>
<circle cx="260" cy="275" r="6" style="fill:none;stroke:#f43f5e;stroke-width:2.2"/>
<circle cx="260" cy="275" r="2.4" style="fill:#f43f5e"/>
<circle cx="260" cy="301" r="6" style="fill:none;stroke:#f43f5e;stroke-width:2.2"/>
<circle cx="260" cy="301" r="2.4" style="fill:#f43f5e"/>
<circle cx="321" cy="268" r="7" style="fill:none;stroke:#f59e0b;stroke-width:2.2"/>
<text x="333" y="262" style="fill:#f59e0b;font-size:9px">A</text>
<circle cx="114" cy="400" r="7" style="fill:none;stroke:#f59e0b;stroke-width:2.2"/>
<text x="98" y="395" style="fill:#f59e0b;font-size:9px">A</text>
<circle cx="321" cy="400" r="7" style="fill:none;stroke:#f59e0b;stroke-width:2.2"/>
<text x="333" y="395" style="fill:#f59e0b;font-size:9px">A</text>
<circle cx="114" cy="499" r="6" style="fill:none;stroke:var(--color-ink-faint);stroke-width:1.5"/>
<circle cx="248" cy="499" r="5.5" style="fill:none;stroke:#6366f1;stroke-width:1.6"/>
<circle cx="282" cy="499" r="5.5" style="fill:none;stroke:#6366f1;stroke-width:1.6"/>
<text x="258" y="516" style="fill:#6366f1;font-size:9px">B</text>
<text x="150" y="452" style="fill:var(--color-ink-soft);font-size:10px;font-style:italic">A: 3.5&quot; HDD</text>
<text x="150" y="467" style="fill:var(--color-ink-soft);font-size:10px;font-style:italic">B: 2.5&quot; HDD/SSD</text>
<line x1="272" y1="288" x2="316" y2="288" style="stroke:#f43f5e;stroke-width:1;stroke-dasharray:2 2"/>
<text x="80" y="600" style="fill:currentColor;font-size:10px">Amber A + red damped = the IronWolf&apos;s four #6-32</text>
<text x="80" y="614" style="fill:currentColor;font-size:10px">positions. Snug — bottom holes take max 1/4&quot; of thread.</text>
<line x1="420" y1="60" x2="420" y2="620" style="stroke:var(--color-line)"/>
<text x="436" y="80" style="fill:currentColor;font-size:11.5px;font-weight:600">Hanging it on the rail</text>
<rect x="452" y="96" width="34" height="330" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<rect x="462" y="118" width="14" height="30" rx="3" style="fill:var(--color-paper);stroke:var(--color-line-strong)"/>
<circle cx="469" cy="170" r="4" style="fill:var(--color-paper);stroke:currentColor;stroke-width:1.2"/>
<rect x="462" y="216" width="14" height="30" rx="3" style="fill:var(--color-paper);stroke:var(--color-line-strong)"/>
<circle cx="469" cy="268" r="4" style="fill:var(--color-paper);stroke:currentColor;stroke-width:1.2"/>
<rect x="462" y="314" width="14" height="30" rx="3" style="fill:var(--color-paper);stroke:var(--color-line-strong)"/>
<circle cx="469" cy="366" r="4" style="fill:var(--color-paper);stroke:currentColor;stroke-width:1.2"/>
<text x="452" y="444" style="fill:var(--color-ink-soft);font-size:9px">slot + threaded hole,</text>
<text x="452" y="456" style="fill:var(--color-ink-soft);font-size:9px">3 stacked positions</text>
<polyline points="600,231 512,231 512,240 478,240" style="fill:none;stroke:#10b981;stroke-width:2.4"/>
<rect x="596" y="222" width="52" height="18" rx="3" style="fill:var(--color-surface-2);stroke:currentColor;stroke-width:1.3"/>
<text x="622" y="212" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">plate, edge-on</text>
<line x1="560" y1="176" x2="560" y2="196" style="stroke:#f59e0b;stroke-width:2.2"/>
<circle cx="560" cy="172" r="5" style="fill:none;stroke:#f59e0b;stroke-width:1.6"/>
<text x="574" y="182" style="fill:#f59e0b;font-size:9px">lock screw → rail&apos;s</text>
<text x="574" y="194" style="fill:#f59e0b;font-size:9px">threaded hole</text>
<text x="436" y="490" style="fill:currentColor;font-size:10px">① Drive to plate: 4× #6-32 in the A/red holes.</text>
<text x="436" y="506" style="fill:currentColor;font-size:10px">② Tabs into a slot pair on the rail behind the</text>
<text x="436" y="520" style="fill:currentColor;font-size:10px">motherboard tray; swing the plate flush.</text>
<text x="436" y="536" style="fill:currentColor;font-size:10px">③ One screw through the top hole into the</text>
<text x="436" y="550" style="fill:currentColor;font-size:10px">rail&apos;s threaded hole. SATA + power point at</text>
<text x="436" y="564" style="fill:currentColor;font-size:10px">the cable cutouts. Repeat ×3.</text>
<text x="436" y="592" style="fill:var(--color-ink-soft);font-size:9.5px">A holes take #6-32 (3.5&quot; thread) ·</text>
<text x="436" y="606" style="fill:var(--color-ink-soft);font-size:9.5px">B holes take M3 (2.5&quot; drives only)</text>
</svg>

*Traced from the plate in hand: the top hump with the lock-screw hole is UP, the two bent tabs at the bottom hook the rail. The two red-ringed holes are factory rubber-damped — use them as two of your four #6-32 positions so the spinning drive stays quiet against the sheet metal. Dry-fit the bare plate on the rail once before screwing any drive down, just to see which face ends up outward.*

> [!TIP]
> Label the two mirror drives now and record their serials below. ZFS identifies disks by serial, and you will want to know which physical drive is which when one eventually fails. The footage drive can stay unlabelled — it is the lone one on a board SATA port.

> [!INPUT] zfs-mirror-disk1-serial | IronWolf mirror disk 1 serial

> [!INPUT] zfs-mirror-disk2-serial | IronWolf mirror disk 2 serial

### Fit the radio, switch, and UPS
These are not slot-related, but they go in with the build:

- **HA Connect ZBT-2** Zigbee coordinator — leave it boxed for now; it plugs into USB via a short extension lead once the host is up (keeps the radio away from case interference).
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
1. Install the EVGA GTX 1080 Ti FTW3 in the **top x16 slot** (`PCIEX16_1`). With nothing contending, it runs at full x16.
2. Connect both PCIe power leads from the Toughpower PSU to the card — two separate cables, per the PSU map below.

The 1080 Ti is roughly 300 mm long. In the View 71 it clears the front drive-cage area with room to spare, so there is no need to remove the front pods for it.

> [!WARNING]
> The 1080 Ti is **not** passed through to any VM. The NVIDIA driver lives on the Proxmox host and is shared into the containers that need it (Frigate detection, Ollama, faster-whisper). Do not VFIO the GPU — only the HBA gets VFIO'd. Mixing these two up is the easy mistake in this build.

### Seat the 9300-8i HBA in the bottom slot
1. Install the LSI/Broadcom 9300-8i (already flashed to IT mode, Initiator-Target mode) in the **bottom x4 slot** (`PCIEX4_3`).
2. This slot is **chipset-attached**, which is exactly what produces a clean IOMMU group for passthrough — the CPU-attached upper slots tend to share groups with other devices.
3. Connect **one SFF-8643-to-4× SATA forward breakout cable** from one of the HBA's two internal SAS (Serial Attached SCSI) ports to the two mirror IronWolfs — two of its four tails are used; the other two stay spare for growing the pool later.

### Wire the power and data
With both cards seated, run every cable. The rule of thumb: **power comes from the PSU, data comes from the board — except the two mirror disks, whose data comes from the HBA.**

<svg viewBox="0 0 680 536" role="img" aria-label="Cabling map — power leads from the PSU and data leads from the board and HBA" style="width:100%;height:auto;max-width:680px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="678" height="534" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="27" style="fill:currentColor;font-size:14px;font-weight:600">Cabling — every lead from the PSU, board, and HBA</text>
<text x="20" y="52" style="fill:currentColor;font-size:12px;font-weight:600">① Power — from the Toughpower 850W PSU</text>
<rect x="24" y="62" width="120" height="128" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="84" y="122" text-anchor="middle" style="fill:currentColor">Toughpower</text>
<text x="84" y="140" text-anchor="middle" style="fill:currentColor">850W RGB PSU</text>
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
<text x="94" y="290" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">2× SFF-8643 ports · 1 used</text>
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
<line x1="164" y1="464" x2="470" y2="471" stroke-dasharray="4 3" style="stroke:#10b981;stroke-width:2"/>
<rect x="470" y="374" width="188" height="32" rx="4" style="fill:#f59e0b;fill-opacity:0.18;stroke:#f59e0b"/>
<text x="564" y="394" text-anchor="middle" style="fill:currentColor">IronWolf #3 — footage</text>
<rect x="470" y="416" width="188" height="30" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="564" y="435" text-anchor="middle" style="fill:currentColor">500 GB NVMe</text>
<rect x="470" y="456" width="188" height="30" rx="4" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="564" y="475" text-anchor="middle" style="fill:currentColor">ZBT-2 (later)</text>
<rect x="22" y="512" width="14" height="11" rx="2" style="fill:#f43f5e"/>
<text x="42" y="521" style="fill:var(--color-ink-soft);font-size:10.5px">PSU power</text>
<rect x="150" y="512" width="14" height="11" rx="2" style="fill:#6366f1"/>
<text x="170" y="521" style="fill:var(--color-ink-soft);font-size:10.5px">HBA → mirror (SAS)</text>
<rect x="330" y="512" width="14" height="11" rx="2" style="fill:#10b981"/>
<text x="350" y="521" style="fill:var(--color-ink-soft);font-size:10.5px">motherboard data (SATA / M.2 / USB)</text>
</svg>

The footage drive and the NVMe both ride the board; only the two mirror disks hang off the HBA. The ZBT-2 is the one thing you leave unplugged for now — it goes into a USB port once Proxmox is up.

And here is the power side alone, end to end — every cable the Toughpower Grand RGB 850W actually runs in this build, by its port and connector names, daisy chains included:

<svg viewBox="0 0 700 850" role="img" aria-label="Complete PSU cable map for the Thermaltake Toughpower Grand RGB 850W in this build: every port, cable, connector, and daisy chain, end to end" style="width:100%;height:auto;max-width:700px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="698" height="848" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="28" style="fill:currentColor;font-size:14px;font-weight:600">PSU cabling — Toughpower Grand RGB 850W, end to end</text>
<text x="20" y="46" style="fill:var(--color-ink-soft);font-size:10px">Fully modular — 4 cables power the whole build. Solid sockets are used; hollow stay empty.</text>
<rect x="24" y="64" width="100" height="44" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="74" y="90" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">AC wall</text>
<line x1="124" y1="86" x2="158" y2="86" style="stroke:#f43f5e;stroke-width:2.5"/>
<rect x="158" y="64" width="230" height="44" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="273" y="83" text-anchor="middle" style="fill:currentColor;font-size:10.5px">CyberPower CP1500PFCLCD</text>
<text x="273" y="98" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">battery-side outlet</text>
<polyline points="388,86 420,86 420,140 170,140 170,168" style="fill:none;stroke:#f43f5e;stroke-width:2.5"/>
<text x="430" y="120" style="fill:#f43f5e;font-size:9.5px">C13 kettle cord → PSU inlet (rocker ON)</text>
<rect x="24" y="168" width="280" height="470" rx="10" style="fill:var(--color-surface-2);stroke:var(--color-line-strong);stroke-width:1.6"/>
<text x="164" y="192" text-anchor="middle" style="fill:currentColor;font-size:11.5px;font-weight:600">Toughpower Grand RGB 850W</text>
<text x="164" y="207" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">fully modular — every cable detaches</text>
<text x="40" y="232" style="fill:var(--color-ink-soft);font-size:9.5px;font-weight:600">MODULAR PANEL (as printed):</text>
<rect x="40" y="242" width="76" height="20" rx="3" style="fill:currentColor;fill-opacity:0.14;stroke:currentColor"/>
<text x="78" y="256" text-anchor="middle" style="fill:currentColor;font-size:9px">M/B</text>
<text x="126" y="256" style="fill:var(--color-ink-soft);font-size:9px">→ 24-pin cable (18+10 at this end)</text>
<rect x="40" y="276" width="76" height="20" rx="3" style="fill:#f43f5e;fill-opacity:0.18;stroke:#f43f5e"/>
<text x="78" y="290" text-anchor="middle" style="fill:currentColor;font-size:8.5px">CPU &amp; PCI-E 1</text>
<text x="126" y="290" style="fill:var(--color-ink-soft);font-size:9px">→ CPU cable (used)</text>
<rect x="40" y="304" width="76" height="20" rx="3" style="fill:#10b981;fill-opacity:0.18;stroke:#10b981"/>
<text x="78" y="318" text-anchor="middle" style="fill:currentColor;font-size:8.5px">CPU &amp; PCI-E 2</text>
<text x="126" y="318" style="fill:var(--color-ink-soft);font-size:9px">→ PCIe cable A (used)</text>
<rect x="40" y="332" width="76" height="20" rx="3" style="fill:#8b5cf6;fill-opacity:0.18;stroke:#8b5cf6"/>
<text x="78" y="346" text-anchor="middle" style="fill:currentColor;font-size:8.5px">CPU &amp; PCI-E 3</text>
<text x="126" y="346" style="fill:var(--color-ink-soft);font-size:9px">→ PCIe cable B (used)</text>
<rect x="40" y="360" width="76" height="20" rx="3" style="fill:none;stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="78" y="374" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8.5px">CPU &amp; PCI-E 4</text>
<text x="126" y="374" style="fill:var(--color-ink-faint);font-size:9px">empty</text>
<rect x="40" y="396" width="76" height="20" rx="3" style="fill:#f59e0b;fill-opacity:0.2;stroke:#f59e0b"/>
<text x="78" y="410" text-anchor="middle" style="fill:currentColor;font-size:8.5px">SATA &amp; PERIF 1</text>
<text x="126" y="410" style="fill:var(--color-ink-soft);font-size:9px">→ SATA chain (used)</text>
<rect x="40" y="424" width="76" height="20" rx="3" style="fill:none;stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="78" y="438" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8.5px">SATA &amp; PERIF 2</text>
<rect x="40" y="452" width="76" height="20" rx="3" style="fill:none;stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="78" y="466" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8.5px">SATA &amp; PERIF 3</text>
<text x="126" y="452" style="fill:var(--color-ink-faint);font-size:9px">empty</text>
<text x="40" y="498" style="fill:var(--color-ink-soft);font-size:9px">Any CPU &amp; PCI-E socket accepts either cable —</text>
<text x="40" y="511" style="fill:var(--color-ink-soft);font-size:9px">the cable&apos;s device end decides what it is.</text>
<text x="40" y="534" style="fill:var(--color-ink-soft);font-size:9px">In the box, unused: PCIe cable C (two 6+2), two</text>
<text x="40" y="547" style="fill:var(--color-ink-soft);font-size:9px">more SATA chains, Molex chain (+FDD adapter).</text>
<text x="40" y="566" style="fill:var(--color-ink-faint);font-size:8.5px">No spare CPU cable — its 2nd plug rides the same lead (below).</text>
<text x="40" y="590" style="fill:var(--color-ink-soft);font-size:9px">RGB: the fan ring&apos;s button sits by the AC inlet —</text>
<text x="40" y="603" style="fill:var(--color-ink-soft);font-size:9px">cycle it to a color or off once; it remembers.</text>
<line x1="288" y1="252" x2="430" y2="252" style="stroke:currentColor;stroke-width:3"/>
<text x="352" y="244" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">24-pin</text>
<polyline points="116,286 330,286 330,190 430,190" style="fill:none;stroke:#f43f5e;stroke-width:2.2"/>
<text x="352" y="182" text-anchor="middle" style="fill:#f43f5e;font-size:9px">CPU cable — 4+4 plug in, both halves</text>
<polyline points="116,314 356,314 356,318 430,318" style="fill:none;stroke:#10b981;stroke-width:2.2"/>
<polyline points="116,342 344,342 344,352 430,352" style="fill:none;stroke:#8b5cf6;stroke-width:2.2"/>
<polyline points="116,406 400,406 400,762 430,762" style="fill:none;stroke:#f59e0b;stroke-width:2.2"/>
<polyline points="400,700 430,700" style="fill:none;stroke:#f59e0b;stroke-width:2.2"/>
<polyline points="400,638 430,638" style="fill:none;stroke:#f59e0b;stroke-width:2.2"/>
<rect x="430" y="152" width="250" height="118" rx="8" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="555" y="174" text-anchor="middle" style="fill:currentColor;font-weight:600">ASUS Maximus X Hero</text>
<circle cx="444" cy="190" r="5" style="fill:#f43f5e"/>
<text x="456" y="194" style="fill:currentColor;font-size:9.5px">EATX12V — 8-pin CPU, top-left corner</text>
<text x="456" y="208" style="fill:var(--color-ink-soft);font-size:8.5px">(the cable&apos;s straight-8-pin twin plug: parked, tied back)</text>
<circle cx="444" cy="252" r="5" style="fill:currentColor"/>
<text x="456" y="256" style="fill:currentColor;font-size:9.5px">EATXPWR — 24-pin, right edge</text>
<text x="456" y="240" style="fill:var(--color-ink-faint);font-size:8.5px">(fans, NVMe, ZBT-2, HBA: no PSU leads — board/slot/USB)</text>
<rect x="430" y="292" width="250" height="128" rx="8" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="555" y="312" text-anchor="middle" style="fill:currentColor;font-weight:600">EVGA 1080 Ti FTW3</text>
<circle cx="444" cy="318" r="5" style="fill:#10b981"/>
<text x="456" y="322" style="fill:currentColor;font-size:9.5px">PCIe 8-pin plug 1 ← cable A, 1st connector</text>
<circle cx="444" cy="352" r="5" style="fill:#8b5cf6"/>
<text x="456" y="356" style="fill:currentColor;font-size:9.5px">PCIe 8-pin plug 2 ← cable B, 1st connector</text>
<text x="456" y="380" style="fill:var(--color-ink-soft);font-size:9px">each cable&apos;s 2nd (6+2 pigtail) connector: ✕ unplugged,</text>
<text x="456" y="393" style="fill:var(--color-ink-soft);font-size:9px">zip-tied back — one cable per plug on a 250 W card</text>
<text x="456" y="409" style="fill:var(--color-ink-faint);font-size:8.5px">slot supplies the rest (75 W) through PCIEX16_1</text>
<rect x="430" y="440" width="250" height="42" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="446" y="458" style="fill:currentColor;font-size:10px;font-weight:600">SATA chain — one lead, plugs ①②③</text>
<text x="446" y="472" style="fill:var(--color-ink-soft);font-size:9px">routes up the back, feeding plates bottom → top</text>
<rect x="430" y="614" width="250" height="48" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="560" y="634" text-anchor="middle" style="fill:currentColor;font-size:10px">IronWolf — TOP plate</text>
<text x="560" y="650" text-anchor="middle" style="fill:#f59e0b;font-size:9px">③ last plug on the chain</text>
<rect x="430" y="676" width="250" height="48" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="560" y="696" text-anchor="middle" style="fill:currentColor;font-size:10px">IronWolf — MIDDLE plate</text>
<text x="560" y="712" text-anchor="middle" style="fill:#f59e0b;font-size:9px">② middle plug</text>
<rect x="430" y="738" width="250" height="48" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="560" y="758" text-anchor="middle" style="fill:currentColor;font-size:10px">IronWolf — BOTTOM plate</text>
<text x="560" y="774" text-anchor="middle" style="fill:#f59e0b;font-size:9px">① first plug from the PSU</text>
<text x="24" y="668" style="fill:currentColor;font-size:10px;font-weight:600">Reading the chains</text>
<text x="24" y="686" style="fill:var(--color-ink-soft);font-size:9.5px">• The CPU cable is itself a chain: a 4+4 plug AND a</text>
<text x="24" y="699" style="fill:var(--color-ink-soft);font-size:9.5px">   straight 8-pin on one lead — this board takes the 4+4,</text>
<text x="24" y="712" style="fill:var(--color-ink-soft);font-size:9.5px">   the twin stays parked</text>
<text x="24" y="729" style="fill:var(--color-ink-soft);font-size:9.5px">• PCIe cables A and B each carry two 6+2 — pigtails unused</text>
<text x="24" y="746" style="fill:var(--color-ink-soft);font-size:9.5px">• The SATA lead is the drive chain: three plugs in series</text>
<text x="24" y="759" style="fill:var(--color-ink-soft);font-size:9.5px">   feed all three drives (a 4th plug, if present, tucks spare)</text>
<text x="24" y="776" style="fill:var(--color-ink-soft);font-size:9.5px">• SATA power plugs are L-keyed — never force one upside-down</text>
<text x="24" y="806" style="fill:var(--color-ink-faint);font-size:9px">Data cables are separate and board-side: 1 SATA data lead, board → footage drive</text>
<text x="24" y="819" style="fill:var(--color-ink-faint);font-size:9px">(the two mirror drives&apos; data comes from the HBA breakout, not the PSU or board).</text>
</svg>

*Total pull on this PSU is modest — roughly 300–400 W at full tilt against 850 W available — so every rail is loafing. Two rules that matter: two separate PCIe cables for the GPU&apos;s two plugs, pigtails parked — and because this unit is fully modular, only Thermaltake&apos;s own cables go into it (modular pinouts differ between brands; another brand&apos;s cable in these sockets can fry drives). If a drive ever loses power, the chain order above tells you which plug to wiggle first.

## Set the ASUS Maximus X Hero BIOS

Enter the BIOS by tapping `Del` repeatedly the moment the screen lights up on power-on. Work through these in order — the toggles live in different submenus, so do not stop after the first one.

### Update the BIOS first
Flash the latest Maximus X Hero firmware before touching any toggle, so the settings below sit on current microcode. This needs its own USB stick — it is **not** the Proxmox installer stick you made during the Start Here prep.

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
