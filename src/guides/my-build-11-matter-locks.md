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
Your first **HA Connect ZBT-2** is busy running Zigbee2MQTT — and one radio cannot cleanly do Zigbee and Thread at once (the multi-protocol firmware is experimental and degrades both). So Thread gets its **own** ZBT-2. Plug a **second ZBT-2** into another rear USB port on its included 1.5 m USB-C cable (stand the antenna away from the case, and away from the first radio), then pass it to the Home Assistant OS VM — but **not** the way the first one was added. Both sticks report the identical USB ID `303a:831a`, so **Use USB Vendor/Device ID cannot tell them apart** and a second entry with the same ID may hand Proxmox the same physical stick twice. Select **Use USB Port** instead, which binds to the physical port and is unambiguous. To learn which port holds which stick, run this in the **Proxmox host shell**:

```bash
for d in /sys/bus/usb/devices/*; do
  [ -f "$d/idVendor" ] || continue
  [ "$(cat $d/idVendor)" = "303a" ] && [ "$(cat $d/idProduct)" = "831a" ] &&
    echo "port $(basename $d)  serial $(cat $d/serial 2>/dev/null)"
done
```

Match the serial already in Z2M's port setting to its port — that is the Zigbee radio, and the *other* port is the one to pass through now. Then reboot the VM. While here, switch the **first** stick's entry to port-based too if it is still bound by Vendor/Device ID (`grep usb /etc/pve/qemu-server/101.conf`), so a reboot can never shuffle which is which.

> [!NOTE]
> Inside Home Assistant the two sort themselves out regardless: each appears as its own `/dev/serial/by-id/usb-Nabu_Casa_ZBT-2_<serial>-if00` path, so Z2M keeps the radio it was configured against and OTBR takes the other. The serial in that path is the whole reason the guide insists on by-id rather than `ttyACM0`.

> [!WARNING]
> Two identical ZBT-2s are easy to mix up. Note which USB port each is on, and after the reboot confirm Zigbee2MQTT still sees *its* coordinator before you point Thread at the other one — do not let the OTBR app grab the Zigbee radio, or the whole mesh drops.

### Install the OpenThread Border Router app
In Home Assistant, go to **Settings → Apps → Install app**, install **OpenThread Border Router (OTBR)**, and in its configuration point it at the **second ZBT-2's device path** (not the Zigbee one). The two radios are identical hardware, so tell them apart by serial number: open **Settings → Apps → Zigbee2MQTT → Configuration** and note the `/dev/serial/by-id/usb-Nabu_Casa_ZBT-2_…` path it already uses — the OTBR gets the **other** `by-id` entry in its device dropdown. The rest of its options need no thought, but know why: **Baudrate `460800`** and **Hardware flow control on** for the same reason Z2M needs them — same hardware. **OTBR firewall on** (blocks traffic with no business crossing between Thread and the LAN). **NAT64 off** — it exists to give Thread devices a route to the IPv4 internet, and nothing here wants one: the locks and battery shades are commissioned into Home Assistant, not into Aqara's or SmartWings' clouds. **Beta off** — this radio carries the door locks. Leave the log level at `notice`; raise it to `debug` only while chasing a lock that will not commission.

Start it, then open **Settings → Devices & services → Thread**. What you see there depends on what else is already broadcasting Thread in the house, and this house has plenty.

### Join the existing Thread network rather than starting a third
The OTBR only forms its own `ha-thread-xxxx` network when it finds **no** existing Thread network. This house has two — **NEST-PAN-…** from the Google Nest Hub Max and **ST-TIZEN** from the Samsung Family Hub — so on first start the add-on **joins one of them instead**, and it appears nested under that network's card as an *OpenThread BorderRouter* at `localhost.local` (that hostname is how you spot your own add-on among the neighbours). The **Preferred network** panel stays empty, because Home Assistant can only mark a network preferred once it holds that network's credentials.

That is the right outcome — take it, do not fight it. Two things get conflated here and they are worth separating for good:

- The **Thread network** is the radio transport. It can be shared.
- The **Matter fabric** is who controls the device. That stays yours alone.

The locks commission into *Home Assistant's* Matter fabric no matter whose Thread network carries the packets; Matter payloads are encrypted end to end to your fabric, so Samsung gets no control of, and no visibility into, a lock. Sharing the transport costs nothing in local control — and it buys the one thing this build otherwise lacks: a **mains-powered Thread router**. Every Thread device here runs on batteries, so a network of your own would have zero relaying, one radio in the rack serving three locks at three separate doors. The Family Hub is mains-powered and already a border router, so joining it anchors the mesh a second time elsewhere in the house. Forming your own instead leaves two Thread meshes competing for the same 2.4 GHz airtime, neither relaying for the other.

### Converge on the network your phone already prefers
Which network the OTBR happened to join is **not** the one to standardise on. Standardise on the one your **phone** prefers, and move the border router to meet it. Two facts force this:

- The companion app hands Home Assistant the phone's *preferred* credentials only. A network the phone does not prefer cannot be imported — which makes "get the credentials for the network the OTBR joined" circular and unwinnable.
- Home Assistant's own docs concede the preferred-network feature is incomplete, and that **the phone's** preferred network is what gets used when commissioning Matter devices through the companion app. The phone wins regardless, so stop fighting it.

First, get the credentials off the phone. This happens in the **Home Assistant companion app** — **not** in the SmartThings or Google Home app. It reads the phone's operating-system credential locker (Apple's Thread store on iOS, Google Play Services on Android); the other ecosystem's app is only what published the network there earlier. Keep the phone on the **same Wi-Fi** as the border routers.

1. In the **Home Assistant companion app**, go to **Settings → Devices & services → Thread → Configure**.
2. On iOS select **Send credentials to Home Assistant**; on Android select **Import credentials** (lower right). If that stalls or does nothing, the route widely reported as more reliable is **Settings → Companion app → Troubleshooting → Sync Thread credentials**.
3. Back in the **browser** at `192.168.1.51:8123`, refresh the Thread panel. Exactly one network now offers **Make preferred network** — that is the one the phone prefers. Press it and wait 30–60 seconds.
4. Now move the border router to it. On your own OTBR's row — the one whose hostname is `localhost.local` — open the **⋮** menu and select **Add to my network**, then confirm. That writes the preferred network's dataset onto the radio, moving it off whatever it originally joined.

Order matters: **Add to my network** means "join whatever is preferred right now," so the preferred network has to be set first. When it finishes, the panel should list your OTBR nested under the preferred network alongside that ecosystem's border router.

> [!WARNING]
> The same **⋮** menu offers **Reset border router**, which sounds like the tool for this job and is not. It erases the radio's configuration and forms a **brand-new** Thread network — the fast route to Home Assistant trying to commission onto a network name that no longer exists, a state that survives reinstalls and has been [reported and closed as not planned](https://github.com/home-assistant/core/issues/162401). Use **Add to my network**. Leave **Reset border router** alone.

> [!TIP]
> **"You don't have any credentials to import"** means the phone's OS locker holds nothing, not that anything is broken. Open the other ecosystem's app once on that same phone — **SmartThings** or **Google Home** — so it publishes its network to the locker, then run the sync again. On Android, clearing Google Play Services' cache is the other fix that keeps working for people.

> [!WARNING]
> Home Assistant's own documentation is candid that the preferred-network feature **is not fully implemented**: when you add a Matter device through the companion app, *the phone's* preferred network is used, not Home Assistant's. With a Nest Hub Max in the house, an Android phone may well prefer **NEST-PAN** through Google Play Services — and your locks would land on a network your border router is not on. Once the preferred network is set, use **Send credentials to phone** at the foot of the preferred-network section so both sides agree, **before** you scan the first lock.

> [!NOTE]
> Running the border router yourself is the piece a HomePod would otherwise provide, and it keeps control local and visible. Know the shape of the mesh regardless: only **mains-powered** Thread devices become Thread *routers* that relay, and every Thread device in this build is **battery-powered** — the locks and the battery shades. (The Third Reality plugs cannot fill the gap; they are Zigbee/BLE, not Thread. Nor can the PoE shades — Matter-over-Ethernet devices never join the Thread mesh.) Joining the Family Hub's network is what gives you a relay today; a **HomePod** later, or any mains-powered Matter-over-Thread device near a problem door, adds more. Plan around it — commission Thread devices within solid range of a border router. The consolation is that most of this build's Matter devices (the **PoE shades**, wired over Ethernet) are not on Thread at all, so the mesh's footprint stays light.

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
