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
> 9. **Bridge** → vmbr0 (default). MAC, VLAN, MTU → leave blank/default.
> 10. **Storage pool** → `local-lvm`.
> 11. **Start Virtual Machine** → Yes.

> [!DETAILS] The manual way — no scripts
> Four moves in the host shell, official sources only. The two values you may need to adjust before pasting: the version (`17.3` — check the [HA OS releases page](https://github.com/home-assistant/operating-system/releases) for current) and the VM ID (`101` is the next free on this build after TrueNAS's 100; `qm list` confirms).
>
> Download and unpack the official image:
>
> ```bash
> cd /tmp
> wget https://github.com/home-assistant/operating-system/releases/download/17.3/haos_ova-17.3.qcow2.xz
> unxz haos_ova-17.3.qcow2.xz
> ```
>
> Create the VM — HA OS needs UEFI boot (`ovmf`) with secure boot off (`pre-enrolled-keys=0`):
>
> ```bash
> qm create 101 --name haos --ostype l26 --bios ovmf \
>   --efidisk0 local-lvm:0,efitype=4m,pre-enrolled-keys=0 \
>   --cores 2 --memory 8192 --scsihw virtio-scsi-pci \
>   --net0 virtio,bridge=vmbr0 --agent enabled=1
> ```
>
> Import the image as the boot disk, then start it:
>
> ```bash
> qm set 101 --scsi0 local-lvm:0,import-from=/tmp/haos_ova-17.3.qcow2
> qm set 101 --boot order=scsi0
> qm start 101
> ```

> [!NOTE]
> In the VM's **Options** panel, enable **Start at boot** and set **Start/Shutdown order** to **order=2**. The order is load-bearing: Frigate points at the Mosquitto MQTT (MQ Telemetry Transport) broker that lives alongside this VM, so Home Assistant must be up first — TrueNAS is `order=1` from the Virtual Machines page and the Frigate container becomes `order=3`, so the storage boots first, then this VM, then Frigate.

### Pin its address
The brain of the house gets a device-set static in the protected zone, like the host and TrueNAS before it — not a router reservation, which the Fios router can only make for in-pool `.100+` addresses. The screen only exists after onboarding, so do this **right after the onboarding below finishes**: in the Home Assistant UI, go to **Settings → System → Network**, expand the interface, set **IPv4 → Static**, address **`192.168.1.51/24`**, gateway **`192.168.1.1`**, DNS **`192.168.1.1`**, and save. Phone apps, dashboards, and the MQTT links all use this address — `homeassistant.local` does not resolve reliably on every network, and every later page assumes `.51`.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!WARNING]
> **Wrong app = hijacked host.** Proxmox has a nearly identically named screen — `pve` **→ System → Network** — that sets the *host's* address, and typing `.51` there moves the hypervisor itself on the next apply or reboot (this build did exactly that: Proxmox vanished from `.50` and turned up at `.51`). This step happens **inside Home Assistant** at port `8123`, nowhere in the Proxmox UI. If the host does get moved by mistake: the web UI is still alive at the new address — log in there, `pve` → **System → Network** → `vmbr0` → set **IPv4/CIDR** back to `192.168.1.50/24` → **Apply Configuration**, and reconnect at `.50`.

## First boot

### Walk the onboarding
Give it a few minutes on first boot — Home Assistant OS sets itself up unattended. Then browse to `http://homeassistant.local:8123` (or the pinned IP). The first screen is **Preparing Home Assistant** while it downloads the latest version (roughly 700 MB) — this can take twenty minutes, so let it work. Then choose **Create my smart home** and the wizard walks you through the owner account, your home location (it sets time zone, units, and currency), and an analytics choice, ending with **Finish**.

> [!NOTE]
> Home Assistant can show high RAM use right after boot — that is normal; it uses free memory for caching, not a sign the 8 GB is too small.

> [!WARNING]
> The owner account is the one account that cannot be recovered. Record it in your password manager (you will consolidate these into Vaultwarden when you set it up later in the build), and record it below too so this checklist stands on its own — save it before you click **Create account**.

> [!INPUT] ha-owner-user | Home Assistant owner username

> [!SECRET] ha-owner-password | Home Assistant owner password

### Sketch the Areas now
Before any devices arrive, lay out your rooms under **Settings → Areas, labels & zones**. Add an Area per room — kitchen, laundry, garage, basement, baths — so that as each Zigbee device joins you can drop it straight into the right one. Two minutes that pays forever: dashboards group by Area automatically, and voice and automation targeting only works once Home Assistant knows what is *in* each room.

> [!TIP]
> Name the Areas the way you would say them out loud ("Laundry Room", not "laundry_1"). Those names become the words a Cast announcement or a future voice command leans on.

## Zigbee2MQTT on the ZBT-2

### Pass the coordinator through
This build runs **Zigbee2MQTT (Z2M), not ZHA (Zigbee Home Automation)** — broader device support, and it speaks the same MQTT bus the rest of the build uses — and it runs as a Home Assistant app, so the coordinator goes to the Home Assistant OS VM. Plug the **HA Connect ZBT-2** into a rear USB port on its included 1.5 m USB-C cable — long enough to stand the antenna base away from case interference — then pass it through: in Proxmox, select the VM → **Hardware → Add → USB Device**, pick the ZBT-2 by name, and reboot the VM.

> [!WARNING]
> Proxmox does not hand USB devices to a guest automatically. If Z2M cannot see the coordinator, this missed passthrough step is almost always why. (Passing it through also means the **host** stops showing it under `/dev/serial/by-id/` — QEMU detaches the host driver, so that path now exists *inside* the VM. Find it at **Settings → System → Hardware → All Hardware** in the Home Assistant UI, which is the same list Z2M's port dropdown reads.)

> [!DANGER]
> Once the stick is passed through, Home Assistant discovers it and offers a **Home Assistant Connect ZBT-2** card under **Settings → Devices & services**. **Ignore that card — never click Add.** It starts HA's built-in **ZHA** (or Thread) setup, which seizes the coordinator this build needs for Zigbee2MQTT; Z2M reaches the radio through its own add-on config, not through an HA integration. One click there costs you the whole Zigbee setup. The same page also lists the **Lutron Smart Bridge Pro 2 as a "HomeKit Device"** — ignore that too, and add the bridge through its **native Lutron Caséta** card instead: the HomeKit route exposes only a subset (no Pico remotes as triggers) and consumes the bridge's HomeKit pairing.

### Stand up the Mosquitto broker and its logins
The whole build talks over one **Mosquitto** broker, and it lives here on the Home Assistant VM. In the Home Assistant UI (`192.168.1.51:8123`), install the official **Mosquitto broker** app (**Settings → Apps → Install app** — Home Assistant renamed *Add-ons* to *Apps* in 2026.2, so older write-ups say "add-on store") if it is not already running, and do not stand up a second broker anywhere else. On the app's page, set its toggles deliberately: **Start on boot — on** (the broker is the spine; without it, Zigbee entities and Frigate's events are dead after any reboot) and **Watchdog — on** (it restarts the app if it stops, which matters because a dead broker fails *silently* — nothing errors, entities just quietly stop updating). Leave **Auto update off**: this is a single point of failure for both the Zigbee mesh and Frigate, so it gets updated deliberately during the monthly maintenance pass, after a snapshot. **Show in sidebar** is cosmetic — Mosquitto has no real UI. Then create the build's two broker logins — the broker rejects unknown credentials by default, so a username nobody created just gets "not authorised". Add both under the app's **Configuration → Logins** list (or create dedicated non-admin Home Assistant users with these names): **`zigbee2mqtt`** for Z2M, used below, and **`mqtt-user`** for Frigate, used on the Cameras, Doorbell & Frigate page. Same broker, distinct logins — the broker's logs make it obvious who is talking.

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
Install Z2M as a Home Assistant app. Its apps live in a separate repository: in **Settings → Apps → Install app**, open the **⋮ menu → Repositories**, add `https://github.com/zigbee2mqtt/hassio-zigbee2mqtt`, then install **Zigbee2MQTT** from the store. In its MQTT settings, point it at the broker below and enter the `zigbee2mqtt` username and password you just created; everything Z2M publishes namespaces under `zigbee2mqtt/...` and stays out of Frigate's way. Then Z2M's serial settings — four fields, all in its settings UI, all load-bearing, because the ZBT-2 is a Silicon Labs MG24 behind a USB bridge that runs faster than Z2M's defaults and Z2M does not negotiate (wrong values here are the usual reason a ZBT-2 never connects or keeps dropping):

- **Adapter / driver** → `ember` (the one for the ZBT-2)
- **Baud rate** → `460800`
- **RTS/CTS hardware flow control** → on
- **Port** → the stable `/dev/serial/by-id/usb-Nabu_Casa_ZBT-2_…-if00` path, never `ttyACM0` — by-id survives reboots

In Z2M's **mqtt** section, the **server** field wants a URL, and the right one is the broker's *internal* name — **`mqtt://core-mosquitto:1883`** — not the VM's LAN address. Both are add-ons on this same Home Assistant, so the traffic never leaves the box, and the setting keeps working even if the VM's IP changes. Leave **ca / key / cert** blank (those are for TLS, unnecessary internally) and **base_topic** at `zigbee2mqtt`.

> [!INPUT] mqtt-host | Mosquitto broker address (for external clients) | 192.168.1.51
> Z2M uses `mqtt://core-mosquitto:1883` internally, but **Frigate is a separate container off-box** — it connects to the broker at this LAN address with its `mqtt-user` login, on the Cameras, Doorbell & Frigate page.

### Surface Z2M in Home Assistant
Once Z2M is talking to the broker, Home Assistant picks it up through the **MQTT integration**. Home Assistant auto-discovers the local Mosquitto app: in **Settings → Devices & services**, confirm the discovered **MQTT** integration and accept it — it connects with the app's own internal login, so there are no credentials to type. With both Z2M and Home Assistant on the broker, every device Z2M reports shows up as an ordinary Home Assistant entity automatically — no per-device wiring.

> [!NOTE]
> The non-Zigbee devices on this build — the Lutron Caséta bridge, the ecobee thermostats, the cameras, and the rest — arrive the same way, under **Settings → Devices & services** after onboarding (many auto-detected in the **Discovered** section). An empty Discovered list right after setup is normal. The cameras and locks get their integrations on their own pages, and the ecobee thermostats are onboarded on the Automations page. The Lutron Caséta bridge has no page of its own, so add it now: **Settings → Devices & services → Add integration → Lutron Caséta**, then press the button on the back of the bridge when prompted — the lights surface as entities for the scenes and scripts later in the build. **Adding Caséta switches later never means re-adding the integration:** pair the new switch in the *Lutron app* (the bridge owns the device list), then **Settings → Devices & services → Lutron Caséta → ⋮ → Reload** in Home Assistant and the new entities appear. That is the pattern for every hub-based integration — pair at the hub, reload in HA; only hub-less devices (the Zigbee ones through Z2M, the Matter locks) get paired inside Home Assistant itself.

## Pair the mesh

### Lay down the routers first
Plug in the **Third Reality 3RSP019BZ smart plugs** and pair them **before** anything battery-powered. They are mains-powered Zigbee **routers** — they build and extend the mesh that the battery sensors lean on. (Zigbee only — the 3RSP019BZ is a Zigbee/BLE device with no Thread support, so it can never extend the *Thread* mesh the locks use; that gap is discussed on the Matter Locks page.) Place them **near the sensor clusters and near the valve** so the leak devices and the shut-off always have a strong hop home. Pairing them takes three steps, and the first one is the trap — these plugs **ship in BLE mode**, not Zigbee, and a plug left in BLE simply never appears in Z2M, with no error to explain why:

1. **Switch it to Zigbee mode.** Press and **hold** the plug's button while inserting it into the outlet, until the **green** light comes on (green = BLE, the factory default, used by Third Reality's own app). Release, then **immediately press the button once**. The LED flashes **red** — Zigbee mode confirmed. Do this on every plug, including brand-new ones.
2. **Enter pairing mode.** Press and hold the button for **more than 10 seconds**, until the LED flashes.
3. **Open the network.** With **Permit join** already running in Z2M's frontend, the plug joins within a minute and appears in the device list.

> [!TIP]
> A few routers spread through the house turn a flaky single-hop mesh into a solid one. Pairing them first also means the sensors join *through* a nearby router rather than straining to reach the coordinator directly.

### Join the leak sensors
With routers in place, pair the **12× Third Reality 3RWS18BZ** siren leak sensors — one at every water risk: water heater, washer, dishwasher, each sink, the sump, and the fridge water line. Put each into pairing mode (pull the battery tab, or hold its button until it blinks), join it in Z2M, then immediately **rename it for its location** and assign it the matching Area. They arrive in Home Assistant as `binary_sensor.*_leak` entities.

> [!TIP]
> Name each sensor as you pair it — "Water Heater Leak", "Dishwasher Leak" — and drop it in its Area on the spot. Twelve identical sensors paired silently are impossible to tell apart later; named-as-you-go takes seconds.

### Join the shut-off valve
Pair the **Aqara Valve Controller T1** last. It is the clamp-on actuator on the **quarter-turn lever** main water valve — it physically turns the lever, so there are no plumbing changes. Put it in pairing mode, join it in Z2M, then **rename it so it surfaces as the `switch.main_water` entity** in Home Assistant — Z2M exposes the T1 as a plain **switch** (ON = open, OFF = closed), not a `valve.*` device, and that exact entity ID is what the leak-to-valve automation built later in this collection targets. A default name like `switch.aqara_valve_controller_t1` would leave that automation pointing at nothing.

> [!WARNING]
> Before trusting it, confirm the T1 throws the lever through its **full travel** — fully open to fully closed. Mount it so closed is genuinely closed; a clamp that slips is worse than no automation at all.

> [!NOTE]
> When pairing is done, turn **Permit join off** in Z2M. Leaving the network open invites stray devices and is a small but real security gap on an otherwise locked-down, local-first build.

## Keep it backed up

### Turn on Home Assistant's own backups
Home Assistant keeps its own backups separate from the whole-VM copy Proxmox takes. Turn them on now in the Home Assistant UI, under **Settings → System → Backups → Set up backups**: pick a **daily** schedule and **System optimal** for the time, and Home Assistant handles it from then on. These local backups are the fast in-app undo — one click to roll back a bad app or a broken automation.

### Point the backups at the NAS
On their own, those backups land on the VM's disk — the copy lives on the very thing it is protecting. Send them to the NAS instead — still in the Home Assistant UI: go to **Settings → System → Storage**, click **Add network storage**, and point it at the TrueNAS `backups` SMB (Server Message Block) share from the TrueNAS Storage page (server `192.168.1.20`, your SMB share credentials, **Usage: Backups**). Then under **Settings → System → Backups**, pick that network location as where backups go.

> [!NOTE]
> Parked on the NAS, Home Assistant's own backups are a real second copy as well as the quick in-app undo. The other layer is the **nightly Proxmox vzdump of the whole VM** (set up on the Proxmox Backups page) — that is what survives a dead VM disk and feeds the restore drill later in the build. The two layers do different jobs: HA's backups are the quick undo, the vzdump is the rebuild-from-scratch copy.

## Where this leads

### Confirm the entities exist
In the Home Assistant UI (`192.168.1.51:8123`), open **Settings → Devices & services → Entities** and filter for the new arrivals: twelve `binary_sensor.*_leak` sensors, the `switch.main_water` valve actuator, and the smart-plug switches and power readings. Each should sit in its Area with a human-readable name. That inventory is the prerequisite for the leak-to-valve automation built later in this collection — until the sensors and the valve exist as entities, there is nothing for that rule to listen to or close.

> [!TIP]
> The Lutron Caséta lights, the ecobee thermostats, the cameras through Frigate, and the Aqara U400 locks join Home Assistant through their own integrations rather than Zigbee — the locks and cameras are covered on their own pages, the ecobee is onboarded on the Automations page, and the Caséta bridge was added under Devices & services earlier on this page. This page's job is the Zigbee mesh and the safety devices riding it.
