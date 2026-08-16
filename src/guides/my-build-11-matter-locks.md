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

### Flash the second ZBT-2 for Thread — do not install the app by hand
A ZBT-2 ships with **Zigbee (ember) firmware**, and it cannot run Zigbee and Thread at once — Nabu Casa dropped multiprotocol over stability problems. Acting as a border router means flashing **OpenThread RCP** firmware onto the stick. Installing the OpenThread Border Router app manually and pointing it at an unflashed radio does not work: the app cannot speak to an ember-firmware stick and lands in **Error** on every start, with no obvious clue why.

Use the wizard, which flashes the firmware *and* installs and configures the app for you. In Home Assistant, go to **Settings → Devices & services**. Where you go next depends on whether the adapter has been set up as an integration yet:

- **Under "Discovered"** — which is where both sticks sit on this build, since Zigbee2MQTT drives its radio through a serial path rather than an integration — press **Add** on the card, then **Use as Thread adapter** in the *Pick your protocol* dialog.
- **Already configured** — select the entry's **cog wheel** and choose **Use as Thread adapter**.

Never choose **Use as Zigbee adapter** on either stick. That sets up **ZHA**, Home Assistant's own Zigbee stack and a direct competitor to Zigbee2MQTT — only one process can hold a radio's serial port, and this build runs Z2M. The Zigbee stick's card is meant to sit in Discovered untouched.

#### Work out which stick you are flashing, by elimination
The *Pick your protocol* dialog names no serial and no port, and both discovery cards read **Home Assistant Connect ZBT-2** with nothing to separate them. Do not guess — establish it, without ever taking the Zigbee radio away from Z2M:

1. Close the dialog and **unplug one ZBT-2** at the server.
2. Reload **Settings → Devices & services**. One ZBT-2 card disappears — that is the stick you pulled.
3. Check **Zigbee2MQTT**. If it is still running with its devices online, you pulled the **Thread** stick, and the card still on screen is the **Zigbee** one. (If Z2M went down instead, you pulled the Zigbee stick: return it to the same port and pull the other.)
4. Press **Ignore** on that remaining card. It is the Zigbee radio, Z2M owns it, and ignoring it is what you wanted regardless.
5. Plug the Thread stick back into **the same USB port** it came out of — passthrough is port-based (`host=1-5` / `host=1-6`), so the port matters.
6. Exactly one ZBT-2 card returns, and it can only be the Thread one. **Add → Use as Thread adapter.**

It takes a few minutes to flash and configure.

> [!WARNING]
> **Confirm the serial before you start.** This writes Thread-only firmware, and that adapter can never run Zigbee again. Two identical ZBT-2s are plugged in and **both discovery cards carry the same name with nothing to tell them apart** — flashing the Zigbee one destroys your coordinator, and every plug, leak sensor, and the valve drops off and needs re-pairing from scratch. Open the dialog and stop at the first screen: nothing is flashed until you pick Thread and confirm, so reading it is safe. Compare what it identifies against the `/dev/serial/by-id/usb-Nabu_Casa_ZBT-2_…` path already in **Settings → Apps → Zigbee2MQTT → Configuration** — that serial is the Zigbee radio and is the one you must **not** touch. If the dialog does not name the device clearly, back out and map the ports from the **Proxmox host shell** with the loop earlier on this page, which is unambiguous. Zigbee2MQTT holding its serial port open may block a wrong choice, but that is luck, not a safeguard.

Once it finishes, **Settings → Devices & services** shows both the **OpenThread Border Router** and **Thread** integrations. The app's options are already correct, but know why: **Baudrate `460800`** and **Hardware flow control on** for the same reason Z2M needs them — same hardware. **OTBR firewall on** (blocks traffic with no business crossing between Thread and the LAN). **NAT64 off** — it exists to give Thread devices a route to the IPv4 internet, and nothing here wants one: the locks and battery shades are commissioned into Home Assistant, not into Aqara's or SmartWings' clouds. **Beta off** — this radio carries the door locks. Leave the log level at `notice`; raise it to `debug` only while chasing a lock that will not commission.

Then open **Settings → Devices & services → Thread**. What you see there depends on what else is already broadcasting Thread in the house, and this house has plenty.

> [!TIP]
> If the app sits in **Error** under **Settings → Apps**, check its **Log** tab — but the first thing to suspect is firmware, not configuration. An unflashed stick is the common cause, and it also explains a missing **⋮** menu on your own border router's row in the Thread panel: that menu only appears when Home Assistant holds a dataset for the network *or* has live OTBR info for that router, and a dead app supplies neither.

### Own the network — do this before you commission anything
The OTBR only forms its own `ha-thread-xxxx` network when it finds **no** existing Thread network. This house has two — **NEST-PAN-…** from the Google Nest Hub Max and **ST-TIZEN** from the Samsung Family Hub — so on first start the add-on **joins one of them instead**, and appears nested under that network's card as an *OpenThread BorderRouter* at `localhost.local` (that hostname is how you spot your own add-on among the neighbours). The **Preferred network** panel stays empty, because Home Assistant can only mark a network preferred once it holds that network's credentials.

Do not accept that. **Form your own network and make it the one everything else answers to.** The alternative — commissioning the locks onto Google's or Samsung's mesh — works fine today and costs a **factory reset of all three U400s** the day you want out, because a commissioned Matter device cannot be moved between Thread networks without re-commissioning. Doing this before the first QR scan costs nothing; doing it later costs an evening.

Separate two things that get conflated, because the answer turns on them:

- The **Thread network** is the radio transport. It *can* be shared, and sharing it is not a security failure — Matter payloads are encrypted end to end to Home Assistant's fabric, so a foreign border router can neither read nor operate a lock.
- The **Matter fabric** is who controls the device. That is yours either way.

So the case for joining someone else's mesh was never about control — it was about borrowing a **mains-powered Thread router**. Every Thread device in this build runs on batteries (the locks, the battery shades), and only mains-powered devices become Thread routers that relay. But you can buy that outright for $25–40 — an Eve Energy plug, a Nanoleaf Essentials bulb, any mains-powered Matter-over-Thread device — commission it onto **your** network, and it relays for your locks forever. That is worth vastly more than a dependency on two vendors who each want to be the hub.

> [!NOTE]
> The obvious idea — make the ZBT-2 the main network and have the Nest and Samsung hubs join it as nodes — is architecturally correct and mostly blocked by the vendors. **Google will not join**: its Play Services API is documented for border-router *vendors*, and Google Home exposes no user-facing option to make a Nest hub adopt another ecosystem's network. It stays an island. **Samsung might**: SmartThings shipped a **Manage Thread Network** menu in hub settings (app 1.7.37 iOS / 1.8.37 Android, hub firmware 0.58.10) that lists networks to join — but the published hardware list covers the SmartThings v2/v3 and Aeotec hubs and does not name **Family Hub** refrigerators. Check yours in the **SmartThings app** before assuming either way. Nothing here blocks the plan below; a hub that can join is a bonus router, not a prerequisite.

### Form the network and point everything at it
Work in the **browser** at `192.168.1.51:8123`, **Settings → Devices & services → Thread**.

1. Check where your border router landed. Flashed through the **Use as Thread adapter** wizard it usually forms its own network and marks it preferred unasked — look for a **`ha-thread-…`** card sitting *above* the **Other networks** heading, holding a router named **Home Assistant OpenThread Border Router** at `homeassistant-otbr.local`. If that is what you see, steps 1 and 2 are already done; go to step 3.
2. Otherwise, on your own OTBR's row open the **⋮** menu and select **Reset border router** — this erases the radio's configuration and forms a **brand-new** Thread network, which is what you want here — then select **Make preferred network** on the `ha-thread-…` card that appears and wait 30–60 seconds. Do not assume the automatic case: the ZBT-2's network is [not always auto-selected as preferred](https://github.com/home-assistant/core/issues/165279).
3. Hand the network to your phone, so it stops defaulting to a neighbouring one. **This cannot be done from a desktop browser** — **Send credentials to phone** is gated on a keychain capability only the companion app exposes, and simply does not render anywhere else. Open the same **Thread** panel in the **Home Assistant companion app** on your phone; the button sits at the foot of the preferred network's card, below its border router.

> [!NOTE]
> A small phone-and-key icon beside a router's name marks it as that network's **default router** — on a single-router network, just your own radio. Expect a **stale row** as well: a border router you have reset or reflashed lingers under its old network for a while, because the panel builds rows from live mDNS rather than from the OTBR integration. It ages out on its own.

> [!WARNING]
> **Reset border router** is the right tool *only* when you intend to form a new network, as here. Reaching for it to move a radio onto an **existing** network is how people end up with Home Assistant commissioning against a network name that no longer exists — a state that survives reinstalls and has been [reported and closed as not planned](https://github.com/home-assistant/core/issues/162401). To join an existing network, the correct action on that same **⋮** menu is **Add to my network**, which writes the currently-preferred network's dataset onto the radio.

> [!WARNING]
> Home Assistant's own docs concede the preferred-network feature **is not fully implemented**: when adding a Matter device through the companion app, *the phone's* preferred network is used, not Home Assistant's — and it is not documented that **Send credentials to phone** promotes yours to preferred rather than merely storing it. So commission **one** lock first and confirm in the Thread panel that it landed on your network before doing the other two. With a Nest Hub Max in the house this is a live risk, not a theoretical one.

### If you ever do want to join an existing network instead
Credentials have to come from the phone, and the direction is fixed: the **Home Assistant companion app** reads the phone's operating-system credential locker (Apple's Thread store on iOS, Google Play Services on Android). The SmartThings or Google Home app is only what published a network there earlier — you never import from it directly. Keep the phone on the **same Wi-Fi** as the border routers.

1. In the **Home Assistant companion app**, go to **Settings → Devices & services → Thread → Configure**.
2. On iOS select **Send credentials to Home Assistant**; on Android select **Import credentials** (lower right). If that stalls, the route widely reported as more reliable is **Settings → Companion app → Troubleshooting → Sync Thread credentials**.
3. Back in the **browser**, refresh the Thread panel. Exactly one network offers **Make preferred network** — the one the phone prefers, since the app exports only the phone's *preferred* credentials. Press it.
4. On your OTBR's row, **⋮ → Add to my network** to move the radio onto it.

> [!TIP]
> **"You don't have any credentials to import"** means the phone's OS locker holds nothing, not that anything is broken. Open the other ecosystem's app once on that same phone — **SmartThings** or **Google Home** — so it publishes its network to the locker, then run the sync again. On Android, clearing Google Play Services' cache is the other fix that keeps working for people.

### What happens if you drop that ecosystem later
Nothing breaks, and this is structural rather than a promise anyone made you. A Thread network is not owned by a border router — it **is** a dataset (network name, extended PAN ID, network key, channel), and once **Add to my network** runs, your OTBR holds a full copy. Unplug the Nest Hub Max or the Family Hub and your radio keeps operating the network, becomes leader, and every lock stays joined. Nothing is re-paired. The network keeps its original name forever, which is cosmetic and the entire cost.

What you would actually lose is the **mains-powered relay** — back to a single anchor in the rack serving battery locks at three separate doors. That is the real dependency, not the credentials.

Be equally clear about what it costs while that ecosystem *is* present: its border router holds the Thread network key, so it can see link-layer traffic on the mesh. Matter payloads stay encrypted end to end to Home Assistant's fabric, so it can neither read nor operate a lock — but that is not nothing. Weighed against a mesh with no relaying at all, across three doors, the relay is still the better trade.

The exit, if you ever want one, is a factory reset of each U400 and a re-commission onto a network you form yourself — which is precisely what the `matter-lock-codes` field below is insurance for. Three locks, three QR codes. The moment to spend that time is when you have a **mains-powered Thread device of your own** to act as a router, so you are not swapping a working mesh for a principled but weaker one.

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
