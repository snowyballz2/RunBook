---
title: Home Assistant & Zigbee2MQTT
subtitle: My Build — the HA OS VM, onboarding, Areas, and the Zigbee mesh on the ZBT-2
collection: My Build
order: 9
accent: emerald
---

This is the brain of the house. Home Assistant runs as its own **VM (virtual machine)** — it needs its own kernel and is not a plain Linux service, so it does not go in a container like AdGuard or Nextcloud. Once it is onboarded, **Zigbee2MQTT (Z2M)** rides the **HA Connect ZBT-2** coordinator and joins the battery-powered devices this build depends on: a dozen leak sensors, the water shut-off valve, and the mains-powered plugs that hold the mesh together. By the end of this page Home Assistant knows every Zigbee device by name and which room it lives in — the raw material the automations later act on.

> [!NOTE]
> Do not VFIO (Virtual Function I/O) anything to this VM. The GTX 1080 Ti stays shared from the Proxmox host into the service LXCs (Linux Containers); the only PCIe (Peripheral Component Interconnect Express) passthrough on this build is the HBA (host bus adapter) to TrueNAS. Home Assistant reaches the GPU-backed services over the LAN (local area network).

## Stand up the VM

### Create the Home Assistant OS VM
Home Assistant OS ships as a ready-made disk image, **not** an installer ISO — so skip the Create VM wizard and use one of the two paths below. Either way, give it **2 cores and 8 GB RAM** (this box has it to spare, and apps — Home Assistant's name for add-ons — want the headroom) and a 32 GB disk.

> [!DETAILS] The quick way — helper script
> The community-scripts helper downloads the official image and builds the VM for you. Run it in the Proxmox host shell, pick **Advanced**, and bump it to **8 GB RAM** while keeping the 2 cores and 32 GB disk:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> You are piping a script into a root shell, so download it and read it first, then make that call yourself.

> [!DETAILS] The manual way — no scripts
> Four commands in the host shell, official sources only. Check the [HA OS releases page](https://github.com/home-assistant/operating-system/releases) for the current version and substitute it for `17.3` below. Replace `110` with a **free VM ID** (`qm list` and `pct list` show the taken ones) and `local-lvm` with your storage name if it differs:
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
Give the VM a fixed IP before anything else points at it: a DHCP (Dynamic Host Configuration Protocol) reservation on the router, or a static address inside Home Assistant under **Settings → System → Network**. Pick one. Phone apps, dashboards, and the MQTT links all use this address, and `homeassistant.local` does not resolve reliably on every network.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

## First boot

### Walk the onboarding
Give it a few minutes on first boot — Home Assistant OS sets itself up unattended. Then browse to `http://homeassistant.local:8123` (or the pinned IP). The first screen is **Preparing Home Assistant** while it downloads the latest version (roughly 700 MB) — this can take twenty minutes, so let it work. Then choose **Create my smart home** and the wizard walks you through the owner account, your home location (it sets time zone, units, and currency), and an analytics choice, ending with **Finish**.

> [!WARNING]
> The owner account is the one account that cannot be recovered. It is also kept in Vaultwarden, but record it below too so this checklist stands on its own — save it before you click **Create account**.

> [!INPUT] ha-owner-user | Home Assistant owner username

> [!SECRET] ha-owner-password | Home Assistant owner password

### Sketch the Areas now
Before any devices arrive, lay out your rooms under **Settings → Areas, labels & zones**. Add an Area per room — kitchen, laundry, garage, basement, baths — so that as each Zigbee device joins you can drop it straight into the right one. Two minutes that pays forever: dashboards group by Area automatically, and voice and automation targeting only works once Home Assistant knows what is *in* each room.

> [!TIP]
> Name the Areas the way you would say them out loud ("Laundry Room", not "laundry_1"). Those names become the words a Cast announcement or a future voice command leans on.

## Zigbee2MQTT on the ZBT-2

### Pass the coordinator through
This build runs **Zigbee2MQTT (Z2M), not ZHA (Zigbee Home Automation)** — broader device support, and it speaks the same MQTT bus the rest of the build uses. Plug the **HA Connect ZBT-2** into the server on a short USB extension cable (keeps the radio away from case interference), then pass it through to wherever Z2M runs. In Proxmox, select the guest → **Hardware → Add → USB Device**, pick the ZBT-2 by name, and reboot the guest.

> [!WARNING]
> Proxmox does not hand USB devices to a guest automatically. If Z2M cannot see the coordinator, this missed passthrough step is almost always why.

### Point Z2M at the Mosquitto broker
Install Z2M — either as a Home Assistant add-on or in its own LXC — and connect it to the **Mosquitto broker running on the Home Assistant VM** — install the official Mosquitto broker add-on in Home Assistant first if it is not already running. Do not stand up a second broker. Give Z2M its **own** MQTT username and password (distinct from Frigate's login) so the logs make it obvious who is talking; everything Z2M publishes namespaces under `zigbee2mqtt/...` and stays out of Frigate's way. In Z2M's settings, select the **`ember`** driver — that is the one for the ZBT-2.

> [!INPUT] z2m-mqtt-user | Zigbee2MQTT's own MQTT username | | zigbee2mqtt
> Separate from Frigate's `mqtt-user`. Same broker, distinct login.

> [!SECRET] z2m-mqtt-password | Zigbee2MQTT's MQTT password

> [!INPUT] mqtt-host | Mosquitto broker address | 192.168.1.51
> Where the broker listens — the Home Assistant VM, on the standard port `1883`. Frigate connects to this same broker later.

### Surface Z2M in Home Assistant
Once Z2M is talking to the broker, Home Assistant picks it up through the **MQTT integration**. In **Settings → Devices & services**, add **MQTT** if it is not already there and point it at the same broker with Home Assistant's own MQTT credentials. With both Z2M and Home Assistant on the broker, every device Z2M reports shows up as an ordinary Home Assistant entity automatically — no per-device wiring.

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
Pair the **Aqara Valve Controller T1** last. It is the clamp-on actuator on the **quarter-turn lever** main water valve — it physically turns the lever, so there are no plumbing changes. Put it in pairing mode, join it in Z2M, and it surfaces as a `valve.*` entity in Home Assistant.

> [!WARNING]
> Before trusting it, confirm the T1 throws the lever through its **full travel** — fully open to fully closed. Mount it so closed is genuinely closed; a clamp that slips is worse than no automation at all.

> [!NOTE]
> When pairing is done, turn **Permit join off** in Z2M. Leaving the network open invites stray devices and is a small but real security gap on an otherwise locked-down, local-first build.

## Where this leads

### Confirm the entities exist
Open **Settings → Devices & services → Entities** and filter for the new arrivals: twelve `binary_sensor.*_leak` sensors, the `valve.*` actuator, and the smart-plug switches and power readings. Each should sit in its Area with a human-readable name. That inventory is the prerequisite for the leak-to-valve automation built later in this collection — until the sensors and the valve exist as entities, there is nothing for that rule to listen to or close.

> [!TIP]
> The Lutron Caséta lights and shades, the ecobee thermostats, the Reolink cameras through Frigate, and the Aqara U400 locks join Home Assistant through their own integrations rather than Zigbee — those are covered on their own pages. This page's job is the Zigbee mesh and the safety devices riding it.
