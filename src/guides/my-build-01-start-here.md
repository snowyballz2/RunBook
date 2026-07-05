---
title: Start Here
subtitle: What this build is, how it fits together, and the order to do it in
collection: My Build
order: 1
accent: amber
---

This collection is a complete, hands-on build of one all-in-one home server: a single full-tower PC that runs the smart home, the cameras, the file storage, and a handful of self-hosted services — all locally, all on hardware you own. Each page is a self-contained how-to for one stage of the build. Work through them top to bottom, in order, and at the end you have a quiet box in the basement running the whole house.

This first page is the map. Read it, gather the parts, set the server's address, then start building.

## The design

### Know what you are building
One physical computer hosts everything. **Proxmox VE** (Proxmox Virtual Environment, a free virtualization platform) runs directly on the bare metal, and every service lives on top of it as either a virtual machine or a lightweight container:

- **Home Assistant OS** runs in its own **VM** (virtual machine) — the brain of the house. It talks to Zigbee, Matter, Lutron, the thermostats, and the cameras, and runs every automation.
- **TrueNAS** runs in a second **VM** and owns the bulk storage. Its disk controller is handed to it whole, so the **ZFS** (Zettabyte File System, a storage system with built-in data integrity) sees real, raw drives.
- **Frigate** (a local camera recorder with object detection) and the supporting services each run as a fast, low-overhead **LXC** (Linux Containers): Frigate, AdGuard, Nextcloud, Vaultwarden, Homepage, Nginx Proxy Manager, and Uptime Kuma (plus two voice containers, Ollama and faster-whisper, added near the end of the build).

### Keep the two cards straight
The single most important design decision — and the one that trips people up — is how the two add-in cards are treated. They go opposite ways:

> [!WARNING]
> **The GTX 1080 Ti graphics card stays on the host and is _shared_ into containers. The disk controller is _passed through whole_ to one VM.** Never swap these. Getting it backwards breaks GPU sharing or breaks the storage.

- **The GTX 1080 Ti is shared, not passed through.** The NVIDIA driver lives on the Proxmox host, and the host lends the one card into the LXCs that need it — Frigate detection, the Ollama **LLM** (large language model) runner, and faster-whisper speech-to-text — all at the same time. The Home Assistant VM reaches those services over the **LAN** (local area network). The card is deliberately *not* given to any single guest with **VFIO** (Virtual Function I/O, the kernel feature that hands a whole device to one VM).
- **The LSI 9300-8i HBA _is_ passed through.** This **HBA** (host bus adapter, the card the data disks plug into) gets VFIO'd in its entirety to the TrueNAS VM, so ZFS manages the raw disks directly with full health reporting and no risk of silent corruption.

### Remember the start order
One dependency underpins every reboot of this build:

> [!NOTE]
> **Start the Home Assistant VM before the Frigate container.** Frigate publishes to the **MQTT** (Message Queuing Telemetry Transport, a lightweight messaging broker) service that lives with Home Assistant, so the broker has to exist first. You set this start order explicitly once the Home Assistant VM exists — on the Home Assistant & Zigbee2MQTT page, with the Frigate side set on the Cameras, Doorbell & Frigate page — so it survives every reboot.

### Understand the disk layout
Three different jobs, three different homes:

- The **500 GB NVMe** (Non-Volatile Memory Express, a fast solid-state drive) holds the Proxmox OS and the Frigate cache.
- **Two of the three IronWolf hard drives** become the TrueNAS **ZFS mirror** — your real, redundant file storage. These two hang off the passed-through HBA.
- **The third IronWolf** is the Frigate footage drive. It does *not* go on the HBA; it plugs into a **SATA** (Serial Advanced Technology Attachment, the common drive interface) port on the motherboard, because the host and Frigate need direct access to it.

All three hard drives mount in the fixed rear drive trays of the case, behind the motherboard tray — the removable front pods are not needed.

### See how everything gets power and network
One map for the whole build: every physical device, how it is powered, and which link it talks over. The line colors are the link types; the small rose tag inside each box is that device's power source. (The wiring *inside* the server case has its own diagrams on the Hardware & BIOS page.)

<svg viewBox="0 0 720 1110" role="img" aria-label="Power and network map of every physical device in the build" style="width:100%;height:auto;max-width:720px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="718" height="1108" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
<text x="20" y="28" style="fill:currentColor;font-size:14px;font-weight:600">Power &amp; network — every physical device</text>
<line x1="20" y1="58" x2="48" y2="58" style="stroke:#10b981;stroke-width:2.5"/>
<text x="54" y="62" style="fill:var(--color-ink-soft);font-size:10px">Ethernet</text>
<line x1="122" y1="58" x2="150" y2="58" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<text x="156" y="62" style="fill:var(--color-ink-soft);font-size:10px">Wi-Fi</text>
<line x1="204" y1="58" x2="232" y2="58" style="stroke:#f59e0b;stroke-width:2"/>
<text x="238" y="62" style="fill:var(--color-ink-soft);font-size:10px">USB</text>
<line x1="282" y1="58" x2="310" y2="58" style="stroke:#f43f5e;stroke-width:2.5"/>
<text x="316" y="62" style="fill:var(--color-ink-soft);font-size:10px">AC power</text>
<line x1="382" y1="58" x2="410" y2="58" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<text x="416" y="62" style="fill:var(--color-ink-soft);font-size:10px">Zigbee</text>
<line x1="470" y1="58" x2="498" y2="58" style="stroke:#d946ef;stroke-width:2;stroke-dasharray:2 3"/>
<text x="504" y="62" style="fill:var(--color-ink-soft);font-size:10px">Thread</text>
<line x1="556" y1="58" x2="584" y2="58" style="stroke:var(--color-ink-faint);stroke-width:1.5;stroke-dasharray:5 3"/>
<text x="590" y="62" style="fill:var(--color-ink-soft);font-size:10px">Lutron RF</text>
<rect x="20" y="72" width="46" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="26" y="82" style="fill:#f43f5e;font-size:9.5px">AC wall</text>
<text x="74" y="82" style="fill:var(--color-ink-soft);font-size:10px">= the rose tag in each box is that device's power source</text>
<rect x="16" y="104" width="134" height="44" rx="6" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="83" y="131" text-anchor="middle" style="fill:var(--color-ink-soft)">Internet (ISP)</text>
<line x1="83" y1="148" x2="83" y2="178" style="stroke:var(--color-ink-faint);stroke-width:1.5"/>
<rect x="16" y="178" width="134" height="72" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="83" y="199" text-anchor="middle" style="fill:currentColor;font-weight:600">Wi-Fi router</text>
<text x="83" y="214" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">192.168.1.1</text>
<rect x="53" y="224" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="83" y="234" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall</text>
<rect x="196" y="178" width="224" height="72" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="308" y="199" text-anchor="middle" style="fill:currentColor;font-weight:600">Netgear GS308EPP switch</text>
<text x="308" y="214" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">PoE+ ports ready for future wired cams</text>
<rect x="266" y="224" width="84" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="308" y="234" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">UPS battery</text>
<line x1="150" y1="214" x2="196" y2="214" style="stroke:#10b981;stroke-width:2.5"/>
<rect x="460" y="104" width="244" height="260" rx="8" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="582" y="128" text-anchor="middle" style="fill:currentColor;font-size:12px;font-weight:600">The server — Proxmox host</text>
<text x="582" y="146" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">ASUS Maximus X Hero · i7-8700K · 32 GB</text>
<text x="582" y="161" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">GTX 1080 Ti · 9300-8i HBA · NVMe</text>
<text x="582" y="176" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">3× IronWolf 4 TB</text>
<text x="582" y="193" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:9.5px">(inside wiring: the Hardware &amp; BIOS page)</text>
<text x="582" y="214" text-anchor="middle" style="fill:currentColor;font-size:10.5px">192.168.1.50</text>
<rect x="497" y="226" width="170" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="582" y="236" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">UPS battery — EVGA 850 W PSU</text>
<line x1="420" y1="214" x2="460" y2="214" style="stroke:#10b981;stroke-width:2.5"/>
<text x="440" y="207" text-anchor="middle" style="fill:#10b981;font-size:9px">LAN</text>
<rect x="196" y="290" width="224" height="96" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="308" y="312" text-anchor="middle" style="fill:currentColor;font-weight:600">CyberPower CP1500PFCLCD</text>
<text x="308" y="328" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">UPS — battery outlets feed the</text>
<text x="308" y="342" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">server and the switch</text>
<rect x="266" y="354" width="84" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="308" y="364" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall in</text>
<line x1="330" y1="290" x2="330" y2="250" style="stroke:#f43f5e;stroke-width:2.5"/>
<line x1="420" y1="320" x2="460" y2="320" style="stroke:#f43f5e;stroke-width:2.5"/>
<text x="440" y="313" text-anchor="middle" style="fill:#f43f5e;font-size:9px">AC</text>
<line x1="420" y1="352" x2="460" y2="352" style="stroke:#f59e0b;stroke-width:2"/>
<text x="440" y="345" text-anchor="middle" style="fill:#f59e0b;font-size:9px">NUT</text>
<rect x="460" y="384" width="244" height="46" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="582" y="403" text-anchor="middle" style="fill:currentColor;font-size:10.5px">ZBT-2 Zigbee coordinator</text>
<text x="582" y="418" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">on a short USB extension off the server</text>
<line x1="582" y1="364" x2="582" y2="384" style="stroke:#f59e0b;stroke-width:2"/>
<line x1="30" y1="250" x2="30" y2="450" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="16" y1="450" x2="704" y2="450" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<text x="360" y="443" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">Wi-Fi — 2.4/5 GHz, everything wireless lives on the router</text>
<line x1="460" y1="407" x2="42" y2="407" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="42" y1="407" x2="42" y2="720" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<rect x="56" y="470" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="131" y="490" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Reolink doorbell</text>
<text x="131" y="504" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">192.168.1.70</text>
<rect x="66" y="514" width="130" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="131" y="524" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">doorbell transformer</text>
<line x1="131" y1="450" x2="131" y2="470" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<rect x="222" y="470" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="297" y="490" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Reolink RLC-510WA</text>
<text x="297" y="504" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">192.168.1.71</text>
<rect x="242" y="514" width="110" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="297" y="524" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">12 V DC adapter</text>
<line x1="297" y1="450" x2="297" y2="470" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<rect x="388" y="470" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="463" y="490" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">2× ecobee thermostats</text>
<text x="463" y="504" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">cloud integration</text>
<rect x="398" y="514" width="130" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="463" y="524" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">HVAC 24 VAC (C-wire)</text>
<line x1="463" y1="450" x2="463" y2="470" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<rect x="554" y="470" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="629" y="490" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Samsung Family Hub</text>
<text x="629" y="504" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">fridge</text>
<rect x="599" y="514" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="629" y="524" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall</text>
<line x1="629" y1="450" x2="629" y2="470" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="214" y1="450" x2="214" y2="604" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="214" y1="604" x2="206" y2="604" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="214" y1="604" x2="222" y2="604" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="380" y1="450" x2="380" y2="590" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="380" y1="590" x2="388" y2="590" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<rect x="56" y="575" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="131" y="595" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">HomePod mini</text>
<text x="131" y="609" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Apple hub · Thread border router</text>
<rect x="101" y="619" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="131" y="629" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall</text>
<rect x="222" y="575" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="297" y="595" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Google/Nest speakers</text>
<text x="297" y="609" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Cast announce targets</text>
<rect x="267" y="619" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="297" y="629" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall</text>
<rect x="388" y="575" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="463" y="595" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Voice Preview Edition</text>
<text x="463" y="609" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Assist voice satellite</text>
<rect x="418" y="619" width="90" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="463" y="629" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">USB-C 5 V / 2 A</text>
<rect x="554" y="575" width="150" height="76" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong);stroke-dasharray:4 3"/>
<text x="629" y="595" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Powered speaker</text>
<text x="629" y="609" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">optional · 3.5 mm aux</text>
<rect x="584" y="619" width="90" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="629" y="629" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall / USB</text>
<line x1="538" y1="620" x2="554" y2="620" style="stroke:var(--color-ink-faint);stroke-width:1.5"/>
<line x1="131" y1="651" x2="131" y2="706" style="stroke:#d946ef;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="131" y1="706" x2="540" y2="706" style="stroke:#d946ef;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="540" y1="706" x2="540" y2="720" style="stroke:#d946ef;stroke-width:2;stroke-dasharray:2 3"/>
<rect x="16" y="720" width="330" height="270" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="181" y="742" text-anchor="middle" style="fill:currentColor;font-size:11.5px;font-weight:600">Zigbee mesh — Zigbee2MQTT</text>
<text x="181" y="758" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">coordinator: the ZBT-2 on the server (above)</text>
<rect x="32" y="772" width="298" height="54" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="181" y="792" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Third Reality smart plugs — mesh routers</text>
<rect x="131" y="802" width="100" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="181" y="812" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall outlets</text>
<rect x="32" y="846" width="298" height="54" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="181" y="866" text-anchor="middle" style="fill:currentColor;font-size:10.5px">12× Third Reality leak sensors</text>
<rect x="151" y="876" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="181" y="886" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">battery</text>
<rect x="32" y="920" width="298" height="56" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="181" y="939" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Aqara Valve Controller T1</text>
<text x="181" y="952" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">on the main water shutoff lever</text>
<rect x="151" y="957" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="181" y="967" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">battery</text>
<line x1="181" y1="762" x2="181" y2="772" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="120" y1="826" x2="120" y2="846" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="330" y1="800" x2="338" y2="800" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="338" y1="800" x2="338" y2="946" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<line x1="338" y1="946" x2="330" y2="946" style="stroke:#06b6d4;stroke-width:2;stroke-dasharray:2 3"/>
<rect x="376" y="720" width="328" height="160" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="540" y="742" text-anchor="middle" style="fill:currentColor;font-size:11.5px;font-weight:600">Thread — Matter</text>
<text x="540" y="758" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">border router: the HomePod mini (left)</text>
<rect x="392" y="772" width="296" height="88" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="540" y="792" text-anchor="middle" style="fill:currentColor;font-size:10.5px">3× Aqara U400 deadbolts</text>
<text x="540" y="807" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Front · Side · Garage</text>
<text x="540" y="821" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Apple Home first → shared to Home Assistant</text>
<rect x="510" y="831" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="540" y="841" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">battery</text>
<rect x="376" y="910" width="328" height="180" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="540" y="932" text-anchor="middle" style="fill:currentColor;font-size:11.5px;font-weight:600">Lutron Clear Connect RF</text>
<rect x="392" y="946" width="296" height="52" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="540" y="963" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Caséta Pro bridge</text>
<text x="540" y="976" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Ethernet — a wired port on the switch · AC wall</text>
<rect x="392" y="1010" width="140" height="66" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="462" y="1030" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Wall dimmers</text>
<rect x="407" y="1040" width="110" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="462" y="1050" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">in-wall house mains</text>
<rect x="548" y="1010" width="140" height="66" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="618" y="1030" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Serena shades</text>
<rect x="588" y="1040" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="618" y="1050" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">battery</text>
<line x1="462" y1="998" x2="462" y2="1010" style="stroke:var(--color-ink-faint);stroke-width:1.5;stroke-dasharray:5 3"/>
<line x1="618" y1="998" x2="618" y2="1010" style="stroke:var(--color-ink-faint);stroke-width:1.5;stroke-dasharray:5 3"/>
</svg>

*Reading it top to bottom: the wall feeds the UPS; the UPS battery side keeps the server and the switch alive through an outage, with a USB lead telling the server when to shut down cleanly. Everything wired rides the switch to the router; everything wireless rides the router's Wi-Fi. Three radio meshes hang off their own hubs — Zigbee off the ZBT-2 on the server, Thread off the HomePod mini, and Lutron's own RF off the Caséta bridge.*

## Get ready

Once Proxmox is installed, the machine you are building becomes a **headless server** and the NVMe that held Windows is erased. From that point on, the server downloads everything itself and you only need a browser to drive it. The steps here all happen first, on a **working computer with a web browser and a USB port** — get them out of the way before the install.

### Gather the parts
Check you have everything before you start — the later pages assume each piece is on hand.

> [!DETAILS] Core PC — board, CPU, power, case
> - **Motherboard:** ASUS ROG Maximus X Hero (Z370)
> - **CPU:** Intel i7-8700K
> - **RAM:** 32 GB
> - **PSU** (power supply unit)**:** EVGA 850W GQ (Gold) — ample for the GPU plus a stack of spinning disks
> - **Case:** Thermaltake View 71 full tower
> - **GPU:** EVGA GTX 1080 Ti FTW3
> - **Cooling refresh (page 3):** Thermalright Phantom Spirit 120 SE air cooler, 4x Noctua NF-P12 redux-1700 PWM case fans (optional fifth for top exhaust), a thermal pad variety kit (0.5/1.0/1.5 mm) and non-conductive paste for the GPU repaste

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

### Get wired Ethernet to the server's final spot
Proxmox cannot use Wi-Fi for its management interface, so the box must be plugged into the router with a cable. If the spot where the quiet box will live is far from the router, get a long Ethernet cable or a powerline adapter (both work) **before** you start — this is the one networking thing you cannot fix from a browser later, and discovering it after the wipe means the server is unreachable.

### Back up everything on the NVMe
The 500 GB NVMe currently has Windows and your files on it, and the Proxmox install **erases the whole drive**. Copy anything you want to keep onto another machine or an external disk first — there is no undo.

> [!WARNING]
> Wiping the NVMe is irreversible. Confirm your files are copied off — and that a few of them actually open from the copy — before you reach the install.

> [!TIP]
> While Windows is still on the machine, you can confirm hardware virtualization is on: press `Ctrl+Shift+Esc` for Task Manager → **Performance → CPU** — the right-hand column should read **Virtualization: Enabled**. (You set the BIOS toggles for this on the Hardware & BIOS page; after the wipe the Proxmox installer also warns loudly if it is missing, so a missed switch surfaces there too.)

> [!DETAILS] What to pull off the NVMe before it is wiped
> Most of what matters lives in a handful of places — work down this list on the Windows machine, then copy it all to an external drive or another PC and spot-check that it opens:
> - **Personal files** — `Documents`, `Desktop`, `Downloads`, `Pictures`, `Videos`. Downloads is the one people forget.
> - **Browser bookmarks** — Chrome `chrome://bookmarks`, Edge `edge://favorites`, Firefox *Bookmarks → Manage Bookmarks → Export Bookmarks to HTML*.
> - **Saved passwords** — each browser's password settings → *Export* (Chrome `chrome://settings/passwords` saves a CSV — treat it carefully and delete it once it is safely imported elsewhere).
> - **Game saves** — many live outside Steam's cloud. Check `Documents\My Games`, `%APPDATA%`, `%LOCALAPPDATA%`, and `C:\Program Files (x86)\Steam\userdata`.
> - **License keys** — pull keys for paid software from purchase emails or each app's About/Account screen while you can still open it.
> - **App data** — paste `%APPDATA%` into a File Explorer address bar and skim for email clients, chat history, and configs worth keeping.

> [!DETAILS] How to copy it off (and what if you have no external drive)
> **With an external drive:** plug it in, press `Win+E` to open File Explorer, open `C:\Users\`-your-name, select the folders you are keeping (`Ctrl`+click for several), `Ctrl+C`, then open the external drive and `Ctrl+V`. When the copy finishes, open a few files from the external drive to confirm they work — then click the USB icon in the system tray and choose **Eject** before unplugging. Skipping the eject can leave a half-written, corrupted copy of the very files you are trying to save.
>
> **No external drive?** Use a cloud free tier (Google Drive 15 GB, OneDrive 5 GB, Dropbox 2 GB — fine for documents and photos, too small for big game folders), or copy to another PC on your network: on the receiving PC right-click a folder → *Properties → Sharing → Share* and grant write access, then on the old PC type `\\OTHER-PC-NAME` into the File Explorer address bar and copy files in. Both machines must be on the same network.

### Make the two USB sticks
Two separate sticks, both written now while a working PC exists:

- **The Proxmox installer USB** — download the Proxmox VE ISO and write it to a 4 GB+ stick with balenaEtcher. (The Install Proxmox page has the full steps — do them now.)
- **The BIOS-update USB** — download the latest Maximus X Hero BIOS, run ASUS's BIOSRenamer, and copy it onto a FAT32 stick. (The Hardware & BIOS page has the full steps.)

Do not reuse one stick for both — copying the BIOS file onto the installer stick would overwrite the installer you just wrote.

### Round up a monitor and keyboard
Borrow both and plug them into the server for the install itself. You unplug them once Proxmox is up and drive everything from a browser after that.

> [!NOTE]
> After the install there is nothing more to download on a PC. The server pulls the rest over its own network connection — the TrueNAS installer, the Home Assistant image, every service container, the GPU driver — so from then on any device with a browser (a laptop, an iPad, even a phone) is enough to reach `https://`-the-server-IP-`:8006` and keep building. The two USB sticks above are the only things that strictly need a full PC, because you cannot write them from a phone.

### Set the server's address
The whole collection starts from one number — the static address you give the Proxmox host. Set it now and every later page reuses it.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The static address for the server. Reach the web interface at `https://`-this-ip-`:8006` once Proxmox is installed. Every later page starts from this value.

## The build, in order

### Work through the pages top to bottom
The pages are numbered in the exact sequence to build in. Do not skip ahead — most stages assume the previous one is finished.

> [!TIP]
> A few habits that make the build go smoothly:
>
> - **Each page is complete on its own.** The full steps for that stage are written inline and specialized to this exact hardware. You do not need any other reference.
> - **Sensitive values are credential fields, not plain text.** Anything secret — IP addresses, drive serials, usernames, passwords, tokens — is captured in a fill-in field that stays on this device and is never committed or synced. Plain hardware and choices are written out normally. Your real synced secret store is your password manager (you will build Vaultwarden for this role later in the build); these fields are just a convenience as you follow along.
> - **The order is the plan.** Build top to bottom. When a later page says "after the GPU is shared in" or "once the mirror exists," it is pointing back at a stage you have already finished.

1. **Start Here** — this page: the map and parts list.
2. **Hardware & BIOS** — seat the cards in the right slots and flip the firmware switches (virtualization and **VT-d** (Intel Virtualization Technology for Directed I/O) on) before any software goes on.
3. **Cooling Refresh** — swap the aging AIO for the air cooler, rewire the case fans off the motherboard, and repaste the 1080 Ti in the same open-case session.
4. **Install Proxmox** — install Proxmox to the NVMe, switch to the free repository, and enable **IOMMU** (Input/Output Memory Management Unit, the hardware that isolates a device for passthrough).
5. **Containers** — how the lightweight LXC service containers are created and configured.
6. **Virtual Machines** — build the TrueNAS VM and learn the appliance habits both VMs share (start at boot, the start-before-Frigate order, snapshots); the Home Assistant VM is built on the Home Assistant & Zigbee2MQTT page.
7. **GPU Sharing & HBA Passthrough** — put the NVIDIA driver on the host and set up the recipe that shares the card into later containers; VFIO the HBA to the TrueNAS VM.
8. **TrueNAS Storage** — build the ZFS mirror on the passed-through HBA and share folders over **SMB** (Server Message Block, the Windows/Mac file-sharing protocol).
9. **Protect Your Data** — snapshots, scrubs, disk-health alerts, and the encrypted offsite copy.
10. **Home Assistant & Zigbee2MQTT** — bring up Home Assistant and pair the Zigbee leak sensors, valve, and router plugs.
11. **Matter Locks** — commission the Aqara U400 locks into Apple Home, then share them to Home Assistant.
12. **Cameras, Doorbell & Frigate** — point the Reolink cameras at Frigate and run detection on the shared GPU.
13. **AdGuard** — the household DNS (Domain Name System) and ad-blocking resolver.
14. **Reverse Proxy** — clean hostnames and certificates with Nginx Proxy Manager.
15. **Remote Access** — reach everything from anywhere with Tailscale, no port-forwards.
16. **Nextcloud** — self-hosted files and photos, backed by the ZFS mirror.
17. **Vaultwarden** — the synced password vault and the build's secret store.
18. **Homepage** — a single dashboard linking every service.
19. **Uptime Kuma** — monitoring and alerts for the whole rack.
20. **Proxmox Backups** — scheduled backups of every guest, plus the host config.
21. **UPS & Safe Shutdown** — graceful shutdown on a power cut, over NUT.
22. **Automations** — the leak-to-valve safety rule, presence, locks, and climate logic.
23. **Voice — Siri & Local Assist** — both the Apple/Siri path and the fully-local voice assistant.
24. **Maintenance & Upkeep** — the monthly and quarterly routine that keeps it boring.

When you are ready, move on to **Hardware & BIOS** to seat the cards and prepare the firmware.
