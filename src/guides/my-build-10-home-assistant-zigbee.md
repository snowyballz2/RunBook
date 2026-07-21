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
Home Assistant OS ships as a ready-made disk image, **not** an installer ISO — so skip the Create VM wizard and use one of the two paths below. Either way, give it **2 cores and 8 GB RAM** (this box has it to spare, and add-ons want the headroom) and a 32 GB disk.

> [!DETAILS] The quick way — helper script
> The community-scripts helper downloads the official image and builds the VM for you. Run it in the Proxmox host shell, pick **Advanced**, and bump it to **8 GB RAM** while keeping the 2 cores and 32 GB disk:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> You are piping a script into a root shell, so download it and read it first, then make that call yourself.

> [!DETAILS] The manual way — no scripts
> Four commands in the host shell, official sources only. Check the [HA OS releases page](https://github.com/home-assistant/operating-system/releases) for the current version and substitute it for `17.3` below. Replace `110` with a **free VM ID** (`qm list` and `pct list` show the taken ones — the next free number is whatever the web UI's Create wizard would suggest) and `local-lvm` with your storage name if it differs:
>
> ```bash
> # 1. Download and unpack the official image:
> cd /tmp
> wget https://github.com/home-assistant/operating-system/releases/download/17.3/haos_ova-17.3.qcow2.xz
> unxz haos_ova-17.3.qcow2.xz
>
> # 2. Create the VM shell. HA OS needs UEFI boot with secure boot off:
> qm create 110 --name haos --ostype l26 --bios ovmf \
>   --efidisk0 local-lvm:0,efitype=4m,pre-enrolled-keys=0 \
>   --cores 2 --memory 8192 --scsihw virtio-scsi-pci \
>   --net0 virtio,bridge=vmbr0 --agent enabled=1
>
> # 3. Import the image as the boot disk:
> qm disk import 110 /tmp/haos_ova-17.3.qcow2 local-lvm --target-disk scsi0
> qm set 110 --boot order=scsi0
>
> # 4. Start it:
> qm start 110
> ```

> [!NOTE]
> Set the **Start/Shutdown order** so this VM boots **before** the Frigate LXC every time. Frigate points at the Mosquitto MQTT (Message Queuing Telemetry Transport) broker that lives alongside it, and keeping Home Assistant up first holds the dependency order clean. Open the VM's **Options → Start/Shutdown order** and give it a lower number than Frigate.

### Pin its address
Give the VM a fixed IP before anything else points at it: a DHCP (Dynamic Host Configuration Protocol) reservation on the router, or a static address inside Home Assistant under **Settings → System → Network** (that screen only exists once the onboarding below is done). Pick one. Phone apps, dashboards, and the MQTT links all use this address, and `homeassistant.local` does not resolve reliably on every network.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

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
This build runs **Zigbee2MQTT (Z2M), not ZHA (Zigbee Home Automation)** — broader device support, and it speaks the same MQTT bus the rest of the build uses — and it runs as a Home Assistant add-on, so the coordinator goes to the Home Assistant OS VM. Plug the **HA Connect ZBT-2** into the server on a short USB extension cable (keeps the radio away from case interference), then pass it through: in Proxmox, select the VM → **Hardware → Add → USB Device**, pick the ZBT-2 by name, and reboot the VM.

> [!WARNING]
> Proxmox does not hand USB devices to a guest automatically. If Z2M cannot see the coordinator, this missed passthrough step is almost always why.

### Stand up the Mosquitto broker and its logins
The whole build talks over one **Mosquitto** broker, and it lives here on the Home Assistant VM: install the official **Mosquitto broker** add-on (**Settings → Add-ons → Add-on store**) if it is not already running, and do not stand up a second broker anywhere else. Then create the build's two broker logins — the broker rejects unknown credentials by default, so a username nobody created just gets "not authorised". Add both under the add-on's **Configuration → Logins** list (or create dedicated non-admin Home Assistant users with these names): **`zigbee2mqtt`** for Z2M, used below, and **`mqtt-user`** for Frigate, used on the Cameras, Doorbell & Frigate page. Same broker, distinct logins — the broker's logs make it obvious who is talking.

> [!INPUT] z2m-mqtt-user | Zigbee2MQTT's own MQTT username | | zigbee2mqtt
> Created in the broker's Logins a moment ago. Separate from Frigate's `mqtt-user` — same broker, distinct login.

> [!SECRET] z2m-mqtt-password | Zigbee2MQTT's MQTT password

> [!SECRET] frigate-mqtt-password | Frigate's MQTT password (login `mqtt-user`)
> Created now so the broker knows it; Frigate itself enters this pair on the Cameras, Doorbell & Frigate page.

### Point Z2M at the Mosquitto broker
Install Z2M as a Home Assistant add-on. Its add-ons live in a separate repository: in **Settings → Add-ons → Add-on store**, open the **⋮ menu → Repositories**, add `https://github.com/zigbee2mqtt/hassio-zigbee2mqtt`, then install **Zigbee2MQTT** from the store. In its MQTT settings, point it at the broker below and enter the `zigbee2mqtt` username and password you just created; everything Z2M publishes namespaces under `zigbee2mqtt/...` and stays out of Frigate's way. In Z2M's settings, select the **`ember`** driver — that is the one for the ZBT-2.

> [!INPUT] mqtt-host | Mosquitto broker address | 192.168.1.51
> Where the broker listens — the Home Assistant VM, on the standard port `1883`. Frigate connects to this same broker with its `mqtt-user` login on the Cameras, Doorbell & Frigate page.

### Surface Z2M in Home Assistant
Once Z2M is talking to the broker, Home Assistant picks it up through the **MQTT integration**. Home Assistant auto-discovers the local Mosquitto add-on: in **Settings → Devices & services**, confirm the discovered **MQTT** integration and accept it — it connects with the add-on's own internal login, so there are no credentials to type. With both Z2M and Home Assistant on the broker, every device Z2M reports shows up as an ordinary Home Assistant entity automatically — no per-device wiring.

> [!NOTE]
> The non-Zigbee devices on this build — the Lutron Caséta bridge, the ecobee thermostats, the cameras, and the rest — arrive the same way, under **Settings → Devices & services** after onboarding (many auto-detected in the **Discovered** section). An empty Discovered list right after setup is normal. The cameras and locks get their integrations on their own pages, and the ecobee thermostats are onboarded on the Automations page. The Lutron Caséta bridge has no page of its own, so add it now: **Settings → Devices & services → Add integration → Lutron Caséta**, then press the button on the back of the bridge when prompted — the lights surface as entities for the scenes and scripts later in the build.

## Pair the mesh

### Lay down the routers first
Plug in the **Third Reality 3RSP019BZ smart plugs** and pair them **before** anything battery-powered. They are mains-powered Zigbee **routers** — they build and extend the mesh that the battery sensors lean on. Place them **near the sensor clusters and near the valve** so the leak devices and the shut-off always have a strong hop home. To pair, power the plug on and put Z2M into pairing mode with **Permit join (All)**; the plug joins within a minute.

> [!TIP]
> A few routers spread through the house turn a flaky single-hop mesh into a solid one. Pairing them first also means the sensors join *through* a nearby router rather than straining to reach the coordinator directly.

### Join the leak sensors
With routers in place, pair the **12× Third Reality 3RWS18BZ** siren leak sensors — one at every water risk: water heater, washer, dishwasher, each sink, the sump, and the fridge water line. Put each into pairing mode (pull the battery tab, or hold its button until it blinks), join it in Z2M, then immediately **rename it for its location** and assign it the matching Area. They arrive in Home Assistant as `binary_sensor.*_leak` entities.

> [!TIP]
> Name each sensor as you pair it — "Water Heater Leak", "Dishwasher Leak" — and drop it in its Area on the spot. Twelve identical sensors paired silently are impossible to tell apart later; named-as-you-go takes seconds.

### Join the shut-off valve
Pair the **Aqara Valve Controller T1** last. It is the clamp-on actuator on the **quarter-turn lever** main water valve — it physically turns the lever, so there are no plumbing changes. Put it in pairing mode, join it in Z2M, then **rename it so it surfaces as the `valve.main_water` entity** in Home Assistant — that exact entity ID is what the leak-to-valve automation built later in this collection targets, so a default name like `valve.aqara_valve_controller_t1` would leave that automation pointing at nothing.

> [!WARNING]
> Before trusting it, confirm the T1 throws the lever through its **full travel** — fully open to fully closed. Mount it so closed is genuinely closed; a clamp that slips is worse than no automation at all.

> [!NOTE]
> When pairing is done, turn **Permit join off** in Z2M. Leaving the network open invites stray devices and is a small but real security gap on an otherwise locked-down, local-first build.

## Keep it backed up

### Turn on Home Assistant's own backups
Home Assistant keeps its own backups separate from the whole-VM copy Proxmox takes. Turn them on now under **Settings → System → Backups → Set up backups**: pick a **daily** schedule and **System optimal** for the time, and Home Assistant handles it from then on. These local backups are the fast in-app undo — one click to roll back a bad add-on or a broken automation.

### Point the backups at the NAS
On their own, those backups land on the VM's disk — the copy lives on the very thing it is protecting. Send them to the NAS instead: go to **Settings → System → Storage**, click **Add network storage**, and point it at the TrueNAS `backups` SMB (Server Message Block) share from the TrueNAS Storage page (server `192.168.1.20`, your SMB share credentials, **Usage: Backups**). Then under **Settings → System → Backups**, pick that network location as where backups go.

> [!NOTE]
> Parked on the NAS, Home Assistant's own backups are a real second copy as well as the quick in-app undo. The other layer is the **nightly Proxmox vzdump of the whole VM** (set up on the Proxmox Backups page) — that is what survives a dead VM disk and feeds the restore drill later in the build. The two layers do different jobs: HA's backups are the quick undo, the vzdump is the rebuild-from-scratch copy.

## Where this leads

### Confirm the entities exist
Open **Settings → Devices & services → Entities** and filter for the new arrivals: twelve `binary_sensor.*_leak` sensors, the `valve.main_water` actuator, and the smart-plug switches and power readings. Each should sit in its Area with a human-readable name. That inventory is the prerequisite for the leak-to-valve automation built later in this collection — until the sensors and the valve exist as entities, there is nothing for that rule to listen to or close.

> [!TIP]
> The Lutron Caséta lights, the ecobee thermostats, the cameras through Frigate, and the Aqara U400 locks join Home Assistant through their own integrations rather than Zigbee — the locks and cameras are covered on their own pages, the ecobee is onboarded on the Automations page, and the Caséta bridge was added under Devices & services earlier on this page. This page's job is the Zigbee mesh and the safety devices riding it.
