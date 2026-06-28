---
title: Matter Locks
subtitle: Three Aqara U400s into Apple Home for Home Key, then shared to Home Assistant
collection: My Build
order: 10
accent: rose
---

The three Aqara U400 deadbolts are **Matter-over-Thread** devices, and in an all-Apple household the order you set them up in matters. Commission each lock into **Apple Home first** — that is the only path that lights up **Home Key** (tap-to-unlock with an iPhone or Apple Watch) — then **share** each one into Home Assistant (HA) over Matter's multi-admin feature so it shows up in your dashboards and automations. This page walks both halves for all three locks and explains why you never re-scan a QR code.

> [!NOTE]
> Matter is the vendor-neutral standard for local control with no manufacturer cloud in the loop. **Thread** is the low-power mesh radio it rides on here. A Thread device needs a **border router** on your network to reach the rest of the house — on this build the **HomePod mini** already fills that role, so there is nothing extra to buy.

## Before you start

### Confirm the prerequisites are in place
Three things need to be true before you touch a lock:

- The **Home Assistant OS VM** is up and onboarded, reachable at its pinned address, with the **Matter** integration available (it ships with Home Assistant — no add-on hunting required).
- The **HomePod mini** is online and acting as the **Thread border router**. Open the Apple **Home** app → **Home Settings → Wi-Fi Network & Thread** and confirm a Thread network exists.
- You have an **iPhone with Bluetooth on**. Commissioning a Matter device — both into Apple Home and into Home Assistant — happens over Bluetooth from a phone. The Home Assistant web UI alone cannot do it, which surprises people running HA in a VM with no Bluetooth at all. The phone bridges that gap.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51
> The address the Home Assistant companion app points at. The Matter share step runs through this app on a Bluetooth phone.

> [!WARNING]
> Install the **Home Assistant companion app** on the same iPhone you use for Apple Home, and sign it in to your Home Assistant instance, **before** you start the locks. The share step in the second half needs both apps on one Bluetooth-capable phone.

### Find each lock's QR setup code
Every U400 has a **Matter QR code** — on a sticker inside the battery compartment, on the quick-start card, and usually a peel-off duplicate for your records. Keep all three codes somewhere safe now; record them in the field below so this checklist stands on its own, and move them into Vaultwarden once you set it up later in this build. You will scan each one **once**, into Apple Home; after that it is spent.

> [!SECRET] matter-lock-codes | Aqara U400 Matter setup codes (all three)
> The 11-digit numeric pairing code under each QR (shown grouped like `XXXX-XXX-XXXX`). Capture all three here — one per lock — and label them by door (Front, Side, Garage). If a lock ever needs a factory reset, you re-commission from these.

> [!DETAILS] Why the QR code is single-use
> A Matter setup code is the device's first-contact secret. The moment Apple Home commissions the lock with it, the code is **consumed** — Home Assistant cannot scan the same code to join independently. That is by design, and it is exactly what the share step below works around: Matter lets one device answer to several controllers at once (*multi-admin*), so the second controller is invited in with a fresh code rather than re-pairing from scratch.

## Commission into Apple Home

### Add the first U400 to the Home app
Do this with the lock physically installed and powered (fresh batteries seated, the door able to throw the bolt). For each lock:

1. Open the Apple **Home** app on the iPhone and tap **+ → Add Accessory**.
2. Point the camera at the lock's **Matter QR code**, or tap **More options** and enter the numeric setup code by hand.
3. The phone commissions the lock over Bluetooth, then hands it to **Thread** via the HomePod mini border router. Accept the **Add to Apple Home** / Matter trust prompt when it appears.
4. Assign the lock to a **room** (Front Door, Side Door, Garage) and give it a clear **name** — this name follows the device when it later appears in Home Assistant, so pick well now.

> [!TIP]
> Commission the lock **near the HomePod mini** if the first join is slow, then move it to its door. Thread is a mesh, but the initial handshake is more reliable with a strong first hop.

### Turn on Home Key
Once a U400 is in Apple Home, the Home app offers to set up **Home Key** — a digital key in your Apple Wallet that unlocks the bolt with a tap of the iPhone or Apple Watch. Accept it. This is the entire reason for commissioning into Apple Home first; sharing the lock to Home Assistant later does **not** grant Home Key, and pairing it into Home Assistant first would mean you never get Home Key at all.

> [!NOTE]
> Home Key and the physical keypad and key on the U400 all keep working regardless of what software controls the lock. Home Assistant is an *addition*, never a replacement for the ways you already open the door.

### Repeat for all three locks
Run the same Add Accessory flow for the **second and third U400**, each with its own QR code, room, and name, and enable Home Key on each. Confirm all three respond to lock/unlock taps in the Home app before moving on — a lock that misbehaves in Apple Home will misbehave everywhere.

## Share each lock into Home Assistant

### Generate a fresh pairing code in Apple Home
Because the original QR code is spent, you invite Home Assistant in as a **second admin**. Starting with the first lock, in the Apple **Home** app:

1. Open the lock's tile → **Settings** (the gear).
2. Scroll to **Turn On Pairing Mode** (listed under the accessory's setup options).
3. Apple displays — and copies — a **fresh setup code** (a Matter code, shown grouped like `XXXX-XXX-XXXX`). Leave this screen up; the code is time-limited.

> [!DETAILS] What "multi-admin" actually does
> You are not removing the lock from Apple Home or duplicating it. Multi-admin lets the **same physical lock** answer to multiple Matter controllers simultaneously. Apple Home keeps full control and Home Key stays exactly as it was; Home Assistant simply gains *shared* control of the identical device. There is no second pairing, no bridge, and no cloud relay — both controllers talk to the lock locally over Thread.

### Add it to Home Assistant as a Matter device
With the fresh code in hand, on the same Bluetooth iPhone:

1. In the **Home Assistant companion app**, go to **Settings → Devices & services → Add integration → Matter**.
2. When prompted, enter (or scan, if Apple showed a QR) the **fresh setup code** Apple just generated.
3. The phone commissions Home Assistant as the new admin over Bluetooth and Thread. After a moment the lock appears in Home Assistant as a `lock.*` entity.

> [!WARNING]
> Do this step from the **companion app**, not the desktop browser. The Matter add flow needs the phone's Bluetooth radio to reach the lock — the Home Assistant VM has none.

### Place it in an Area and repeat
Assign the new lock entity to the matching room under **Settings → Areas, labels & zones** so dashboards and voice targeting can find it. Then repeat the whole share — **Turn On Pairing Mode → fresh code → Add → Matter** — for the **second and third locks**. Each lock needs its own pairing-mode round trip; there is no batch path.

> [!NOTE]
> Name the Area the same as the room you chose in Apple Home (Front Door, Side Door, Garage). Consistent names keep the two apps legible side by side and make automations read cleanly.

## Verify and hand off

### Test both controllers on every lock
For each of the three U400s, confirm the lock truly answers to both admins and the physical hardware still works:

- **Apple Home** — lock and unlock from the Home app; tap the iPhone or Watch to confirm **Home Key** still opens it.
- **Home Assistant** — toggle the `lock.*` entity and watch the bolt move; check the state reports back correctly.
- **The door itself** — the keypad code and the physical key both still work.

> [!TIP]
> If a lock shows up in Home Assistant but its state lags or goes *unavailable*, the Thread mesh is usually the cause — move a Thread router or the HomePod mini closer, or reboot the border router. The lock being controllable in Apple Home but flaky in Home Assistant points at routing, not at the share.

### These locks now feed the automations
With all three U400s present as `lock.*` entities in Home Assistant, they become raw material for the automation rules on this build — auto-lock after a set time, an unlock notification to the household, and presence-based actions. Until the locks exist as Home Assistant entities, those rules have nothing to act on; now they do.

> [!WARNING]
> Keep all three Matter setup codes (the `matter-lock-codes` field above) and the Home Assistant owner credentials safe — you will consolidate these into Vaultwarden once you set it up later in this build. If a lock ever needs a factory reset, you re-commission from these codes — and you redo both halves of this page (Apple Home first, then the share) for that lock.
