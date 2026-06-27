---
title: Home Assistant + Zigbee2MQTT + Locks
subtitle: The smart-home core — radios, sensors, and the valve that matters
collection: My Build
order: 5
accent: violet
---

This is the brain of the house. Follow the *Home Assistant OS* guide for every screen and command; this page is just the order I do things in and the exact devices I'm joining.

## Stand up Home Assistant

### Build the HA (Home Assistant) OS VM (virtual machine)
Create the Home Assistant OS VM the way *Home Assistant OS* describes — HAOS ships as a disk image, not an ISO, so use the helper script or the five manual `qm` commands there. My values: **2 cores, 8 GB RAM** (I have it to spare, and apps like more room), 32 GB disk. Start it **before** the Frigate LXC (Linux Containers) every boot — Frigate's broker is fine first, but HA owning MQTT (Message Queuing Telemetry Transport) first keeps the dependency order clean.

> [!NOTE]
> Don't VFIO (Virtual Function I/O) anything to this VM. The 1080 Ti stays on the Proxmox host (shared into LXCs); the only PCIe (Peripheral Component Interconnect Express) passthrough in my build is the HBA (host bus adapter) → TrueNAS. HA reaches the GPU services over the LAN (local area network).

### Pin its address
Give the VM a fixed IP address (DHCP (Dynamic Host Configuration Protocol) reservation on the router, or static under **Settings → System → Network**) before anything else points at it. This is the address the phone apps, dashboards, and the *Frigate*/MQTT links all use.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!INPUT] ha-owner-user | Home Assistant owner username

> [!SECRET] ha-owner-password | Home Assistant owner password

> [!WARNING]
> The owner account can't be recovered. It's also in Vaultwarden, but record it here too so this checklist is self-contained.

## Zigbee2MQTT on the ZBT-2

### Pass the coordinator through
I run **Zigbee2MQTT (Z2M), not ZHA (Zigbee Home Automation)** — broader device support, and it speaks the same MQTT bus *Frigate* already publishes to. Pass the **HA Connect ZBT-2** through to wherever Z2M runs (the USB passthrough step in *Home Assistant OS*), on a short extension cable to keep it away from the case.

### Point Z2M at Frigate's broker
Install Z2M and connect it to the **Mosquitto broker already running for Frigate** — I don't stand up a second broker. Give Z2M its **own** MQTT username and password (not Frigate's `mqtt-user`) so the logs make it obvious who's talking; everything namespaces under `zigbee2mqtt/...` and stays out of Frigate's way. In Z2M's settings, select the **`ember`** driver — that's the one for the ZBT-2.

> [!INPUT] z2m-mqtt-user | Zigbee2MQTT's own MQTT username | | zigbee2mqtt
> Separate from Frigate's `mqtt-user`. Same broker, distinct login.

> [!SECRET] z2m-mqtt-password | Zigbee2MQTT's MQTT password

### Lay down routers first, then pair
Plug in the **Third Reality 3RSP019BZ smart plugs** first and pair them — they're mains-powered Zigbee **routers** that build the mesh the battery sensors lean on. Place them **near the sensor clusters and near the valve**, so the leak devices and the shut-off always have a strong hop home.

Then put each device into pairing mode and join it in Z2M:

- **12× Third Reality 3RWS18BZ** siren leak sensors — one at every water risk (water heater, washer, dishwasher, sinks, sump, fridge line).
- **Aqara Valve Controller T1** — the clamp-on actuator on my **quarter-turn lever** main valve. It physically turns the lever; no plumbing changes.

Once paired, Z2M reports them over MQTT and HA's MQTT integration surfaces them as ordinary entities — the `binary_sensor.*_leak` sensors and the `valve.*` actuator.

> [!TIP]
> This onboarding is the prerequisite for the *Automations* water-leak → close-valve automation. Until the sensors and the valve exist as HA entities, that automation has nothing to listen to or close.

> [!WARNING]
> Confirm the T1 actually throws the lever through its full travel before trusting it. Mount it so closed is closed — a clamp that slips is worse than no automation.

## Locks — Apple Home first, then share

### Commission the 3× Aqara U400 into Apple Home
These are **Matter-over-Thread**. In an all-Apple house I commission each U400 straight into **Apple Home** first — that's what lights up **Home Key**, and the **HomePod mini** is already my Thread border router. Scan each lock's QR (quick response) in the **Home app on the phone** (Bluetooth does the commissioning).

### Share each lock to HA via Matter multi-admin
That QR code is now spent, so HA can't scan it again — Matter is built for this. **Share** each lock instead of re-pairing, exactly as *Home Assistant OS* covers:

1. Apple **Home** app → the lock → **Settings → Turn On Pairing Mode** → Apple hands you a fresh setup code.
2. HA: **Settings → Devices & services → Add → Matter** → enter that code (still from the companion app on a Bluetooth phone).

Apple's control and Home Key stay exactly as they were; HA simply gains shared control — which is what lets the U400s show up in dashboards and the *Automations* auto-lock / unlock-notify rules.

> [!NOTE]
> Repeat for all three locks. Each needs its own pairing-mode round trip.

## Pull in what's already here

### Lutron Caséta and ecobee integrate natively
No radios or Z2M for these — add them under **Settings → Devices & services**:

- **Lutron Caséta** lights + shades via the **Caséta PRO bridge** — a local integration, no cloud hop.
- **ecobee** thermostats ×2 — a cloud integration (sign in to ecobee); fine, but know it routes through the vendor. These feed the *Automations* setback rule.

### Sort everything into Areas
As each device lands, drop it in a room under **Settings → Areas, labels & zones**. Two minutes that pays forever — dashboards group by area, and voice/automation targeting only works once HA knows what's *in* each room.

> [!TIP]
> With the leak sensors, valve, locks, Caséta, and ecobee all present as entities, head to the *Automations* guide — every rule in my build (leak → valve, presence, auto-lock, setback, low-battery sweep, person alerts) assumes these exist.
