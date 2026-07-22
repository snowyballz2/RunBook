---
title: Matter Locks
subtitle: Three Aqara U400s commissioned straight into Home Assistant over its own Thread border router — no Apple hub
collection: My Build
order: 11
accent: rose
---

The three Aqara U400 deadbolts are **Matter-over-Thread** devices, and this build runs them **Apple-hub-free**: Home Assistant provides its own **Thread border router**, so each lock commissions **directly into Home Assistant (HA)** — no HomePod, no Apple Home in the loop. That keeps them fully local and self-hosted for lock/unlock, automations, and notifications. The one thing HA cannot grant is Apple's **Home Key** (tap-to-unlock with an iPhone or Apple Watch): that needs the lock in Apple Home, which needs an *Apple* Thread border router — so Home Key waits for the HomePod you add later, and the last section switches it on then.

> [!NOTE]
> Matter is the vendor-neutral standard for local control with no manufacturer cloud in the loop. **Thread** is the low-power mesh radio it rides on. A Thread device needs a **border router** to reach the network — and on this build **Home Assistant runs its own**, on a dedicated ZBT-2 radio, so no Apple or Google hub sits in the critical path. A HomePod added later simply *joins* the Thread mesh as a second border router and strengthens it.

## Stand up Home Assistant's Thread border router

### Add a second ZBT-2 for Thread
Your first **HA Connect ZBT-2** is busy running Zigbee2MQTT — and one radio cannot cleanly do Zigbee and Thread at once (the multi-protocol firmware is experimental and degrades both). So Thread gets its **own** ZBT-2. Plug a **second ZBT-2** into the server on a short USB extension (away from case interference), then pass it to the Home Assistant OS VM exactly like the first: in Proxmox, select the VM → **Hardware → Add → USB Device**, pick the second ZBT-2 by name, and reboot the VM.

> [!WARNING]
> Two identical ZBT-2s are easy to mix up. Note which USB port each is on, and after the reboot confirm Zigbee2MQTT still sees *its* coordinator before you point Thread at the other one — do not let the OTBR app grab the Zigbee radio, or the whole mesh drops.

### Install the OpenThread Border Router app
In Home Assistant, go to **Settings → Apps → Install app**, install **OpenThread Border Router (OTBR)**, and in its configuration point it at the **second ZBT-2's device path** (not the Zigbee one). Start it. Home Assistant's **Thread** integration picks it up automatically and forms a network — check **Settings → Devices & services → Thread**, where you should see your own network listed as *preferred*, with the OTBR as its border router.

> [!NOTE]
> This is the piece a HomePod would otherwise provide, and running it yourself means full local control and visibility. Be honest about the trade-off, though: it is **one** border router, where an Apple household gets a whole-house mesh from every HomePod. Plan around it — commission Thread devices within solid range of this radio, and lean on the fact that most of this build's Matter devices (the **PoE shades**, wired over Ethernet) are not on Thread at all. The Thread mesh here carries only these locks and any **battery** shades, so its footprint is light.

## Before you commission

### Confirm the prerequisites
Three things need to be true before you touch a lock:

- The **Home Assistant OS VM** is up, with the **Matter** integration available (it ships with Home Assistant) and the **OTBR** running from the step above.
- You have an **iPhone or Android phone with Bluetooth on**, signed in to the **Home Assistant companion app**. Commissioning a Matter device happens over Bluetooth from a phone — the HA web UI alone cannot do it, which surprises people running HA in a VM with no Bluetooth. The phone bridges that gap and hands the device HA's Thread credentials.
- Each lock is **physically installed and powered** — the U400's rechargeable lithium pack charged (it takes USB-C, not disposable cells) and seated, the door able to throw the bolt.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51
> The address the Home Assistant companion app points at.

### Find each lock's QR setup code
Every U400 has a **Matter QR code** — on a sticker inside the battery compartment, on the quick-start card, and usually a peel-off duplicate for your records. You scan each one **once**, into Home Assistant. Record all three now so this checklist stands on its own, and keep them in your password manager (you consolidate these into Vaultwarden later in the build) — you re-commission from them after any factory reset.

> [!SECRET] matter-lock-codes | Aqara U400 Matter setup codes (all three)
> The 11-digit numeric pairing code under each QR (shown grouped like `XXXX-XXX-XXXX`). Capture all three — one per lock — labelled by door (Front, Side, Garage). If a lock ever needs a factory reset, you re-commission from these.

## Commission the locks into Home Assistant

### Add the first U400
With the OTBR up and the companion app open on a Bluetooth phone:

1. In the **Home Assistant companion app**, go to **Settings → Matter** and select **Add device**. (Matter and Thread moved out of *Devices & services* to their own top-level Settings entry in Home Assistant 2026.2.)
2. Scan the lock's **Matter QR code** (or tap to enter the numeric setup code by hand).
3. The phone commissions the lock over **Bluetooth**, hands it Home Assistant's **Thread credentials**, and the lock joins HA's Thread network. After a moment it appears in Home Assistant as a `lock.*` entity.
4. Assign it to the matching **Area** (Front Door, Side Door, Garage) and give it a clear name.

> [!WARNING]
> Do this from the **companion app**, not the desktop browser — the Matter add flow needs the phone's Bluetooth radio to reach the lock, and the Home Assistant VM has none.

> [!TIP]
> If the first join is slow, commission the lock **near the ZBT-2 Thread radio**, then move it to its door. Thread is a mesh, but the initial handshake is more reliable with a strong first hop.

### Repeat for all three
Run the same Matter add flow for the **second and third U400**, each with its own QR code, Area, and name. Each lock is its own round trip; there is no batch path. Confirm all three toggle from Home Assistant before moving on — a lock that misbehaves here will misbehave in every automation.

> [!NOTE]
> The physical keypad and key on the U400 keep working regardless of software — Home Assistant control is an *addition*, never a replacement for the ways you already open the door. (Home Key, the Apple-Wallet tap, is the one convenience that waits for the HomePod; the last section adds it.)

## Verify and hand off

### Test each lock
For each of the three U400s:

- **Home Assistant** — toggle the `lock.*` entity and watch the bolt move; confirm the state reports back correctly.
- **The door itself** — the keypad code and the physical key both still work.

> [!TIP]
> If a lock shows up but its state lags or goes *unavailable*, the Thread mesh is the usual cause — a sleepy battery device reaching a single border router. Move it closer to the ZBT-2 radio, reboot the OTBR app, or (the durable fix) add a mains-powered Thread router near it. Adding a HomePod later gives you a second border router, which generally clears this up.

### These locks now feed the automations
With all three U400s present as `lock.*` entities, they become raw material for the automation rules later in this build — auto-lock after a set time, an unlock notification to the household, and presence-based actions. Until the locks exist as entities, those rules have nothing to act on; now they do.

## Add Home Key later — when you add a HomePod

### Share each lock into Apple Home
**Home Key** (tap-to-unlock with an iPhone or Apple Watch) lives only in **Apple Home**, and adding a Thread lock to Apple Home needs an **Apple Thread border router** — a HomePod or Apple TV. You do not have one yet, so this waits until you do. When the HomePod arrives and is set up as a home hub, add Home Key without disturbing anything:

1. In Home Assistant, open the lock → its device page → **Add to another network / Share device** (Matter multi-admin). Home Assistant generates a **fresh, time-limited pairing code**.
2. In the Apple **Home** app, tap **+ → Add Accessory → More options**, and enter that fresh code. The lock joins Apple Home *alongside* Home Assistant — both control it locally over Thread, no cloud, no second pairing of the device itself.
3. Accept Apple's offer to set up **Home Key**. Repeat the share for the other two locks.

> [!NOTE]
> This is Matter multi-admin run in reverse of the usual write-up: because you commissioned into Home Assistant **first**, HA is the controller that hands out the share code and Apple Home comes in second. Home Assistant keeps full control throughout; the HomePod adds Home Key *and* a second Thread border router that strengthens the mesh for every battery Thread device in the house.

> [!WARNING]
> Keep all three Matter setup codes (the `matter-lock-codes` field above) and the Home Assistant owner credentials safe in your password manager (you consolidate these into Vaultwarden when you set it up later in the build). After a factory reset you re-commission a lock from its code — straight into Home Assistant, per this page.
