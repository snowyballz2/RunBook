---
title: Start Here
subtitle: What this build is, how it fits together, and the order to do it in
collection: My Build
order: 1
accent: amber
---

This collection is a complete, hands-on build of one all-in-one home server: a single full-tower PC that runs the smart home, the cameras, the file storage, and a handful of self-hosted services — all locally, all on hardware you own. Each page is a self-contained how-to for one stage of the build. Work through them top to bottom, in order, and at the end you have a quiet box upstairs running the whole house.

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
> **Start the Home Assistant VM before the Frigate container.** Frigate publishes to the **MQTT** (MQ Telemetry Transport, a lightweight messaging broker) service that lives with Home Assistant, so the broker has to exist first. You set this start order explicitly once the Home Assistant VM exists — on the Home Assistant & Zigbee2MQTT page, with the Frigate side set on the Cameras, Doorbell & Frigate page — so it survives every reboot.

### Understand the disk layout
Three different jobs, three different homes:

- The **500 GB NVMe** (Non-Volatile Memory Express, a fast solid-state drive) holds the Proxmox OS and the Frigate cache.
- **Two of the three IronWolf hard drives** become the TrueNAS **ZFS mirror** — your real, redundant file storage. These two hang off the passed-through HBA.
- **The third IronWolf** is the Frigate footage drive. It does *not* go on the HBA; it plugs into a **SATA** (Serial Advanced Technology Attachment, the common drive interface) port on the motherboard, because the host and Frigate need direct access to it.

All three hard drives mount in the fixed rear drive trays of the case, behind the motherboard tray — the removable front pods are not needed.

### See how everything gets power and network
One map for the whole build: every physical device, how it is powered, and which link it talks over. The line colors are the link types; the small rose tag inside each box is that device's power source. (The wiring *inside* the server case has its own diagrams on the Hardware & BIOS page.)

<svg viewBox="0 0 720 1290" role="img" aria-label="Power and network map of every physical device in the build" style="width:100%;height:auto;max-width:720px;margin:0.75rem 0;font-family:inherit;font-size:11px">
<rect x="1" y="1" width="718" height="1288" rx="12" style="fill:var(--color-surface);stroke:var(--color-line)"/>
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
<text x="83" y="124" text-anchor="middle" style="fill:var(--color-ink-soft)">Internet (ISP)</text>
<text x="83" y="139" text-anchor="middle" style="fill:#f43f5e;font-size:9px">ONT · UPS battery</text>
<line x1="83" y1="148" x2="83" y2="178" style="stroke:var(--color-ink-faint);stroke-width:1.5"/>
<rect x="16" y="178" width="134" height="72" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="83" y="199" text-anchor="middle" style="fill:currentColor;font-weight:600">Wi-Fi router</text>
<text x="83" y="214" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">192.168.1.1</text>
<rect x="46" y="224" width="74" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="83" y="234" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">UPS battery</text>
<rect x="196" y="178" width="224" height="72" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="308" y="196" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">Rack switches — daisy-chained</text>
<text x="308" y="210" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">VIMIN 26-port · 24× PoE 320 W</text>
<text x="308" y="223" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">→ GS308EPP 8-port PoE+ · both feed below</text>
<rect x="278" y="228" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="308" y="238" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall</text>
<line x1="150" y1="214" x2="196" y2="214" style="stroke:#10b981;stroke-width:2.5"/>
<rect x="460" y="104" width="244" height="260" rx="8" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="582" y="128" text-anchor="middle" style="fill:currentColor;font-size:12px;font-weight:600">The server — Proxmox host</text>
<text x="582" y="146" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">ASUS Maximus X Hero · i7-8700K · 32 GB</text>
<text x="582" y="161" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">GTX 1080 Ti · 9300-8i HBA · NVMe</text>
<text x="582" y="176" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">3× IronWolf 4 TB</text>
<text x="582" y="193" text-anchor="middle" style="fill:var(--color-ink-faint);font-size:9.5px">(inside wiring: the Hardware &amp; BIOS page)</text>
<text x="582" y="214" text-anchor="middle" style="fill:currentColor;font-size:10.5px">192.168.1.50</text>
<rect x="497" y="226" width="170" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="582" y="236" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">UPS battery — Toughpower 850 W PSU</text>
<line x1="130" y1="250" x2="130" y2="268" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="130" y1="268" x2="460" y2="268" style="stroke:#10b981;stroke-width:2.5"/>
<rect x="196" y="290" width="224" height="96" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="308" y="312" text-anchor="middle" style="fill:currentColor;font-weight:600">CyberPower CP1500PFCLCD</text>
<text x="308" y="328" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">battery: server · router · ONT · Caséta</text>
<text x="308" y="342" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:10px">(switches stay on wall AC for now)</text>
<rect x="266" y="354" width="84" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="308" y="364" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">AC wall in</text>
<line x1="420" y1="320" x2="460" y2="320" style="stroke:#f43f5e;stroke-width:2.5"/>
<text x="440" y="313" text-anchor="middle" style="fill:#f43f5e;font-size:9px">AC</text>
<line x1="420" y1="352" x2="460" y2="352" style="stroke:#f59e0b;stroke-width:2"/>
<text x="440" y="345" text-anchor="middle" style="fill:#f59e0b;font-size:9px">NUT</text>
<rect x="460" y="384" width="244" height="46" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="582" y="403" text-anchor="middle" style="fill:currentColor;font-size:10.5px">2× ZBT-2 radios — Zigbee + Thread</text>
<text x="582" y="418" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">each on its included 1.5 m USB-C cable</text>
<line x1="582" y1="364" x2="582" y2="384" style="stroke:#f59e0b;stroke-width:2"/>
<line x1="30" y1="250" x2="30" y2="450" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
<line x1="30" y1="450" x2="629" y2="450" style="stroke:#8b5cf6;stroke-width:2;stroke-dasharray:5 3"/>
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
<text x="297" y="504" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">192.168.1.71 · 2nd indoor</text>
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
<text x="131" y="595" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">HomePod mini (later)</text>
<text x="131" y="609" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">optional · Siri + extra Thread router</text>
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
<line x1="548" y1="430" x2="548" y2="720" style="stroke:#d946ef;stroke-width:2;stroke-dasharray:2 3"/>
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
<text x="540" y="758" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">border router: HA OTBR — 2nd ZBT-2 on the server</text>
<rect x="392" y="772" width="296" height="88" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="540" y="792" text-anchor="middle" style="fill:currentColor;font-size:10.5px">3× Aqara U400 deadbolts</text>
<text x="540" y="807" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Carport · Front · Basement</text>
<text x="540" y="821" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">commissioned straight into Home Assistant</text>
<rect x="510" y="831" width="60" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="540" y="841" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">battery</text>
<rect x="376" y="910" width="328" height="180" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="540" y="932" text-anchor="middle" style="fill:currentColor;font-size:11.5px;font-weight:600">Lutron Clear Connect RF</text>
<line x1="100" y1="250" x2="100" y2="440" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="100" y1="440" x2="711" y2="440" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="711" y1="440" x2="711" y2="972" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="711" y1="972" x2="688" y2="972" style="stroke:#10b981;stroke-width:2.5"/>
<rect x="392" y="946" width="296" height="52" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="540" y="963" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Caséta Pro bridge</text>
<text x="540" y="976" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">Ethernet — straight to the router · UPS battery</text>
<rect x="470" y="1010" width="140" height="66" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="540" y="1030" text-anchor="middle" style="fill:currentColor;font-size:10.5px">Wall dimmers</text>
<rect x="485" y="1040" width="110" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="540" y="1050" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">in-wall house mains</text>
<line x1="540" y1="998" x2="540" y2="1010" style="stroke:var(--color-ink-faint);stroke-width:1.5;stroke-dasharray:5 3"/>
<line x1="196" y1="235" x2="175" y2="235" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="175" y1="235" x2="175" y2="462" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="175" y1="462" x2="380" y2="462" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="380" y1="462" x2="380" y2="700" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="380" y1="700" x2="360" y2="700" style="stroke:#10b981;stroke-width:2.5"/>
<line x1="360" y1="700" x2="360" y2="1120" style="stroke:#10b981;stroke-width:2.5"/>
<rect x="16" y="1120" width="688" height="150" rx="8" style="fill:var(--color-surface-2);stroke:var(--color-line-strong)"/>
<text x="360" y="1144" text-anchor="middle" style="fill:currentColor;font-size:11.5px;font-weight:600">Wired PoE — everything off the rack switches</text>
<text x="360" y="1160" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">power and data on one Cat6 run each, back to the patch panel</text>
<rect x="32" y="1174" width="320" height="80" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="192" y="1196" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">5× EmpireTech cameras</text>
<text x="192" y="1211" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">4 perimeter turrets + 1 full-colour indoor</text>
<rect x="132" y="1222" width="120" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="192" y="1232" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">PoE — GS308EPP</text>
<rect x="368" y="1174" width="320" height="80" rx="6" style="fill:var(--color-surface);stroke:var(--color-line-strong)"/>
<text x="528" y="1196" text-anchor="middle" style="fill:currentColor;font-size:10.5px;font-weight:600">SmartWings PoE shades</text>
<text x="528" y="1211" text-anchor="middle" style="fill:var(--color-ink-soft);font-size:9.5px">one run per shade · battery Thread ones ride Thread</text>
<rect x="468" y="1222" width="120" height="14" rx="3" style="fill:#f43f5e;fill-opacity:0.12"/>
<text x="528" y="1232" text-anchor="middle" style="fill:#f43f5e;font-size:9.5px">PoE — VIMIN 24×</text>
</svg>

*Reading it top to bottom: the wall feeds the UPS; its battery side carries the server, the Fios router, and the Caséta bridge — and because the server plugs straight into the router, an outage keeps Wi-Fi, Tailscale, the dashboards, and every Zigbee/Thread automation alive with no switch involved — and with the ONT riding the battery too, internet and push notifications stay up as well. The rack switches stay on wall power, so the cameras stop recording and the shades go dark until mains returns — adding the switches to battery later is what would close that gap. Everything else wired rides the daisy-chained rack switches to the router; everything wireless rides the router's Wi-Fi. Three radio meshes hang off their own hubs — Zigbee off one ZBT-2 on the server, Thread off Home Assistant's own OpenThread border router (a second ZBT-2 on the server), and Lutron's own RF off the Caséta bridge. A HomePod added later just joins the Thread mesh as an extra border router; the build does not need it.*

### The addressing plan
Every fixed address in the build, in one place — and the same list lives in the app's **Addressing Plan** view (the card beside Credentials on the library screen), which shows the values *you* recorded rather than these defaults. The rule underneath it: **`.2–.99` is reserved static territory** and the router's DHCP pool is shrunk to **`.100–.254`** (the warning at the end of this page), so nothing here can ever be handed to a phone.

**The server and its guests** — all reachable by name once the Reverse Proxy page runs, and by address always:

| Address | Guest | ID | Reach it at | Proxied name |
|---|---|---|---|---|
| `.50` | Proxmox host (`pve`) | — | `https://192.168.1.50:8006` | `proxmox.` |
| `.20` | TrueNAS VM | 100 | `http://192.168.1.20` | `nas.` |
| `.51` | Home Assistant OS VM | 101 | `http://192.168.1.51:8123` | `ha.` |
| `.52` | Frigate LXC | 102 | `https://192.168.1.52:8971` | `frigate.` |
| `.53` | AdGuard LXC | 103 | `http://192.168.1.53` | — |
| `.54` | Nginx Proxy Manager LXC | 104 | `http://192.168.1.54:81` | — |
| `.55` | Homepage LXC | 107 | `http://192.168.1.55:3000` | `home.` |
| `.56` | Vaultwarden LXC | 106 | `http://192.168.1.56:8000` | `vault.` |
| `.57` | Uptime Kuma LXC | 108 | `http://192.168.1.57:3001` | `status.` |
| `.58` | Nextcloud (NCP) LXC | 105 | `https://192.168.1.58` | `cloud.` |
| `.59` | Ollama LXC | — | port `11434`, no UI | — |
| `.60` | faster-whisper LXC | — | port `10300`, no UI | — |

Three of those ports are not web UIs and matter anyway: AdGuard answers **DNS on 53**, the proxy serves the house on **80 and 443** (81 is only its admin), and Frigate keeps an unauthenticated **5000** fenced to Home Assistant and Uptime Kuma alone. The last two rows arrive on the Voice page; every other guest is built by page 19.

**Cameras and network gear:**

| Address | Device |
|---|---|
| `.1` | Fios router — gateway and DHCP |
| `.70` | Reolink Video Doorbell (Wi-Fi) |
| `.71` | Reolink RLC-510WA (Wi-Fi, 2nd indoor) |
| `.72` | `shed_turret` — EmpireTech PoE |
| `.73` | `carport_turret` — EmpireTech PoE |
| `.74` | `patio_turret` — EmpireTech PoE |
| `.75` | `chimney_turret` — EmpireTech PoE |
| `.76` | `kitchen_turret` — Color4K indoor PoE |
| `.98` | *not a device* — the dead-end gateway every camera is given so it cannot reach the internet |

**Boot order**, set on each guest's Options tab: **TrueNAS `1` → Home Assistant `2` → Frigate `3`**. Storage comes up first and shuts down last; Frigate follows Home Assistant because it publishes to the MQTT broker living there.

## Get ready

Once Proxmox is installed, the machine you are building becomes a **headless server** and the NVMe that held Windows is erased. From that point on, the server downloads everything itself and you only need a browser to drive it. The steps here all happen first, on a **working computer with a web browser and a USB port** — get them out of the way before the install.

### Gather the parts
Check you have everything before you start — the later pages assume each piece is on hand.

> [!DETAILS] Core PC — board, CPU, power, case
> - **Motherboard:** ASUS ROG Maximus X Hero (Z370)
> - **CPU:** Intel i7-8700K
> - **RAM:** 32 GB
> - **PSU** (power supply unit)**:** Thermaltake Toughpower Grand RGB 850W (Gold, fully modular) — ample for the GPU plus a stack of spinning disks
> - **Case:** Thermaltake View 71 full tower
> - **GPU:** EVGA GTX 1080 Ti FTW3
> - **Cooling refresh (page 3):** Thermalright Phantom Spirit 120 SE air cooler, 4x Noctua NF-P12 redux-1700 PWM case fans (optional fifth for top exhaust), a thermal pad variety kit (0.5/1.0/1.5 mm) and non-conductive paste for the GPU repaste

> [!DETAILS] Storage — NVMe, disks, HBA
> - **500 GB NVMe** — Proxmox OS + Frigate cache
> - **3x Seagate IronWolf ST4000VN006 (4 TB)** — two form the TrueNAS ZFS mirror, one is the Frigate footage drive
> - **LSI/Broadcom 9300-8i HBA** — IT mode (Initiator-Target mode, where the card exposes raw disks instead of building its own array), pre-flashed; passed through to TrueNAS

> [!DETAILS] Network, power, and radios
> - **Netgear GS308EPP** managed 8-port **PoE** (Power over Ethernet, power and data on one cable) switch — powers the wired camera perimeter (the EmpireTech turrets + the Color4K indoor cam); per-port control reboots a frozen camera from software. The 5 cameras plus the VIMIN uplink fill 6 of its 8 ports — the server's own Ethernet runs straight to the router, leaving two spare
> - **VIMIN VM-GS2420P 26-port Gigabit PoE switch** — 24 PoE ports (**320 W** budget) for the SmartWings shades plus **2 dedicated gigabit uplinks**: the Fios router feeds one, the GS308EPP hangs off the other, so the rack chains **router → VIMIN → GS308EPP** (the server does not ride the chain — it plugs straight into the router)
> - **48-port patch panel** — a passive termination point, not a device: it does nothing to the signal. Every **in-wall** Cat6 run (each camera, each shade) is punched down on its back, and the matching front jack is patched across to a switch port with a short cable. That is its whole job — keeping stiff buried cable off the switches, so a change is a two-second patch-cable swap instead of a re-termination. The rule: **anything running through a wall lands on the panel; anything sitting side by side connects directly.** On this build that splits cleanly, because the gear lives in two places — the **Fios router, the ONT, and the server** together in one spot, and the **two switches plus the patch panel** in another:
>   - **Router → VIMIN** crosses between them, so it is an in-wall run like any other: router LAN port → wall plate → in-wall Cat6 → punched down on the panel's rear → panel front jack → short patch cable → the VIMIN's uplink port. **Label that panel port unmistakably** ("UPLINK — ROUTER"): it is the trunk every camera and shade depends on, and on a 48-port panel of otherwise identical jacks it is exactly what gets unpatched by someone hunting a free port
>   - **VIMIN → GS308EPP** is two boxes in the same rack — a short cable straight between them, no panel involved
>   - **Server → router** is also side by side, so it is a direct cable and never touches the panel
> - **CyberPower CP1500PFCLCD UPS** (uninterruptible power supply, the battery backup) — monitored over **NUT** (Network UPS Tools); its battery side carries the **server, the Fios router, the Fios ONT, and the Caséta bridge** (the switches stay on wall AC)
> - **HA Connect ZBT-2 ×2** — one is the Zigbee coordinator (ember driver, Zigbee2MQTT); the second is a dedicated **Thread** radio for Home Assistant's own **OpenThread Border Router**, so Matter-over-Thread (the locks, any battery shades) needs no Apple or Google hub
> - **HomePod mini** *(optional, add later)* — brings Siri voice and a second Thread border router that strengthens the mesh; the build works fully without it

> [!DETAILS] What the house controls
> - **Locks:** 3x Aqara U400 (Matter-over-Thread), commissioned straight into Home Assistant over its own Thread border router (Home Key added later if you add a HomePod)
> - **Cameras:** **4x EmpireTech IPC-T54PRO-AS** (WizColor dual-light turrets, 3.6mm, inside-corner mounts) plus **one IPC-Color4K-T-S2** (8MP full-colour, 3.6mm) indoors — five PoE cameras into the GS308EPP, feeding Frigate. Also kept: the **Reolink Video Doorbell WiFi** (black 4:3, off the door transformer) and the **Reolink RLC-510WA** (5MP WiFi, 12 V adapter) as the second indoor camera
> - **Shades:** **SmartWings** motorized shades — most PoE ("Matter over Ethernet"), a few battery ("Matter over Thread") — all landing in Home Assistant as `cover` entities
> - **Leak protection:** 12x Third Reality leak sensors, an Aqara Valve Controller T1 on the main shutoff lever, and Third Reality smart plugs acting as Zigbee routers
> - **Thread mesh:** **5x IKEA GRILLPLATS smart plugs** ($7.99 each, Matter over Thread with energy metering). These are the Thread equivalent of the Third Reality plugs above, and they are **not optional**: every other Thread device in this build runs on batteries, and only mains-powered devices become Thread routers. Buy them **before** commissioning the locks — see [Matter Locks](#/guide/my-build-11-matter-locks). **Eve Energy (Matter)** at ~$40 is the fallback if IKEA is out of stock. Insist on **Thread**; most cheap "Matter" plugs are Wi-Fi and do nothing for the mesh — **TP-Link Tapo** is the one to watch, as its entire Matter line is Wi-Fi only
> - **Sliding glass door contact:** **1x IKEA MYGGBETT** door/window sensor ($8, Matter over Thread) on the sliding glass door — the one opening in the house with no smart hardware of its own, so it is the only contact sensor here reporting something the locks do not already say
> - **Already in the house:** Lutron Caseta lights (Pro bridge), 2x ecobee thermostats, Google/Nest speakers for announcements, and a Samsung Family Hub fridge

### Get wired Ethernet to the server's final spot
Proxmox cannot use Wi-Fi for its management interface, so the box must be plugged into the router with a cable.

If the spot where the quiet box will live is far from the router:

1. Get a long Ethernet cable or a powerline adapter (both work).

Do this **before** you start — this is the one networking thing you cannot fix from a browser later, and discovering it after the wipe means the server is unreachable.

### Back up everything on the NVMe
The 500 GB NVMe currently has Windows and your files on it, and the Proxmox install **erases the whole drive**. Copy anything you want to keep onto another machine or an external disk first — there is no undo.

> [!WARNING]
> Wiping the NVMe is irreversible. Confirm your files are copied off — and that a few of them actually open from the copy — before you reach the install.

> [!TIP]
> While Windows is still on the machine, you can confirm hardware virtualization is on.
>
> 1. Press `Ctrl+Shift+Esc` to open Task Manager.
> 2. Click the **Performance** tab.
> 3. Click **CPU**.
>
> The right-hand column should read **Virtualization: Enabled**. (You set the BIOS toggles for this on the Hardware & BIOS page; after the wipe the Proxmox installer also warns loudly if it is missing, so a missed switch surfaces there too.)

> [!DETAILS] What to pull off the NVMe before it is wiped
> Most of what matters lives in a handful of places — work down this list on the Windows machine, then copy it all to an external drive or another PC and spot-check that it opens:
> - **Personal files** — `Documents`, `Desktop`, `Downloads`, `Pictures`, `Videos`. Downloads is the one people forget.
> - **Browser bookmarks** — Chrome `chrome://bookmarks`, Edge `edge://favorites`, Firefox *Bookmarks → Manage Bookmarks → Import and Backup → Export Bookmarks to HTML*.
> - **Saved passwords** — each browser's password settings → *Export* (Chrome `chrome://settings/passwords` saves a CSV — treat it carefully and delete it once it is safely imported elsewhere).
> - **Game saves** — many live outside Steam's cloud. Check `Documents\My Games`, `%APPDATA%`, `%LOCALAPPDATA%`, and `C:\Program Files (x86)\Steam\userdata`.
> - **License keys** — pull keys for paid software from purchase emails or each app's About/Account screen while you can still open it.
> - **App data** — paste `%APPDATA%` into a File Explorer address bar and skim for email clients, chat history, and configs worth keeping.

> [!DETAILS] How to copy it off (and what if you have no external drive)
> **With an external drive:**
> 1. Plug in the external drive.
> 2. Press `Win+E` to open File Explorer.
> 3. Open `C:\Users\`-your-name.
> 4. Select the folders you are keeping (`Ctrl`+click for several).
> 5. Press `Ctrl+C`.
> 6. Open the external drive.
> 7. Press `Ctrl+V`.
> 8. When the copy finishes, open a few files from the external drive to confirm they work.
> 9. Click the USB icon in the system tray.
> 10. Choose **Eject** before unplugging.
>
> Skipping the eject can leave a half-written, corrupted copy of the very files you are trying to save.
>
> **No external drive?** Use a cloud free tier (Google Drive 15 GB, OneDrive 5 GB, Dropbox 2 GB — fine for documents and photos, too small for big game folders), or copy to another PC on your network:
> 1. On the receiving PC, right-click a folder.
> 2. Choose **Properties**.
> 3. Click the **Sharing** tab.
> 4. Click **Share**.
> 5. Grant write access.
> 6. On the old PC, type `\\OTHER-PC-NAME` into the File Explorer address bar.
> 7. Copy files in.
>
> Both machines must be on the same network.

### Make the two USB sticks
Two separate sticks, both written now while a working PC exists:

- **The Proxmox installer USB** — download the Proxmox VE ISO and write it to a 4 GB+ stick with balenaEtcher. (The Install Proxmox page has the full steps — do them now.)
- **The BIOS-update USB** — download the latest Maximus X Hero BIOS, run ASUS's BIOSRenamer, and copy it onto a FAT32 stick. (The Hardware & BIOS page has the full steps.)

Do not reuse one stick for both. Writing the installer image converts the stick to a read-only installer layout Windows cannot add files to — and USB BIOS Flashback only reads a plain **FAT32** stick anyway, so the BIOS file needs its own.

### Round up a monitor and keyboard

1. Borrow a monitor and keyboard.
2. Plug them into the server for the install itself.

You unplug them once Proxmox is up and drive everything from a browser after that.

> [!NOTE]
> After the install there is nothing more to download on a PC. The server pulls the rest over its own network connection — the TrueNAS installer, the Home Assistant image, every service container, the GPU driver — so from then on any device with a browser (a laptop, an iPad, even a phone) is enough to reach `https://192.168.1.50:8006` and keep building. The two USB sticks above are the only things that strictly need a full PC, because you cannot write them from a phone.

> [!NOTE]
> **The cost of `192.168.1.x`, stated plainly.** It is the most common home range in the world, and that bites exactly once: away from home, on any Wi-Fi that also uses `192.168.1.x`, the network you are standing in beats the Tailscale subnet route and the house is unreachable — while cellular works perfectly (the Remote Access page has the check and the workaround: Wi-Fi off for the visit). Tailscale's own advice is an uncommon range. Only three blocks are private — `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` — and anything else is the real internet: `11.x`, for instance, belongs to the US Department of Defense, and using it at home would make those genuine addresses unreachable from your house. `100.64.x`–`100.127.x` (carrier-grade NAT, where Tailscale's own `100.x` addresses live) and `169.254.x` (link-local) are spoken for too. So: any `/24` inside the private `10.0.0.0/8` block (`10.x.y.0/24`, x and y each 0–255, 65,536 choices) whose middle numbers nobody defaults to. Companies live in `10.x` too, but a collision needs an exact match of all three leading numbers, and the bigger block is simply 256 times more room to be unpredictable than `192.168.x`, whose 256 networks the world's routers crowd onto. Skip the defaults: skip `10.0.0`, `10.0.1`, `10.1.1`, `10.10.10`, the `172.16`–`172.31` ranges (Docker, phone hotspots, Home Assistant's own add-on network) and `192.168.0/1/86`. `10.27.4.0/24` is one such pick; `10.213.77.0/24` would be just as good. Only the first three numbers change — every device keeps its last number (`.50` stays `.50`), which is what makes a renumber a substitution rather than a redesign. This build kept `192.168.1.x` because every device, camera, allow-list, and page assumes it; renumbering later means touching all of them. If the collision bites you often, that migration is the real fix — decide it deliberately, not page by page.

### Set the server's address
The whole collection starts from one number — the static address you give the Proxmox host. Set it now and every later page reuses it.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The static address for the server. Reach the web interface at `https://`-this-ip-`:8006` once Proxmox is installed. Every later page starts from this value.

> [!WARNING]
> **Carve out the static block first.** Every static address in this collection — the host here, the service guests in the .50s, the cameras in the .70s — assumes those numbers are *reserved territory*, but the Fios router's DHCP pool spans nearly the whole subnet out of the box, so nothing stops it handing `.50` to a phone someday.

1. Open the router at `192.168.1.1`.
2. Go to its **LAN/DHCP settings**.
3. Shrink the pool to `192.168.1.100 – 192.168.1.254`.
4. Reboot the router. Devices currently leasing an address below `.100` migrate into the pool automatically on their next renewal — a reboot does them all at once.
5. Check the device list for anything still squatting below `.100` — that means it was statically configured on the device itself.
6. Reconfigure it into the pool range before it collides with a service.

> [!NOTE]
> That leaves `.2 – .99` as the static zone every default below lives in, and the pool keeps 155 addresses for everything else — phones, guests, and the PoE shades (which get DHCP reservations *inside* the pool, one per motor).

## The build, in order

### Work through the pages top to bottom
The pages are numbered in the exact sequence to build in. Do not skip ahead — most stages assume the previous one is finished.

> [!TIP]
> A few habits that make the build go smoothly:
>
> - **Each page is complete on its own.** The full steps for that stage are written inline and specialized to this exact hardware. You do not need any other reference.
> - **Sensitive values are credential fields, not plain text.** Anything secret — IP addresses, drive serials, usernames, passwords, tokens — is captured in a fill-in field that stays on this device and is never committed or synced. Plain hardware and choices are written out normally. Your real synced secret store is your password manager (you will build Vaultwarden for this role later in the build); these fields are just a convenience as you follow along.
> - **Your ad-blocker may flag the copy buttons.** uBlock Origin's ClickFix protection warns when any page offers a `bash -c "$(curl …)"` command to the clipboard — the mechanics of a real attack class, so the warning is earned, but here it is this guide's own install one-liners.
>
>   If it flags one of this guide's copy buttons:
>
>   1. Check the flagged domain is the one the page prints (the community-scripts repo on `raw.githubusercontent.com`).
>   2. Dismiss or allowlist this site.
>
>   The download-read-run habit below is the real protection either way.
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
11. **Matter Locks** — commission the Aqara U400 locks straight into Home Assistant over its own Thread border router (no Apple hub).
12. **Cameras, Doorbell & Frigate** — point the EmpireTech turrets, the Color4K indoor camera, and the Reolink doorbell at Frigate and run detection on the shared GPU.
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
