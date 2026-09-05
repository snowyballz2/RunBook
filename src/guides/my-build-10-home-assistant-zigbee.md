---
title: Home Assistant & Zigbee2MQTT
subtitle: My Build — the HA OS VM, onboarding, Areas, and the Zigbee mesh on the ZBT-2
collection: My Build
order: 10
accent: emerald
---

This is the brain of the house. Home Assistant runs as its own **VM (virtual machine)** — it needs its own kernel and is not a plain Linux service, so it does not go in a container like AdGuard or Nextcloud. Once it is onboarded, **Zigbee2MQTT (Z2M)** rides the **HA Connect ZBT-2** coordinator and joins the Zigbee devices this build depends on: a dozen leak sensors, the water shut-off valve, and the mains-powered plugs that hold the mesh together. By the end of this page Home Assistant knows every Zigbee device by name and which room it lives in — the raw material the automations later act on.

> [!NOTE]
> Do not VFIO (Virtual Function I/O) anything to this VM. The GTX 1080 Ti stays shared from the Proxmox host into the service LXCs (Linux Containers); the only PCIe (Peripheral Component Interconnect Express) passthrough on this build is the HBA (host bus adapter) to TrueNAS. Home Assistant reaches the GPU-backed services over the LAN (local area network).

## Stand up the VM

### Create the Home Assistant OS VM
Home Assistant OS ships as a ready-made disk image, **not** an installer ISO — so skip the Create VM wizard and use one of the two paths below. Either way, give it **2 cores and 8 GB RAM** (this box has it to spare, and apps want the headroom) and a 32 GB disk.

> [!DETAILS] The quick way — helper script, with every prompt answered
> The community-scripts helper downloads the official image and builds the VM for you. Run it in the Proxmox host shell (**`pve` → Shell**) — you are piping a script into a root shell, so download and read it first, the same habit as always:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> Pick **Advanced** when asked, then walk the prompts. Two get changed; everything else keeps its default (just press Enter):
>
> 1. **HAOS Version** → Stable (default).
> 2. **VM ID** → accept the suggested next-free number.
> 3. **Machine Type** → q35 (default).
> 4. **Disk Cache** → Write Through (default).
> 5. **Hostname** → change to **`haos`** if you prefer a clean name; cosmetic either way.
> 6. **CPU Model** → KVM64 (default).
> 7. **Core Count** → 2 (default).
> 8. **RAM** → **8192** — the one that matters; the 2048 default starves the apps this build stacks on.
> 9. **Bridge** → vmbr0 (default).
> 10. **MAC, VLAN, MTU** → leave blank/default.
> 11. **Storage pool** → `local-lvm`.
> 12. **Start Virtual Machine** → Yes.

> [!DETAILS] The manual way — no scripts
> Four moves in the host shell, official sources only. The two values you may need to adjust before pasting: the version (`17.3` — check the [HA OS releases page](https://github.com/home-assistant/operating-system/releases) for current) and the VM ID (`101` is the next free on this build after TrueNAS's 100).
>
> Confirm the ID is free before pasting:
>
> ```bash
> qm list
> ```
>
> 1. Download and unpack the official image:
>
> ```bash
> cd /tmp
> wget https://github.com/home-assistant/operating-system/releases/download/17.3/haos_ova-17.3.qcow2.xz
> unxz haos_ova-17.3.qcow2.xz
> ```
>
> 2. Create the VM — HA OS needs UEFI boot (`ovmf`) with secure boot off (`pre-enrolled-keys=0`):
>
> ```bash
> qm create 101 --name haos --ostype l26 --bios ovmf \
>   --efidisk0 local-lvm:0,efitype=4m,pre-enrolled-keys=0 \
>   --cores 2 --memory 8192 --scsihw virtio-scsi-pci \
>   --net0 virtio,bridge=vmbr0 --agent enabled=1
> ```
>
> 3. Import the image as the boot disk:
>
> ```bash
> qm set 101 --scsi0 local-lvm:0,import-from=/tmp/haos_ova-17.3.qcow2
> qm set 101 --boot order=scsi0
> ```
>
> 4. Start it:
>
> ```bash
> qm start 101
> ```

> [!NOTE]
> In the VM's **Options** panel:
>
> - **Start at boot** → enabled
> - **Start/Shutdown order** → **order=2** — load-bearing: Frigate points at the Mosquitto MQTT (MQ Telemetry Transport) broker that lives alongside this VM, so Home Assistant must be up first; TrueNAS is `order=1` from the Virtual Machines page and the Frigate container becomes `order=3` — storage, then this VM, then Frigate
> - **Protection** → **Yes** — this VM *is* the smart home, and the flag blocks accidental deletion

### Pin its address
The brain of the house gets a device-set static in the protected zone, like the host and TrueNAS before it — not a router reservation, which the Fios router can only make for in-pool `.100+` addresses. The screen only exists after onboarding, so do this **right after the onboarding below finishes**, in the Home Assistant UI:

1. Go to **Settings → System → Network**.
2. Expand the interface.
3. Set the following:

   - **IPv4** → **Static**
   - **IP address** → **`192.168.1.51/24`**
   - **Gateway** → **`192.168.1.1`**
   - **DNS** → **`192.168.1.1`**

4. **Save**.

Phone apps, dashboards, and the MQTT links all use this address — `homeassistant.local` does not resolve reliably on every network, and every later page assumes `.51`.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!WARNING]
> **Wrong app = hijacked host.** Proxmox has a nearly identically named screen — `pve` **→ System → Network** — that sets the *host's* address, and typing `.51` there moves the hypervisor itself on the next apply or reboot (this build did exactly that: Proxmox vanished from `.50` and turned up at `.51`). This step happens **inside Home Assistant** at port `8123`, nowhere in the Proxmox UI.
>
> If the host does get moved by mistake, the web UI is still alive at the new address:
>
> 1. Log in there.
> 2. Go to `pve` → **System → Network** → `vmbr0`.
> 3. Set **IPv4/CIDR** back to `192.168.1.50/24`.
> 4. **Apply Configuration**.
> 5. Reconnect at `.50`.

## First boot

### Walk the onboarding
1. Wait a few minutes on first boot — Home Assistant OS sets itself up unattended.
2. Browse to `http://homeassistant.local:8123` (or the pinned IP).
3. Let **Preparing Home Assistant** finish downloading the latest version (roughly 700 MB) — this can take twenty minutes.
4. Choose **Create my smart home**.
5. Set up the owner account.
6. Set the home location — time zone, units, currency.
7. Make your analytics choice.
8. Click **Finish**.

> [!NOTE]
> Home Assistant can show high RAM use right after boot — that is normal; it uses free memory for caching, not a sign the 8 GB is too small.

> [!WARNING]
> The owner account is the one account that cannot be recovered. Record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build), and record it below too so this checklist stands on its own — save it before you click **Create account**.

> [!INPUT] ha-owner-user | Home Assistant owner username

> [!SECRET] ha-owner-password | Home Assistant owner password

### Sketch the Areas now
1. Go to **Settings → Areas, labels & zones**.
2. Add an Area per room — kitchen, laundry, garage, basement, baths — so each Zigbee device has somewhere to land as it joins.

Two minutes that pays forever: dashboards group by Area automatically, and voice and automation targeting only works once Home Assistant knows what is *in* each room.

### Set the entity ID format before anything is paired
1. Go to **Settings → Entity ID format** (`/config/entity-id-format`).
2. Click the **×** on the **Area** chip, leaving **Device + Entity**.
3. **Save**.

> [!NOTE]
> Two minutes here saves a rename campaign later. Home Assistant builds every new entity's ID from a **format**, and the default is **Area + Device + Entity** — which produces `lock.carport_carport_door` and `sensor.living_room_thermostat_temperature`. Removing Area shortens the preview immediately, and everything paired from here — the Zigbee sensors, the locks, the shades — arrives with an ID you would willingly type into an automation. Nothing is lost: the area still lives on the *device*, so dashboard grouping, "turn off the basement" voice targeting, and area-targeted automations all behave the same. Area in the ID only earns its keep when two devices share a name across rooms, and this build's names are already distinct.

> [!WARNING]
> **Do it now, before pairing.** The setting applies only to entities created *after* it is saved — existing ones keep their IDs and must be renamed individually, which is the tedious path this step exists to avoid.

> [!TIP]
> Name the Areas the way you would say them out loud ("Laundry Room", not "laundry_1"). Those names become the words a Cast announcement or a future voice command leans on.

## Zigbee2MQTT on the ZBT-2

### Pass the coordinator through
This build runs **Zigbee2MQTT (Z2M), not ZHA (Zigbee Home Automation)** — broader device support, and it speaks the same MQTT bus the rest of the build uses — and it runs as a Home Assistant app, so the coordinator goes to the Home Assistant OS VM.

1. Plug the **HA Connect ZBT-2** into a rear USB port on its included 1.5 m USB-C cable — long enough to stand the antenna base away from case interference.
2. In Proxmox, select the VM → **Hardware → Add → USB Device**.
3. Pick the ZBT-2 by name.
4. Reboot the VM.

> [!WARNING]
> Proxmox does not hand USB devices to a guest automatically. If Z2M cannot see the coordinator, this missed passthrough step is almost always why. (Passing it through also means the **host** stops showing it under `/dev/serial/by-id/` — QEMU detaches the host driver, so that path now exists *inside* the VM. Find it at **Settings → System → Hardware → All Hardware** in the Home Assistant UI, which is the same list Z2M's port dropdown reads.)

> [!DANGER]
> Once the stick is passed through, Home Assistant discovers it and offers cards under **Settings → Devices & services** that look helpful and are not:
>
> 1. **Home Assistant Connect ZBT-2** — ignore it, never click Add.
> 2. **Lutron Smart Bridge Pro 2**, listed as a "HomeKit Device" — ignore this too.
> 3. Add the Lutron bridge through its native **Lutron Caséta** card instead.
>
> The ZBT-2 card starts HA's built-in **ZHA** (or Thread) setup, which seizes the coordinator this build needs for Zigbee2MQTT; Z2M reaches the radio through its own add-on config, not through an HA integration, so one click on that card costs you the whole Zigbee setup. The HomeKit route for the Lutron bridge exposes only a subset (no Pico remotes as triggers) and consumes the bridge's HomeKit pairing.

### Stand up the Mosquitto broker and its logins
The whole build talks over one **Mosquitto** broker, and it lives here on the Home Assistant VM.

1. In the Home Assistant UI (`192.168.1.51:8123`), go to **Settings → Apps → Install app**.
2. Install the official **Mosquitto broker** app, if it is not already running.
3. On the app's page, set its toggles deliberately:

- **Start on boot** → **on** — the broker is the spine; without it, Zigbee entities and Frigate's events are dead after any reboot
- **Watchdog** → **on** — restarts the app if it stops; a dead broker fails *silently*, nothing errors, entities just quietly stop updating
- **Auto update** → **off** — a single point of failure for both the Zigbee mesh and Frigate gets updated deliberately, in the monthly maintenance pass, after a snapshot
- **Show in sidebar** → cosmetic either way — Mosquitto has no real UI

> [!NOTE]
> Do not stand up a second broker anywhere else. Home Assistant renamed *Add-ons* to *Apps* in 2026.2, so older write-ups say "add-on store".

> [!WARNING]
> **Restart the Mosquitto app after adding logins.** It writes its password file at startup, so credentials added to the Logins list do not exist to the broker until it restarts — and every client that tries meanwhile is refused with a bare **"Connection refused: Not authorized"**, which reads like a wrong password rather than a not-yet-loaded one.
>
> 1. Add a login under the app's **Configuration → Logins** list (or create a dedicated non-admin Home Assistant user) named **`zigbee2mqtt`**, for Z2M, used below.
> 2. Add a second login named **`mqtt-user`**, for Frigate, used on the Cameras, Doorbell & Frigate page.
> 3. Restart Mosquitto.
> 4. Retry whatever was rejected.
> 5. If it still fails, check Mosquitto's own **Log** — it names the username it turned away, telling you whether the client is sending the wrong name or the wrong password.
>
> The broker rejects unknown credentials by default, so a username nobody created just gets "not authorised". Same broker, distinct logins — the broker's logs make it obvious who is talking.

> [!INPUT] z2m-mqtt-user | Zigbee2MQTT's own MQTT username | | zigbee2mqtt
> Created in the broker's Logins a moment ago. Separate from Frigate's `mqtt-user` — same broker, distinct login.

> [!SECRET] z2m-mqtt-password | Zigbee2MQTT's MQTT password

> [!INPUT] mqtt-user | Frigate's MQTT username | | mqtt-user
> The second login, created in the same Logins list right now — Frigate itself uses it weeks later, on the Cameras, Doorbell & Frigate page.

> [!SECRET] frigate-mqtt-password | Frigate's MQTT password (login `mqtt-user`)
> Created now so the broker knows it; Frigate enters this pair on the Cameras, Doorbell & Frigate page.

> [!WARNING]
> Leave **`password_pre_hashed` off** (its default). That option tells the add-on the password you typed is *already* a PBKDF2 hash, for migrating credentials from an existing Mosquitto install. Switch it on with a plain password and the broker stores your literal text as though it were a hash — nothing ever authenticates, and every client just reports a wrong password.

### Point Z2M at the Mosquitto broker
Install Z2M as a Home Assistant app — its apps live in a separate repository:

1. Go to **Settings → Apps → Install app**.
2. Open the **⋮ menu → Repositories**.
3. Add `https://github.com/zigbee2mqtt/hassio-zigbee2mqtt`.
4. Install **Zigbee2MQTT** from the store.
5. Start it.

Opening it the first time gives you the **Zigbee2MQTT Onboarding** wizard, not the normal frontend — so there is no **Permit join** button yet; that appears only after this wizard is submitted and Z2M is running. The wizard is one page with a **Coordinator/Adapter** picker, a **Network** panel, and a row of tabs (Main, Frontend, MQTT, Serial…). Work it in this order, and note that **nothing commits until you submit at the bottom** — tab-hopping is safe, closing the page is not.

1. **Skip the coordinator dropdown.** Leave it on **`-`** and fill the Serial tab by hand (next).
2. **Fix the Serial tab.** Four fields, all load-bearing; wrong values here are the usual reason a ZBT-2 looks configured and then never connects or keeps dropping:
   - **adapter** → `ember` — the dropdown's auto-fill usually gets this right already
   - **baudrate** → **`460800`**. It defaults to `115200`, and the field's own hint says that is "most common" — ignore it. That advice is for older sticks; the ZBT-2 runs at four times the ZBT-1's rate and Z2M does not negotiate it.
   - **rtscts** → **ticked**. Defaults off.
   - **port** → the full **`/dev/serial/by-id/usb-Nabu_Casa_ZBT-2_<serial>-if00…`** path, copied verbatim from **Settings → System → Hardware → All Hardware**. Never the raw `/dev/ttyACM0`: that is assigned in plug order, so once the second ZBT-2 arrives for Thread it can silently point Z2M at the wrong radio after a reboot, while the by-id path carries the stick's serial and cannot be confused.
3. **Fill the MQTT tab.**
   - **server** → **`mqtt://core-mosquitto:1883`** — the broker's *internal* name, not the VM's LAN address, since both are add-ons on this same Home Assistant
   - **user** / **password** → the `zigbee2mqtt` pair created in Mosquitto
   - **ca / key / cert** → blank — TLS, unnecessary internally
   - **base_topic** → `zigbee2mqtt` — everything Z2M publishes namespaces under `zigbee2mqtt/…` and stays out of Frigate's way
4. **Leave the Network panel alone**, but write down its auto-generated **PAN ID**, **Extended PAN ID**, and **Network key** first.
5. Submit. Z2M starts, and the sidebar entry now opens the real frontend with **Permit join** in its top-right nav.

> [!NOTE]
> Step 1: it is tempting to select the ZBT-2 under **Devices found** — its help text calls it optional for good reason. It pre-fills the Serial tab *incorrectly* (raw `/dev/ttyACM0` for the port), and worse, it **re-applies that auto-fill later**: re-selecting it or reloading the page silently reverts the corrections from step 2.

> [!WARNING]
> If any of the step 2 Serial tab fields revert on you, the coordinator dropdown is re-applying its auto-fill:
>
> 1. Set it back to `-`.
> 2. Redo the four fields.
> 3. Submit without reloading.
>
> Failing that, bypass the form entirely: **Settings → Apps → Zigbee2MQTT → Configuration → ⋮ → Edit in YAML** writes the same values where autodetect cannot overwrite them:

```yaml
serial:
  adapter: ember
  port: /dev/serial/by-id/usb-Nabu_Casa_ZBT-2_441BF68633DC-if00
  baudrate: 460800
  rtscts: true
```

> [!NOTE]
> Step 4: the shuffle buttons beside the Network panel's fields would force re-pairing every device — write the three values down anyway, since they are what lets a rebuilt Z2M (new container, restored backup, migration) have all thirteen devices rejoin without walking to each sensor and valve.

> [!SECRET] z2m-network-values | Zigbee network identity — PAN ID, Extended PAN ID, Network key
> From the onboarding wizard's **Network** panel. These are also inside Home Assistant's own backups and the Proxmox vzdump, so this field is belt-and-braces — but recreating a Zigbee network without them means re-pairing every device by hand.

> [!INPUT] mqtt-host | Mosquitto broker address (for external clients) | 192.168.1.51
> Z2M uses `mqtt://core-mosquitto:1883` internally, but **Frigate is a separate container off-box** — it connects to the broker at this LAN address with its `mqtt-user` login, on the Cameras, Doorbell & Frigate page.

### Surface Z2M in Home Assistant
1. Go to **Settings → Devices & services**.
2. Accept the discovered **MQTT** integration.

> [!NOTE]
> Once Z2M is talking to the broker, Home Assistant picks it up through the **MQTT integration**. Home Assistant auto-discovers the local Mosquitto app. Accepting it connects with the app's own internal login, so there are no credentials to type. With both Z2M and Home Assistant on the broker, every device Z2M reports shows up as an ordinary Home Assistant entity automatically — no per-device wiring.

> [!NOTE]
> The non-Zigbee devices on this build — the Lutron Caséta bridge, the ecobee thermostats, the cameras, and the rest — arrive the same way, under **Settings → Devices & services** after onboarding (many auto-detected in the **Discovered** section). An empty Discovered list right after setup is normal. The cameras and locks get their integrations on their own pages, and the ecobee thermostats are onboarded on the Automations page. The Lutron Caséta bridge has no page of its own, so add it now:
>
> The bridge is reached by address, so pin it first — Home Assistant's own docs recommend a fixed address for it. In the **Lutron app**:
>
> 1. Go to **Settings → Advanced → Integration → Network Settings**.
> 2. Set a static address: IP `192.168.1.61`, subnet `255.255.255.0`, gateway `192.168.1.1`, DNS `192.168.1.53`.
> 3. Save.
>
> Then in Home Assistant:
>
> 4. **Settings → Devices & services → Add integration → Lutron Caséta**.
> 5. Press the button on the back of the bridge when prompted.
>
> Already paired while the bridge sat on a DHCP address? After pinning it, if the Caséta lights go unavailable, remove the integration and add it again — the bridge remembers every device, and the entities come back under the same IDs, so the automations keep working.
>
> The lights surface as entities for the scenes and scripts later in the build. **Adding Caséta switches later never means re-adding the integration:** pair the new switch in the *Lutron app* (the bridge owns the device list), then **Settings → Devices & services → Lutron Caséta → ⋮ → Reload** in Home Assistant and the new entities appear. That is the pattern for every hub-based integration — pair at the hub, reload in HA; only hub-less devices (the Zigbee ones through Z2M, the Matter locks) get paired inside Home Assistant itself.

## Pair the mesh

### Lay down the routers first
Plug in the **Third Reality 3RSP019BZ smart plugs** and pair them **before** anything battery-powered. Place them **near the sensor clusters and near the valve** so the leak devices and the shut-off always have a strong hop home.

> [!NOTE]
> They are mains-powered Zigbee **routers** — they build and extend the mesh that the battery sensors lean on. (Zigbee only — the 3RSP019BZ is a Zigbee/BLE device with no Thread support, so it can never extend the *Thread* mesh the locks use; that gap is discussed on the Matter Locks page.)

Pairing them takes a few steps, and the first is the trap — these plugs **ship in BLE mode**, not Zigbee, and a plug left in BLE simply never appears in Z2M, with no error to explain why:

1. **Switch it to Zigbee mode.** Press and **hold** the plug's button while inserting it into the outlet, until the **green** light comes on — green means BLE, the factory default used by Third Reality's own app.
2. Release the button.
3. Press the button once, immediately. The LED flashes **red** — Zigbee mode confirmed.
4. **Enter pairing mode.** Press and hold the button for **more than 10 seconds**, until the LED flashes.
5. **Open the network.** With **Permit join** already running in Z2M's frontend, the plug joins within a minute and appears in the device list.

Do this on every plug, including brand-new ones.

> [!TIP]
> A few routers spread through the house turn a flaky single-hop mesh into a solid one. Pairing them first also means the sensors join *through* a nearby router rather than straining to reach the coordinator directly.

> [!NOTE]
> Two settings on each plug's page in Z2M once it joins:
>
> - **State** → **ON** — the outlet's relay; ON means the socket actually passes power, and one left OFF makes a lamp plugged in months later look broken for no visible reason
> - **Power-on behavior** → **`previous`** (defaults to `off`) — so that ON state is what the plug returns to after an outage, matching how the rest of this build recovers
>
> Neither affects the plug's routing — the radio is live whenever the plug is in the wall, relay open or closed, which is also why toggling State is a safe way to identify which physical plug a name belongs to (flip it, listen for the click). And glance at **Linkquality**: it is a reading, not a setting, but a plug well below its siblings (say 88 against 140+) is the weakest router in the mesh, and the first thing to suspect if sensors near it later go unavailable — try another outlet in that room, away from appliances and metal. Renaming a device also makes Z2M log a "Device left / Device joined" pair for it; that is the re-registration under the new name, not a fault.

### Join the leak sensors
With routers in place, pair the **12× Third Reality 3RWS18BZ** siren leak sensors — one at every water risk: water heater, washer, dishwasher, each sink, the sump, and the fridge water line. Repeat this loop per sensor:

1. **Open the network through the nearest plug.** In Z2M's top-right nav, click the **arrow beside Permit join** and choose the nearest plug, rather than "All" — so the sensor attaches to a router near where it will live instead of straining for the coordinator.
2. **Put the sensor in pairing mode.** Press and hold its **inside button for 3 seconds** until the **red LED** lights; it then switches to a **fast-blinking blue**, which means it is ready. (There is no battery tab to pull on these — the button is the only way in.)
3. **Wait for it in the device list** — usually under 30 seconds.
4. **Rename it immediately**, before pairing the next one. Name it for the *water risk*, not the room — "Water Heater Leak", "Dishwasher Leak", "Sump Leak" — because that exact name is what the leak automation later speaks aloud and pushes to your phone.
5. **Assign its Area.**

**Permit join closes itself after about four minutes**, so expect to re-click it every three or four sensors; a sensor that never appears is usually just a window that expired. They arrive in Home Assistant as `binary_sensor.*_leak` entities. **Turn Permit join off** once all twelve are in.

> [!TIP]
> Name each sensor as you pair it — "Water Heater Leak", "Dishwasher Leak" — and drop it in its Area on the spot. Twelve identical sensors paired silently are impossible to tell apart later; named-as-you-go takes seconds.

### Join the shut-off valve
Pair the **Aqara Valve Controller T1** last. It is the clamp-on actuator on the **quarter-turn lever** main water valve — it physically turns the lever, so there are no plumbing changes.

1. **Open the network** — Permit join in Z2M, as with everything else.
2. **Hold the valve's power / On-Off button for about 5 seconds**, until its LED blinks. That is pairing mode.
3. Wait for it to join — it appears as `lumi.valve.agl001`.
4. **Rename it so it surfaces as the `switch.main_water` entity** in Home Assistant.

Z2M exposes the T1 as a plain **switch** (ON = open, OFF = closed), not a `valve.*` device, and that exact entity ID is what the leak-to-valve automation built later in this collection targets. A default name like `switch.aqara_valve_controller_t1` would leave that automation pointing at nothing.

> [!NOTE]
> If step 2 doesn't take — most likely on a unit that has been paired before — force a reset the way that actually works on stubborn ones:
>
> 1. Pull a battery.
> 2. Hold the button while reinserting it.

> [!WARNING]
> Before trusting it, confirm the T1 throws the lever through its **full travel** — fully open to fully closed. Mount it so closed is genuinely closed; a clamp that slips is worse than no automation at all.

> [!NOTE]
> When pairing is done, turn **Permit join off** in Z2M. Leaving the network open invites stray devices and is a small but real security gap on an otherwise locked-down, local-first build.

## Keep it backed up

### Turn on Home Assistant's own backups
Home Assistant keeps its own backups separate from the whole-VM copy Proxmox takes. Turn them on now in the Home Assistant UI, under **Settings → System → Backups → Set up backups**:

- **Schedule** → **Daily**
- **Time** → **System optimal**

Home Assistant handles it from then on. These local backups are the fast in-app undo — one click to roll back a bad app or a broken automation.

Setup generates an **encryption key** and shows it once, alongside a downloadable **emergency kit**. Record it before clicking past — this is the highest-stakes secret on the page:

> [!SECRET] ha-backup-key | Home Assistant backup encryption key
> Generated at **Settings → System → Backups → Set up backups**. Every HA backup is encrypted with it, and **without it a backup cannot be restored by anyone** — Nabu Casa does not hold a copy and cannot recover it. Still have a working HA? Retrieve it any time from the backup settings on that same screen.

> [!WARNING]
> 1. **Download the emergency kit.**
> 2. Put it somewhere that is not this server — the encrypted USB drive from the Protect Your Data page is the right home, and Vaultwarden once it exists.
>
> A key stored only inside the machine it restores is no key at all: the failure that makes you need the backup is exactly the one that takes the key with it.

### Point the backups at the NAS
On their own, those backups land on the VM's disk — the copy lives on the very thing it is protecting. Send them to the NAS as well — still in the Home Assistant UI, go to **Settings → System → Storage → Add network storage**:

- **Name** → `truenas-backups` (this also becomes the folder name on the share)
- **Usage** → **Backup**
- **Server** → `192.168.1.20`
- **Protocol** → **Samba/Windows (CIFS)**
- **Share** → `backups`, with the **SMB user** below — the share account from the TrueNAS Storage page, not `truenas_admin`

Then back under **Settings → System → Backups**, enable that location:

- **This system** → leave **on** as well — local gives the instant rollback, the NAS gives the copy that survives the VM's disk
- **Home Assistant Cloud backup** → ignore — that is the Nabu Casa subscription, and this build is deliberately local-first

While on that screen, set the **Backup data** toggles:

- **History** → **on** — the recorder database (sensor history and the energy dashboard); it grows the backups, but they land on a 4 TB mirror and a restore that quietly loses months of leak-sensor history is a nasty surprise
- **Media** → **off** — camera recordings live on Frigate's own disk
- **Share folder** → **off** — unused here
- **Apps** → **All** — matters more than it looks, because it is what carries **Mosquitto's logins and Z2M's configuration including the Zigbee network key**; narrow it and a restored Home Assistant comes back with a broker nothing can log into and a Zigbee network it cannot rejoin

> [!NOTE]
> Parked on the NAS, Home Assistant's own backups are a real second copy as well as the quick in-app undo. The other layer is the **nightly Proxmox vzdump of the whole VM** (set up on the Proxmox Backups page) — that is what survives a dead VM disk and feeds the restore drill later in the build. The two layers do different jobs: HA's backups are the quick undo, the vzdump is the rebuild-from-scratch copy.

## Where this leads

### Confirm the entities exist
1. In the Home Assistant UI (`192.168.1.51:8123`), open **Settings → Devices & services → Entities**.
2. Filter for the new arrivals: twelve `binary_sensor.*_leak` sensors, the `switch.main_water` valve actuator, and the smart-plug switches and power readings.

Each should sit in its Area with a human-readable name. That inventory is the prerequisite for the leak-to-valve automation built later in this collection — until the sensors and the valve exist as entities, there is nothing for that rule to listen to or close.

> [!TIP]
> The Lutron Caséta lights, the ecobee thermostats, the cameras through Frigate, and the Aqara U400 locks join Home Assistant through their own integrations rather than Zigbee — the locks and cameras are covered on their own pages, the ecobee is onboarded on the Automations page, and the Caséta bridge was added under Devices & services earlier on this page. This page's job is the Zigbee mesh and the safety devices riding it.
