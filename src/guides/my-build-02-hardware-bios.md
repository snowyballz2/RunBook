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

## The board and its connections

Two cards matter, and they have two different jobs. The GPU needs full bandwidth and stays on the host. The HBA needs to land in a **clean IOMMU (Input/Output Memory Management Unit) group** so it can be handed whole to the TrueNAS VM by VFIO (Virtual Function I/O) without dragging neighbouring devices along.

<svg viewBox="0 0 700 762" role="img" aria-label="ASUS Maximus X Hero board map traced from the manual, with every connector this build uses numbered including the front-panel case headers" style="width:100%;height:auto;max-width:700px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="698" height="760" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="26" style="fill:currentColor;font-size:14px;font-weight:600">Maximus X Hero — every connection this build uses</text>
<text x="20" y="44" style="fill:var(--color-ink-soft);font-size:10px">Positions match the manual&apos;s layout drawing. Numbered = wired in this build; dashed = present but stays empty.</text>
<rect x="24" y="56" width="652" height="456" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<rect x="34" y="100" width="40" height="230" rx="4" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text transform="rotate(-90 54 215)" x="54" y="215" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">REAR  I/O</text>
<rect x="38" y="252" width="32" height="22" rx="3" style="fill:var(--color-surface-2);stroke:currentColor"/>
<circle cx="54" cy="263" r="8" style="fill:currentColor"/>
<text x="54" y="267" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">11</text>
<rect x="120" y="70" width="76" height="24" rx="3" style="fill:#f43f5e;fill-opacity:0.2;stroke:#f43f5e"/>
<circle cx="134" cy="82" r="8" style="fill:currentColor"/>
<text x="134" y="86" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">3</text>
<text x="158" y="108" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">EATX12V</text>
<rect x="290" y="72" width="44" height="18" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<rect x="340" y="72" width="42" height="18" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="388" y="72" width="42" height="18" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="352" cy="81" r="8" style="fill:currentColor"/>
<text x="352" y="85" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">9</text>
<text x="360" y="104" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">AIO_PUMP · CPU_OPT · CPU_FAN</text>
<rect x="598" y="68" width="62" height="26" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="629" y="85" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:9px">Q-Code</text>
<rect x="160" y="126" width="110" height="94" rx="6" style="fill:var(--color-surface);stroke:currentColor;stroke-width:1.5"/>
<circle cx="173" cy="139" r="8" style="fill:currentColor"/>
<text x="173" y="143" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">1</text>
<text x="215" y="174" text-anchor="middle" style="fill:currentColor;font-size:10px;font-weight:600">LGA1151</text>
<text x="215" y="190" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">i7-8700K</text>
<rect x="430" y="116" width="14" height="146" rx="2" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<rect x="450" y="116" width="14" height="146" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="470" y="116" width="14" height="146" rx="2" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<rect x="490" y="116" width="14" height="146" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="442" cy="128" r="8" style="fill:currentColor"/>
<text x="442" y="132" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">2</text>
<text x="467" y="278" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">DDR4 ×4 · 32 GB</text>
<rect x="606" y="104" width="50" height="110" rx="3" style="fill:#f43f5e;fill-opacity:0.2;stroke:#f43f5e"/>
<circle cx="620" cy="118" r="8" style="fill:currentColor"/>
<text x="620" y="122" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">4</text>
<text x="631" y="228" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">EATXPWR 24-pin</text>
<rect x="610" y="240" width="46" height="13" rx="2" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="602" y="250" text-anchor="end" style="fill:var(--color-ink-faint);font-size:8px">U31G2_E3</text>
<rect x="610" y="262" width="46" height="14" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<text x="602" y="273" text-anchor="end" style="fill:var(--color-ink-faint);font-size:8px">H_AMP</text>
<rect x="300" y="284" width="116" height="16" rx="3" style="fill:#f59e0b;fill-opacity:0.2;stroke:#f59e0b"/>
<circle cx="312" cy="292" r="8" style="fill:currentColor"/>
<text x="312" y="296" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">7</text>
<text x="372" y="296" text-anchor="middle" style="fill:currentColor;font-size:9px">M.2_1</text>
<rect x="86" y="310" width="86" height="13" rx="2" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="129" y="306" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">PCIEX1_1</text>
<rect x="86" y="328" width="330" height="20" rx="3" style="fill:#10b981;fill-opacity:0.16;stroke:#10b981"/>
<circle cx="99" cy="338" r="8" style="fill:currentColor"/>
<text x="99" y="342" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">5</text>
<text x="252" y="342" text-anchor="middle" style="fill:currentColor;font-size:9.5px">PCIEX16_1 · x16</text>
<rect x="86" y="356" width="86" height="13" rx="2" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="129" y="366" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">PCIEX1_2</text>
<rect x="86" y="374" width="330" height="20" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:4 3"/>
<text x="252" y="388" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:9px">PCIEX8_2 · x8 — empty</text>
<rect x="86" y="402" width="86" height="13" rx="2" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="129" y="412" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">PCIEX1_3</text>
<rect x="86" y="420" width="250" height="20" rx="3" style="fill:#6366f1;fill-opacity:0.18;stroke:#6366f1"/>
<circle cx="99" cy="430" r="8" style="fill:currentColor"/>
<text x="99" y="434" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">6</text>
<text x="220" y="434" text-anchor="middle" style="fill:currentColor;font-size:9.5px">PCIEX4_3 · x4 · chipset</text>
<rect x="440" y="316" width="66" height="60" rx="4" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="473" y="350" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Z370</text>
<rect x="560" y="288" width="94" height="78" rx="4" style="fill:#f59e0b;fill-opacity:0.12;stroke:#f59e0b"/>
<circle cx="576" cy="304" r="8" style="fill:currentColor"/>
<text x="576" y="308" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">8</text>
<rect x="596" y="298" width="24" height="13" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="624" y="298" width="24" height="13" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="596" y="317" width="24" height="13" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="624" y="317" width="24" height="13" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="596" y="336" width="24" height="13" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<rect x="624" y="336" width="24" height="13" rx="2" style="fill:var(--color-surface);stroke:currentColor"/>
<text x="607" y="360" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9px">SATA6G 1-6</text>
<rect x="610" y="378" width="46" height="15" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<text x="602" y="389" text-anchor="end" style="fill:var(--color-ink-faint);font-size:8px">CHA_FAN2</text>
<rect x="604" y="402" width="52" height="14" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="598" y="412" text-anchor="end" style="fill:var(--color-ink-faint);font-size:8px">W_PUMP+ / flow</text>
<rect x="40" y="352" width="38" height="16" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="52" cy="360" r="8" style="fill:currentColor"/>
<text x="52" y="364" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">10</text>
<text x="59" y="380" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">CHA_FAN1</text>
<rect x="340" y="440" width="120" height="15" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:4 3"/>
<text x="400" y="436" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:9px">M.2_2 — empty</text>
<rect x="476" y="440" width="54" height="15" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="503" y="436" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">EXT_FAN</text>
<rect x="40" y="470" width="48" height="22" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="54" cy="481" r="8" style="fill:currentColor"/>
<text x="54" y="485" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">15</text>
<text x="64" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">AAFP</text>
<rect x="94" y="470" width="150" height="22" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:4 3"/>
<text x="169" y="484" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">ADD_HDR · START · RESET · TPM</text>
<rect x="252" y="470" width="60" height="22" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="266" cy="481" r="8" style="fill:currentColor"/>
<text x="266" y="485" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">13</text>
<text x="286" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">U31G1_12</text>
<rect x="318" y="470" width="54" height="22" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="332" cy="481" r="8" style="fill:currentColor"/>
<text x="332" y="485" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">14</text>
<text x="348" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">USB910</text>
<rect x="378" y="470" width="50" height="22" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="403" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">USB1112</text>
<rect x="434" y="470" width="48" height="22" rx="3" style="fill:var(--color-surface);stroke:currentColor"/>
<text x="458" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">CHA_FAN3</text>
<rect x="488" y="470" width="44" height="22" rx="3" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:3 2"/>
<text x="510" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">SPEAKER</text>
<rect x="576" y="470" width="80" height="22" rx="3" style="fill:var(--color-surface);stroke:currentColor;stroke-width:1.4"/>
<circle cx="590" cy="481" r="8" style="fill:currentColor"/>
<text x="590" y="485" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">12</text>
<text x="616" y="504" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:8px">F_PANEL</text>
<text x="20" y="534" style="fill:currentColor;font-size:12px;font-weight:600">What plugs into each numbered point</text>
<circle cx="34" cy="554" r="8" style="fill:currentColor"/>
<text x="34" y="558" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">1</text>
<text x="50" y="558" style="fill:var(--color-ink-soft);font-size:9.5px">LGA1151 → i7-8700K</text>
<circle cx="34" cy="576" r="8" style="fill:currentColor"/>
<text x="34" y="580" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">2</text>
<text x="50" y="580" style="fill:var(--color-ink-soft);font-size:9.5px">DDR4 ×4 → 32 GB (fill A2 &amp; B2 first)</text>
<circle cx="34" cy="598" r="8" style="fill:currentColor"/>
<text x="34" y="602" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">3</text>
<text x="50" y="602" style="fill:var(--color-ink-soft);font-size:9.5px">EATX12V → PSU 4+4 CPU cable</text>
<circle cx="34" cy="620" r="8" style="fill:currentColor"/>
<text x="34" y="624" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">4</text>
<text x="50" y="624" style="fill:var(--color-ink-soft);font-size:9.5px">EATXPWR → PSU 24-pin cable</text>
<circle cx="34" cy="642" r="8" style="fill:currentColor"/>
<text x="34" y="646" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">5</text>
<text x="50" y="646" style="fill:var(--color-ink-soft);font-size:9.5px">PCIEX16_1 (x16) → GTX 1080 Ti FTW3 — stays on host</text>
<circle cx="34" cy="664" r="8" style="fill:currentColor"/>
<text x="34" y="668" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">6</text>
<text x="50" y="668" style="fill:var(--color-ink-soft);font-size:9.5px">PCIEX4_3 (x4, chipset) → 9300-8i HBA — VFIO to TrueNAS</text>
<circle cx="34" cy="686" r="8" style="fill:currentColor"/>
<text x="34" y="690" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">7</text>
<text x="50" y="690" style="fill:var(--color-ink-soft);font-size:9.5px">M.2_1 → 500 GB NVMe (keeps all 6 SATA live)</text>
<circle cx="34" cy="708" r="8" style="fill:currentColor"/>
<text x="34" y="712" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">8</text>
<text x="50" y="712" style="fill:var(--color-ink-soft);font-size:9.5px">SATA6G_1 → footage drive (data)</text>
<circle cx="366" cy="554" r="8" style="fill:currentColor"/>
<text x="366" y="558" text-anchor="middle" style="fill:var(--color-surface);font-size:9px;font-weight:700">9</text>
<text x="382" y="558" style="fill:var(--color-ink-soft);font-size:9.5px">CPU_FAN + CPU_OPT → Phantom Spirit (2 fans)</text>
<circle cx="366" cy="576" r="8" style="fill:currentColor"/>
<text x="366" y="580" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">10</text>
<text x="382" y="580" style="fill:var(--color-ink-soft);font-size:9.5px">CHA_FAN1-3 + H_AMP → 4 Noctua case fans</text>
<circle cx="366" cy="598" r="8" style="fill:currentColor"/>
<text x="366" y="602" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">11</text>
<text x="382" y="602" style="fill:var(--color-ink-soft);font-size:9.5px">Rear USB → HA Connect ZBT-2 (added later)</text>
<circle cx="366" cy="620" r="8" style="fill:currentColor"/>
<text x="366" y="624" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">12</text>
<text x="382" y="624" style="fill:var(--color-ink-soft);font-size:9.5px">F_PANEL (bottom-right corner) → power + reset, LEDs</text>
<circle cx="366" cy="642" r="8" style="fill:currentColor"/>
<text x="366" y="646" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">13</text>
<text x="382" y="646" style="fill:var(--color-ink-soft);font-size:9.5px">U31G1_12 → 2× front USB 3.0 (case I/O)</text>
<circle cx="366" cy="664" r="8" style="fill:currentColor"/>
<text x="366" y="668" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">14</text>
<text x="382" y="668" style="fill:var(--color-ink-soft);font-size:9.5px">USB910 → 2× front USB 2.0 (case I/O)</text>
<circle cx="366" cy="686" r="8" style="fill:currentColor"/>
<text x="366" y="690" text-anchor="middle" style="fill:var(--color-surface);font-size:8px;font-weight:700">15</text>
<text x="382" y="690" style="fill:var(--color-ink-soft);font-size:9.5px">AAFP (bottom-left corner) → front headphone + mic</text>
<text x="20" y="732" style="fill:var(--color-ink-faint);font-size:9px">⑥ chipset slot = clean IOMMU, force x4 in BIOS · ⑦ M.2_1 keeps all six SATA live · mirror drives take data from the HBA, not board SATA.</text>
<text x="20" y="748" style="fill:var(--color-ink-faint);font-size:9px">Dashed = empty: PCIEX8_2, x1 slots, M.2_2, U31G2_E3 (no front USB-C), USB1112, SPEAKER, EXT_FAN, water headers, RGB/OC extras.</text>
</svg>

*This is the whole board, traced from the manual. Two placements decide the build: the **GPU goes in `PCIEX16_1`** (top x16, full bandwidth, stays on the host), and the **HBA goes in `PCIEX4_3`** — the bottom chipset x4 slot, the one that lands in its own clean IOMMU group for passthrough. Force that slot to x4 in the BIOS; it defaults to x2.*

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
<text x="480" y="173" text-anchor="middle" style="fill:currentColor">3× IronWolf — SATA power, 2 cables (spread plates)</text>
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

And here is that panel drawn to match — the sockets are **zoned by function** (PCI-E red, everything else black), two rows, and every cable in this build lands in a labelled zone:

<svg viewBox="0 0 700 452" role="img" aria-label="The Toughpower Grand RGB 850W modular panel traced from the unit: four labelled socket zones over two rows, PCI-E sockets red, numbered where used in this build" style="width:100%;height:auto;max-width:700px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="698" height="450" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="26" style="fill:currentColor;font-size:14px;font-weight:600">PSU modular panel — Toughpower Grand RGB 850W</text>
<text x="20" y="44" style="fill:var(--color-ink-soft);font-size:10px">Traced from the unit. Sockets are zoned by function; PCI-E sockets are red. Numbered = used in this build.</text>
<rect x="24" y="60" width="652" height="156" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="40" y="80" style="fill:var(--color-ink-soft);font-size:9.5px">the panel as it sits — cable side up</text>
<rect x="38" y="92" width="104" height="70" rx="4" style="fill:var(--color-surface);stroke:currentColor"/>
<line x1="38" y1="127" x2="142" y2="127" style="stroke:var(--color-line-strong)"/>
<circle cx="54" cy="108" r="9" style="fill:currentColor"/>
<text x="54" y="112" text-anchor="middle" style="fill:var(--color-surface);font-size:11px;font-weight:700">1</text>
<rect x="150" y="92" width="64" height="30" rx="4" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="164" cy="107" r="9" style="fill:currentColor"/>
<text x="164" y="111" text-anchor="middle" style="fill:var(--color-surface);font-size:11px;font-weight:700">2</text>
<rect x="150" y="132" width="64" height="30" rx="4" style="fill:#f43f5e;fill-opacity:0.2;stroke:#f43f5e"/>
<circle cx="164" cy="147" r="9" style="fill:#f43f5e"/>
<text x="164" y="151" text-anchor="middle" style="fill:var(--color-surface);font-size:11px;font-weight:700">3</text>
<rect x="224" y="92" width="64" height="30" rx="4" style="fill:#f43f5e;fill-opacity:0.2;stroke:#f43f5e"/>
<circle cx="238" cy="107" r="9" style="fill:#f43f5e"/>
<text x="238" y="111" text-anchor="middle" style="fill:var(--color-surface);font-size:11px;font-weight:700">4</text>
<rect x="224" y="132" width="64" height="30" rx="4" style="fill:#f43f5e;fill-opacity:0.2;stroke:#f43f5e"/>
<circle cx="238" cy="147" r="7" style="fill:none;stroke:var(--color-ink-faint);stroke-width:1.4"/>
<rect x="360" y="92" width="64" height="30" rx="4" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="374" cy="107" r="9" style="fill:currentColor"/>
<text x="374" y="111" text-anchor="middle" style="fill:var(--color-surface);font-size:11px;font-weight:700">5</text>
<rect x="360" y="132" width="64" height="30" rx="4" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="374" cy="147" r="7" style="fill:none;stroke:var(--color-ink-faint);stroke-width:1.4"/>
<rect x="434" y="92" width="64" height="30" rx="4" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="448" cy="107" r="9" style="fill:currentColor"/>
<text x="448" y="111" text-anchor="middle" style="fill:var(--color-surface);font-size:11px;font-weight:700">6</text>
<rect x="434" y="132" width="64" height="30" rx="4" style="fill:var(--color-surface);stroke:currentColor"/>
<circle cx="448" cy="147" r="7" style="fill:none;stroke:var(--color-ink-faint);stroke-width:1.4"/>
<text x="90" y="196" text-anchor="middle" style="fill:currentColor;font-size:10px;font-weight:600">24PIN ATX</text>
<text x="182" y="196" text-anchor="middle" style="fill:currentColor;font-size:10px;font-weight:600">4+4 CPU</text>
<text x="252" y="196" text-anchor="middle" style="fill:#f43f5e;font-size:10px;font-weight:600">8+2 PCI-E</text>
<text x="466" y="196" text-anchor="middle" style="fill:currentColor;font-size:10px;font-weight:600">PERIPHERAL &amp; SATA</text>
<text x="20" y="242" style="fill:currentColor;font-size:12px;font-weight:600">Where each cable lands</text>
<circle cx="34" cy="262" r="8" style="fill:currentColor"/>
<text x="34" y="266" text-anchor="middle" style="fill:var(--color-surface);font-size:10px;font-weight:700">1</text>
<text x="50" y="266" style="fill:var(--color-ink-soft);font-size:9.5px">24PIN ATX → board EATXPWR. The 2-part plug merges into one 24-pin at the board.</text>
<circle cx="34" cy="288" r="8" style="fill:currentColor"/>
<text x="34" y="292" text-anchor="middle" style="fill:var(--color-surface);font-size:10px;font-weight:700">2</text>
<text x="50" y="292" style="fill:var(--color-ink-soft);font-size:9.5px">4+4 CPU → board EATX12V (8-pin, top-left). Seat both 4+4 halves; the cable&apos;s straight-8 twin ties back.</text>
<circle cx="34" cy="314" r="8" style="fill:#f43f5e"/>
<text x="34" y="318" text-anchor="middle" style="fill:var(--color-surface);font-size:10px;font-weight:700">3</text>
<text x="50" y="318" style="fill:var(--color-ink-soft);font-size:9.5px">8+2 PCI-E (red) → FTW3 plug 1 — PCIe cable A; its 6+2 pigtail parked.</text>
<circle cx="34" cy="340" r="8" style="fill:#f43f5e"/>
<text x="34" y="344" text-anchor="middle" style="fill:var(--color-surface);font-size:10px;font-weight:700">4</text>
<text x="50" y="344" style="fill:var(--color-ink-soft);font-size:9.5px">8+2 PCI-E (red) → FTW3 plug 2 — PCIe cable B; its 6+2 pigtail parked. (One red socket stays spare.)</text>
<circle cx="34" cy="366" r="8" style="fill:currentColor"/>
<text x="34" y="370" text-anchor="middle" style="fill:var(--color-surface);font-size:10px;font-weight:700">5</text>
<text x="50" y="370" style="fill:var(--color-ink-soft);font-size:9.5px">PERIPHERAL &amp; SATA → SATA cable 1, daisied to the two mirror drives (the two closest plates).</text>
<circle cx="34" cy="392" r="8" style="fill:currentColor"/>
<text x="34" y="396" text-anchor="middle" style="fill:var(--color-surface);font-size:10px;font-weight:700">6</text>
<text x="50" y="396" style="fill:var(--color-ink-soft);font-size:9.5px">PERIPHERAL &amp; SATA → SATA cable 2, to the footage drive (the far plate).</text>
<circle cx="34" cy="420" r="7" style="fill:none;stroke:var(--color-ink-faint);stroke-width:1.4"/>
<text x="50" y="424" style="fill:var(--color-ink-faint);font-size:9.5px">Spare: 1 red PCI-E, 2 PERIPHERAL &amp; SATA — plus a PCIe cable, a SATA cable, and the Molex chain still in the box.</text>
</svg>

*Faithful to your panel photo — the far-left 24-pin was partly hidden behind your thumb, so trust the printed zone labels over my exact socket count there. The rule the layout makes obvious: **the two GPU cables only go in the red 8+2 PCI-E sockets**, and the **two SATA cables go in PERIPHERAL & SATA** (mirror pair on one, footage on the other). Fully modular means only Thermaltake&apos;s own cables fit these pinouts. Total draw is ~300–400 W against 850 W available, so every rail loafs.*

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
