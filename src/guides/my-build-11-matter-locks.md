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

Once it finishes, **Settings → Devices & services** shows both the **OpenThread Border Router** and **Thread** integrations. The app's options are already correct — one per line, with the why:

- **Baudrate** → **460800** — same hardware as Z2M's radio, same rate
- **Hardware flow control** → **on** — same reason
- **OTBR firewall** → **on** — blocks traffic with no business crossing between Thread and the LAN
- **NAT64** → **off** — it exists to give Thread devices a route to the IPv4 internet, and nothing here wants one: the locks and battery shades are commissioned into Home Assistant, not into Aqara's or SmartWings' clouds
- **OpenThread Border Router agent log level** → **notice** — raise to `debug` only while chasing a lock that will not commission
- **Beta** → **off** — this radio carries the door locks

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
Two very different situations get confused here, so be clear which one you are in. **If your border router joined their network**, nothing breaks — the case described below. **If instead your border router runs its own network but the locks commissioned onto theirs** — the state this build landed in on the first attempt — the dependency is real and per-lock: unplug the Nest Hub Max and the lock on NEST-PAN has no path home, whatever your own radio is doing. It is survivable rather than catastrophic (the keypad and key are unaffected, and re-commissioning is twenty minutes with the saved codes), but it is a single point of failure you do not own, sitting in someone else's product roadmap. The fix is the same either way: mains-powered Thread routers on your own network, then re-commission.

For the case where your border router did join their network:

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

> [!NOTE]
> **This is the page it is fine to pause.** The border-router half above is done once and keeps; the lock half below waits on hardware — the five Thread plugs ship from IKEA. Nothing between here and the Automations page depends on the locks, so the intended path while the box is in transit is to continue straight into **Cameras, Doorbell & Frigate** and return here when the plugs arrive. Locks commissioned before the mesh has routers end up on the neighbours' networks — this build proved it so you do not have to.

Five things need to be true before you touch a lock:

- The **Home Assistant OS VM** is up, with the **Matter** integration available (it ships with Home Assistant) and the **OTBR** running from the step above.
- The **Matter Server** app is **up to date**. Check **Settings → Apps** for an *Update available* badge on it and clear it before you commission anything — the Matter integration refuses to add devices when the server is behind the version it expects, and the failure names the version rather than the cause. Updating is cheap while no devices are commissioned yet.
- You have an **iPhone or Android phone with Bluetooth on**, signed in to the **Home Assistant companion app**. Commissioning a Matter device happens over Bluetooth from a phone — the HA web UI alone cannot do it, which surprises people running HA in a VM with no Bluetooth. The phone bridges that gap and hands the device HA's Thread credentials.
- **Five mains-powered Matter-over-Thread plugs are commissioned and placed**, forming a mesh that reaches every door. This is a prerequisite, not an upgrade — see the warning under *Add the first U400*. The Thread Group's own guidance is one router-capable device per **300–400 sq ft**, or three to four for a typical 1,500 sq ft home; a basement door needs its own, since floor assemblies eat 2.4 GHz. The **IKEA GRILLPLATS plug** at **$7.99** is the buy, and it is not close. IKEA's own page states *"This product uses Matter over Thread, which means that you need a Thread Border Router"* — you have one, so the DIRIGERA hub it suggests is irrelevant here — and it includes **energy metering**, which was the main thing justifying pricier plugs. **Five** covers this house for about $40 — one near the rack, one on the path toward the carport, one by the front door, one at the top of the basement stairs, and one near the sliding glass door so the contact sensor there has a hop of its own. A $14.99 variant adds a physical remote; skip it, since these are driven from Home Assistant.

**Eve Energy (Matter)** at roughly $40 remains the fallback if IKEA is out of stock or inconvenient — reliably carried by Amazon and the Apple Store, sold by Apple as a 2-pack, and unambiguous on the box, with per-device power logging and a Thread mesh diagnostics view in its app. Nanoleaf's Smart Outlet and Wemo's Thread plug look cheaper on paper but stock is erratic, and a plug you cannot buy saves nothing.

Three rules matter more than any product list, which will be stale within a year:

- **The listing must say Thread**, usually alongside *"Thread Border Router required."* If it says *"2.4G Wi-Fi only"* it is useless here whatever the Matter badge claims. **TP-Link Tapo is the trap to watch** — the entire Matter line (P125M, P400M) is Wi-Fi. So are Nanoleaf's **newer** Essentials bulbs, where older ones were Thread; the badge is identical and only the fine print differs.
- **Prefer plugs over bulbs.** A bulb stops routing the moment someone flips the wall switch — a miserable intermittent fault to chase.
- **Per-device energy monitoring is a bonus, not a reason to buy.** Rack-level draw already arrives free over **NUT** from the CyberPower UPS on the *UPS & Safe Shutdown* page.
- Each lock is **physically installed and powered** — the U400's rechargeable lithium pack charged (it takes USB-C, not disposable cells) and seated, the door able to throw the bolt.

> [!NOTE]
> [!WARNING]
> Battery-powered Thread devices are **end devices**, never routers — they consume mesh capacity and depend on routers without extending anything. That covers every sensor in IKEA's cheap Matter line (**MYGGBETT** door/window, **MYGGSPRAY** motion, **KLIPPBOK** leak, **TIMMERFLOTTE** climate) as well as the battery shades and the locks themselves. Buy the **GRILLPLATS plugs first**; add battery sensors to a mesh that already has routers, never before.

> [!NOTE]
> Nothing already in this house can stand in for those plugs, so do not go looking. The **Third Reality** plugs are Zigbee/BLE. The **PoE shades** are Matter-over-Ethernet and never join a Thread mesh. The **Nest Hub Max** and **Family Hub** will not join your network. And the **ecobee thermostats** are out too — ecobee's own connectivity spec for the Smart Thermostat Premium lists dual-band Wi-Fi, Bluetooth 5.0 and a 915 MHz radio (that one drives ecobee's SmartSensors), with no Thread and no Matter; any Thread support ecobee ever exposes is **HomeKit over Thread**, which lands on an Apple network rather than yours.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51
> The address the Home Assistant companion app points at.

### Commission the Thread plugs, working outward
The plugs are **Matter over Thread**, so they commission the same way the locks do below — from the **companion app over Bluetooth**. They do *not* go through Zigbee2MQTT; that is the Third Reality plugs' path, a different radio entirely, and nothing about the Zigbee pairing flow applies here.

What differs from the locks is the **order**. Each plug you commission becomes a **router** the next one can reach through, so work **outward from the ZBT-2** — nearest first, each one plugged into its final outlet *before* you add it, so what you commission is what you keep. The five spots, in order:

1. **Near the rack** — comfortably inside the ZBT-2's range
2. **On the path toward the carport**
3. **By the front door**
4. **At the top of the basement stairs** — floor assemblies eat 2.4 GHz, so this one is not optional
5. **Near the sliding glass door** — it gives the MYGGBETT contact sensor a hop of its own

For each plug, in turn:

1. Plug it into its final outlet and let it power up.
2. In the **Home Assistant companion app**, go to **Settings → Matter** and select **Add device**.
3. Scan the plug's **Matter QR code** — on the plug body and on the quick-start leaflet. Record the numeric code below before the leaflet goes in a drawer.
4. The phone commissions it over **Bluetooth** and hands it Home Assistant's **Thread credentials**. It lands as a `switch.*` entity with energy sensors alongside.
5. Give it a clear name and assign it an **Area**.

> [!SECRET] matter-plug-codes | IKEA GRILLPLATS Matter setup codes (all five)
> The 11-digit numeric code under each plug's QR, labelled by placement. Re-commissioning a plug after a reset needs these.

> [!WARNING]
> **Check the first plug's network before commissioning the other four.** Plugs join whatever mesh they can hear exactly as the locks do — and a plug that lands on **NEST-PAN** or **ST-TIZEN** is routing for the neighbours, not for you, while looking perfectly healthy in the device list. Open **Matter Server** in the sidebar, select the new node, scroll to **Endpoints**, and open **Endpoint 0** — the root endpoint (*Ota Requestor*); its siblings are the plug's switch and energy meter, and the network clusters live only on 0. Inside it, expand **Thread Network Diagnostics** (cluster `0x0035`) and read **NetworkName**: it must be your **`ha-thread-…`** network.

Two neighbours of that attribute explain themselves badly, so read them together:

- **RoutingRole** — the Matter enum is `0 Unspecified · 1 Unassigned · 2 SleepyEndDevice · 3 EndDevice · 4 REED · 5 Router · 6 Leader`. A fresh plug usually reads **4 (REED)** — *router-eligible*, not yet promoted. That is not a fault: Thread's Leader promotes REEDs only when the mesh needs routers, and on the first plug there is nothing to route for yet. Expect **5 (Router)** once the other plugs are up and the locks have moved over
- **NeighborTable** — empty `[ ]` on that same first plug, for the same reason; it fills as the mesh grows If it is not, fix the phone's credentials (the *Send credentials to phone* step above) and re-commission that plug before going further.

> [!TIP]
> A plug that refuses to commission, or that lands on the wrong network, is the mesh telling you where its edge is — the fix is a plug *between* it and the last working one, not a stubborn retry at the same spot. That is the whole reason for working outward.

> [!DETAILS] Why the order matters — and where it does not
> The finished **mesh** is order-independent: Thread routers discover each other and re-route continuously, so a plug added later automatically improves the path of one added earlier, and end devices re-parent onto a better neighbour by themselves. Nothing ever needs re-commissioning to fix topology.
>
> The **commissioning event** is the part that cares. A plug commissioned far from every router has three outcomes: it fails to attach (harmless — retry once the nearer ones are up), it joins your network on a thin link (fine, and self-healing), or it **joins a neighbour's network** — because the device reports the networks it can actually hear and the commissioner picks from that list, so a plug that hears NEST-PAN clearly and yours not at all lands on Google's mesh with your credentials sitting unused on the phone. That third case is the expensive one: **a device keeps the network it joined**, so adding closer plugs afterwards cannot rescue it — only deleting and re-commissioning will.
>
> Fallback when a plug will not take at its intended outlet: commission it **beside the ZBT-2**, where your network is unmistakably the loudest, then carry it to its real outlet. It keeps your network and re-attaches — and if it goes dark there instead, that is clean information rather than a mystery: the gap is real, and that outlet needs a hop before it.

> [!TIP]
> **The blunt instrument that ends the argument: unplug the competition.** Power off the **Nest Hub Max** and the **Family Hub** for the duration of the commissioning session and their Thread networks simply are not there to be chosen — every device hears exactly one network and joins it. This build did that and put the whole fleet on `ha-thread-…` in a single pass, after an earlier attempt scattered locks across two neighbouring meshes.
>
> Putting them back afterwards is safe, and worth understanding why: a commissioned device **keeps the network it joined**, holding that network's key, so when the hubs return they re-form their own networks as separate partitions and nothing migrates. What returns is spectrum contention, not conflict — check your Thread **Channel** against the Zigbee coordinator's if you ever chase latency, since both are 802.15.4 on 2.4 GHz.
>
> Verify while the air is still clean, though: with the neighbours dark, walk every node's **NetworkName** in one pass — locks, plugs, sensor. And know the risk that survives: the phone still holds their credentials, so the *next* Matter-over-Thread device can still land on their mesh. Either check NetworkName after every future commissioning, or pull the plugs again for the session.

> [!TIP]
> **A plug that commissioned fine but then stops updating** has almost always hit that same edge from the other side: commissioning ran over **Bluetooth from the phone standing beside it**, while everything afterwards runs over **Thread from the ZBT-2 in the rack** — so a join can succeed on a radio that is not the one doing the work. Confirm it with the companion app's **Ping** on the device page: *"Ping device complete"* only means the operation finished, and a **red `!`** beside the address means that address never answered. Then work the ladder — power-cycle the plug (ten seconds unplugged; a REED re-attaches on power-up), re-ping; if it still fails, move it to an outlet near the ZBT-2 and ping there, which separates range from routing; if it fails even beside the radio, restart the **OpenThread Border Router** app and confirm **Settings → Thread** still shows your `ha-thread-…` card with `homeassistant-otbr.local` under it.

Once all five are up and verified, the battery **MYGGBETT** contact sensor for the sliding glass door commissions the same way — end devices belong on a mesh that already has routers, never before it. The Automations page expects it renamed to `binary_sensor.sliding_door`.

> [!WARNING]
> **Do not diagnose the battery sensor with Ping.** As a Thread *sleepy end device* it keeps its radio off between check-ins, so the companion app's Ping fails against it even when it is perfectly healthy — a red `!` there means nothing. Test it by **triggering it**: separate the magnet and watch the entity move. Its **RoutingRole** correctly reads **`2` (SleepyEndDevice)**, never the `5` a plug should reach. And if it was commissioned before its nearby plug existed, it has no parent to attach to — once that plug is up, **pull the sensor's battery for ten seconds and reseat it** so it hunts for a parent again. Thread re-parents inside the same network on its own, so this needs no re-commissioning; only a wrong **NetworkName** does.

### Find each lock's QR setup code
Every U400 has a **Matter QR code** — on a sticker inside the battery compartment, on the quick-start card, and usually a peel-off duplicate for your records. You scan each one **once**, into Home Assistant. Record all three now so this checklist stands on its own, and keep them in your password manager (you consolidate these into Vaultwarden later in the build) — you re-commission from them after any factory reset.

> [!SECRET] matter-lock-codes | Aqara U400 Matter setup codes (all three)
> The 11-digit numeric pairing code under each QR (shown grouped like `XXXX-XXX-XXXX`). Capture all three — one per lock — labelled by door (Carport, Front, Basement). If a lock ever needs a factory reset, you re-commission from these.

## Commission the locks into Home Assistant

### If a lock is already paired to another app, reset it first
These locks may already be commissioned — to **Aqara Home**, **SmartThings**, or both — from an earlier setup. That changes what you can do, in two ways:

- **The QR code on the sticker will not work.** A Matter setup code commissions a device *once*. After that the device leaves commissioning mode, and adding a second controller requires a fresh, time-limited code minted by the existing admin through its own share flow. The sticker is dead until the lock is reset — at which point it works again, which is exactly why you keep it.
- **Sharing into Home Assistant would not move the lock onto your network.** Multi-admin adds a *controller*; it never re-runs network commissioning. A lock commissioned by SmartThings or Aqara joined whatever Thread network *they* used, and it stays there. Home Assistant would still control it, routed through that foreign border router — but your own radio would serve nothing, and the network you just built would be decorative.

**Find every fabric before you remove anything.** A lock can belong to more than one ecosystem at once — that is the whole point of Matter multi-admin — so removing it from one app frequently leaves another behind, and one surviving fabric is enough to keep the sticker code dead. Open the lock in **Aqara Home** and find its **Matter** screen: that list of connected ecosystems is the authoritative inventory, and on this build the locks turned out to be spread across **Google/Nest** and **SmartThings**, some in both. Check whether that screen lets you remove the entries directly — if it does, it is one place instead of three. Note also what is *absent*: Aqara Home itself holds no Matter fabric, so its binding, your keypad codes, and the calibration are never at risk here.

Work through the list app by app — the **SmartThings app** for SmartThings entries, the **Google Home app** for Nest ones — then come back to the Aqara **Matter** screen and confirm **nothing remains listed**. That empty list is the gate to commissioning.

A full factory reset is the certain fix, but **try dropping just the Matter fabrics first** — it keeps the lock's calibration, its keypad codes, and its Aqara Home binding. Removing the lock from **SmartThings** removes SmartThings' fabric alone, and once a Matter device leaves its *last* fabric its network credentials become unusable and it returns to a commissionable state. Aqara Home is untouched by that, because Aqara's binding is its own thing over Bluetooth/UWB rather than a Matter fabric.

One caveat keeps this from being a guarantee: the last-fabric behaviour is **vendor-configurable**, so Aqara may not clear Thread cleanly. A single test settles both — delete the lock in the **SmartThings app**, then scan the **Matter Pairing Code** from the inner panel in the **Home Assistant companion app** under **Settings → Matter → Add device**. If it commissions, the lock was genuinely commissionable and Home Assistant has just provisioned *your* Thread network. If it refuses as already commissioned, a fabric survived and that lock needs the reset after all.

### Two QR codes, and why Aqara Home is worth keeping
The battery compartment holds **two different codes**, and they are not interchangeable:

- **Magicpair Code** — binds the lock to **Aqara Home**, Aqara's own account binding.
- **Matter Pairing Code** — commissions the lock into a **Matter fabric**.

Aqara Home is optional, but the manual is blunt about the cost of skipping it: *"unique features such as Night Latch mode, Auto-Lock settings and more will be unavailable to you."* Those are firmware features that keep working with the network down, so they are worth having alongside Home Assistant's automations rather than instead of them. Aqara Home is also the practical route for **firmware updates**.

The key fact that makes both possible: a lock receives Thread credentials **only when it is commissioned into a Matter fabric**. Binding to Aqara Home is not that — absent an Aqara Thread hub it puts the lock on nobody's mesh. So run them in this order:

1. **Send credentials to phone first**, before touching any lock. This is the insurance: whichever app performs the Matter commissioning, the phone hands out *your* network.
2. **Factory reset** the lock.
3. **Bind to Aqara Home** with the **Magicpair Code** — Night Latch, Auto-Lock, firmware updates.
4. In Aqara Home, open the lock → **Matter** → **Matter Pairing Code** to generate a code, then use it in the **Home Assistant companion app** under **Settings → Matter → Add device**. This step is what provisions Thread, from Home Assistant, onto your network.
5. **Do not let SmartThings commission it.** If you want it there afterwards, share out from Home Assistant — sharing leaves the Thread network alone.

If Aqara Home proves awkward, the direct route is to press **Set** once to enter pairing mode and scan the **Matter Pairing Code** on the inner panel straight from the Home Assistant app — at the cost of those firmware features. Either way, confirm on **lock one** which network it landed on before doing the other two.

> [!WARNING]
> To reset a U400, open the **battery compartment** on the inner panel and **long-press the Reset button for 5 seconds** — it sits directly below the **Set** button, and it is a single button, not a combination (forum posts describing a Reset+Set chord or a 10-second hold are wrong). Expect the lock to want **re-calibration** afterwards (bolt direction and travel) and expect to re-enter keypad codes.

### Add the first U400
With the OTBR up and the companion app open on a Bluetooth phone:

1. In the **Home Assistant companion app**, go to **Settings → Matter** and select **Add device**. (Matter and Thread moved out of *Devices & services* to their own top-level Settings entry in Home Assistant 2026.2.)
2. **Press the lock's Set button once** to put it into pairing mode — a single press, in the battery compartment above Reset. A lock that is not factory-fresh does *not* advertise on its own, and removing it from another ecosystem does not start it advertising either. Skip this and the phone reports **"Unable to Add Accessory — you may need to restart your accessory"**, which names the symptom rather than the cause.
3. Scan the lock's **Matter Pairing Code** — the lower of the two QR codes in the battery compartment, *not* the Magicpair code above it — or tap to enter the numeric setup code by hand. Do it promptly: the commissioning window is time-limited. Keep the phone within a couple of feet of the lock with Bluetooth on, since commissioning runs over BLE before Thread is involved.
4. The phone commissions the lock over **Bluetooth**, hands it Home Assistant's **Thread credentials**, and the lock joins HA's Thread network. After a moment it appears in Home Assistant as a `lock.*` entity.
5. Assign it to the matching **Area** — **Carport Door**, **Front Door**, or **Basement Door** — and give it a clear name.

> [!WARNING]
> Do this from the **companion app**, not the desktop browser — the Matter add flow needs the phone's Bluetooth radio to reach the lock, and the Home Assistant VM has none.

> [!WARNING]
> **Check Settings → Devices & services → Devices before retrying a failed add.** The phone can report **"Unable to Add Accessory"** *after* commissioning has already succeeded, and blindly retrying risks commissioning the same lock twice. If the lock is listed there under the **Matter** integration, it worked — close the dialog and move on.

> [!TIP]
> **"Unable to Add Accessory"** usually means the lock is not advertising. Press **Set** once and rescan immediately. If that fails, pull a battery for ten seconds, reseat it, press **Set**, and try again. If it still refuses, a Matter fabric survived somewhere and the sticker code is dead — generate a fresh one from **Aqara Home → the lock → Matter → Matter Pairing Code**. A factory reset is the last resort, not the first.

> [!WARNING]
> **Mesh coverage must exist at the door before you commission, or the lock joins a neighbour's network instead.** During commissioning the device scans and reports the Thread networks it can actually *hear*, and the commissioner picks from that list — so credentials are not enough. On this build the first attempt put the Carport lock on **NEST-PAN** and the Basement lock on **ST-TIZEN**, with the right credentials on the phone the whole time, purely because a single radio in the server rack was inaudible at both doors while the Nest Hub Max and the Family Hub were not. Published guidance puts the border router within roughly **30 feet** of the device for a reliable join. Do not try to force the issue either: a lock that cannot hear your border router goes *unavailable*, so you would trade a working lock on someone else's mesh for a dead one on yours. Commission the mains-powered Thread routers **first**, working outward from the radio, and only then the locks. Moving a lock after commissioning does not help — it keeps the network it joined.

### Repeat for all three
Run the same Matter add flow for the **second and third U400**, each with its own QR code, Area, and name. Each lock is its own round trip; there is no batch path. Confirm all three toggle from Home Assistant before moving on — a lock that misbehaves here will misbehave in every automation.

> [!NOTE]
> The physical keypad and key on the U400 keep working regardless of software — Home Assistant control is an *addition*, never a replacement for the ways you already open the door. (Home Key, the Apple-Wallet tap, is the one convenience that waits for the HomePod; the last section adds it.)

## Verify and hand off

### Re-commissioning a lock that joined the wrong network
Once coverage reaches the door, moving a lock onto your own network is a re-commission — there is no migration path for an already-commissioned Matter device. It is short, though, provided the foreign ecosystems no longer hold fabrics: Home Assistant is then the only one. For each lock, open its **device page**, delete it, press the lock's **Set** button once, and add it again from the companion app. Check **Network name** before starting the next one.

### Confirm they landed on your Thread network
A lock that commissioned onto a neighbouring mesh looks identical in the device list, so check rather than assume — this is the one thing the whole border-router exercise was for. Open **Matter Server** in the sidebar and select the lock's node, then scroll past Node Info to **Endpoints** and open **Endpoint 0** — the root endpoint, where every network cluster lives (the higher-numbered endpoints are the device's own functions, the lock itself among them). Expand **Thread Network Diagnostics** (cluster `0x0035`): its **NetworkName** attribute names the mesh the lock actually joined. The **Show in graph** button beside the node title draws the same relationship visually if you prefer it.

Do not confuse this with the gear-icon **Settings** dialog on that page: its *Network credentials* section, showing WiFi and Thread as **Not configured / DEFAULT**, is what the server hands *out* when commissioning future devices — DEFAULT there means "use Home Assistant's own Thread network", which is exactly right, and it says nothing about where an existing device landed. It should read your **`ha-thread-…`** network. If it reads a neighbouring network instead, the phone's preferred network won during commissioning — fix the phone's credentials and re-commission that lock.

**Check all three, not one.** Locks added back to back do *not* necessarily land together: on this build the Carport lock joined **NEST-PAN** while the Basement lock joined **ST-TIZEN**, on the same afternoon with the same phone, purely because each door hears a different set of neighbours. The node list is the only place that difference is visible — the device list shows three healthy locks either way.

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
