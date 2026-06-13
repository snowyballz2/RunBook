---
title: Home Assistant OS
subtitle: The official image — scripted or fully by hand
collection: Proxmox Home Server
order: 7
accent: violet
---

## Create the VM

### Create the HAOS VM
The workload many home servers exist for, with one trap: HAOS ships as a ready-made disk image, **not** an installer ISO — so skip the Create VM wizard and use one of the two paths below.

> [!DETAILS] The quick way — helper script
> The community-scripts helper downloads the official HAOS image and builds the VM for you. Run it in the Proxmox shell and accept the defaults — **2 cores, 4 GB RAM, a 32 GB disk** — which are enough to start:
>
> ```bash
> bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/haos-vm.sh)"
> ```
>
> If the host has RAM to spare, picking **Advanced** and giving the VM 8 GB buys apps (Home Assistant's new name for add-ons) more headroom — on a small host, leave the default.
>
> Same rule as before: you are piping a script into a root shell, so read it first (the download-read-run habit from the *Install Proxmox* guide) and make that call yourself.

> [!DETAILS] The manual way — no scripts
> Five commands in the Proxmox shell, using only official sources — no helper scripts. Check the [HAOS releases page](https://github.com/home-assistant/operating-system/releases) for the latest version and substitute it for `17.3` below. Replace `100` with a **free VM ID** — a number no other VM or container is using; `qm list` and `pct list` show the taken ones, and the next free number is whatever the web UI's Create wizard would suggest. Replace `local-lvm` with your storage name if it differs.
>
> ```bash
> # 1. Download and unpack the official image:
> cd /tmp
> wget https://github.com/home-assistant/operating-system/releases/download/17.3/haos_ova-17.3.qcow2.xz
> unxz haos_ova-17.3.qcow2.xz
>
> # 2. Create the VM shell. HAOS needs UEFI boot with secure boot off,
> #    which is what the efidisk line sets up:
> qm create 100 --name haos --ostype l26 --bios ovmf \
>   --efidisk0 local-lvm:0,efitype=4m,pre-enrolled-keys=0 \
>   --cores 2 --memory 4096 --scsihw virtio-scsi-pci \
>   --net0 virtio,bridge=vmbr0 --agent enabled=1
>
> # 3. Import the image as the VM's disk and make it the boot disk:
> qm disk import 100 /tmp/haos_ova-17.3.qcow2 local-lvm --target-disk scsi0
> qm set 100 --boot order=scsi0
>
> # 4. Optional — the image defaults to 32 GB; grow it if you want room:
> qm disk resize 100 scsi0 64G
>
> # 5. Start it:
> qm start 100
> ```

## First boot

### First contact
Give it a few minutes on first boot — HAOS sets itself up unattended. Then browse to `http://homeassistant.local:8123`, or find the VM's IP in Proxmox (the VM's **Summary** tab shows it, thanks to the guest agent — and the VM's own console banner prints the same address once it's up). From there the onboarding wizard takes over.

> [!NOTE]
> Home Assistant can show high RAM use right after boot. That is normal — it uses free memory for caching.

### Pin its address
Give the VM a fixed IP before you go further: use your router's DHCP reservation page (the same trick as the *AdGuard Home* guide), or set a static address inside Home Assistant itself under **Settings → System → Network**. Either works; pick one. Phone apps, dashboards, and other devices will all point at this address, and `homeassistant.local` doesn't resolve reliably on every network.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!TIP]
> A stable address now saves a round of reconfiguring every app and integration later.

### Walk the onboarding
The first screen is **Preparing Home Assistant** while it downloads the latest version (roughly 700 MB) — this can take twenty minutes or so depending on hardware and connection, so let it work. Then choose **Create my smart home** and the wizard walks you through an owner account, your home location, and an analytics choice, ending with **Finish**.

> [!WARNING]
> The owner account is the one account that cannot be recovered — Home Assistant's own docs say to store the name, username, and password somewhere safe. Save them below or in your password manager before clicking Create account.

> [!INPUT] ha-owner-user | Home Assistant owner username

> [!SECRET] ha-owner-password | Home Assistant owner password

> [!DETAILS] What each screen asks for
> **Owner account** — a Name (displayed in the UI), a Username (lowercase, no whitespace), and a Password; then **Create account**. **Home location** — used to set your time zone, unit system, and currency; then **Next**. **Analytics** — choose whether to share anonymized usage data; sharing is off by default. Confirm with **Next**, press **Finish**, and you land on your default dashboard.

### Add a first integration
Go to **Settings > Devices & services**. Anything Home Assistant has already spotted on your network sits in the **Discovered** section — select **Add** under one of them and follow the prompts. For something it has not found, select **Add integration** in the bottom-right corner and search for it.

> [!NOTE]
> Older walkthroughs show a "devices found on your network" screen inside the onboarding wizard itself. The current flow does discovery here instead, after onboarding — so an empty wizard is not a sign anything went wrong.

> [!NOTE]
> Worth knowing: cloud integrations (an ecobee thermostat, say) work by signing in to the vendor and route through the vendor's servers. Local integrations stay entirely on your network — part of why people run Home Assistant in the first place.

## Optional: Zigbee and Z-Wave radios

### Pass the USB radio through to the VM
Only relevant if you have (or buy) a Zigbee coordinator or Z-Wave stick — the USB radios that talk to battery-powered sensors, buttons, plugs, and door locks. Plug it into the server, then in Proxmox select the HAOS VM → **Hardware → Add → USB Device**, pick the radio by name, and reboot the VM.

> [!WARNING]
> Proxmox does not hand USB devices to a VM automatically. If Home Assistant can't see your stick, this missed passthrough step is almost always why.

> [!TIP]
> Keep a USB coordinator on a short extension cable to reduce interference from the server itself — or use a network-attached coordinator over Ethernet and skip USB passthrough entirely.

### Add the matching integration
In **Settings > Devices & services > Add integration**: for Zigbee, add **Zigbee Home Automation (ZHA)** — it detects the coordinator, then you put each device into pairing mode and add it. For Z-Wave, add the **Z-Wave** integration, which sets up Z-Wave JS and finds the stick; pair devices by putting them into inclusion mode (a smart lock is the classic reason Z-Wave exists).

> [!NOTE]
> ZHA is the built-in, simplest Zigbee path. Zigbee2MQTT is the more powerful app if you outgrow it later.

## Connect the house

### Know the few ways devices arrive
Whatever the device — a light, a blind, a lock, a thermostat — it reaches Home Assistant down one of a handful of paths: Wi-Fi devices and brand hubs appear as integrations under **Settings → Devices & services**, Zigbee and Z-Wave devices pair with the radios from the previous section, and Matter devices commission over Thread or Wi-Fi. Once aboard, every device becomes an *entity* of its kind — lights are `light`, locks `lock`, thermostats `climate`, and blinds land in a family called `cover`, Home Assistant's word for anything that opens and closes (shades, curtains, garage doors, gates — they all share open/close/position controls). Everything downstream treats them all alike.

> [!DETAILS] Hubs that play nicely
> Some of the best device families come with their own small hub that Home Assistant talks to **locally** — no cloud in the loop. Lutron Caséta is the classic: its Smart Bridge (standard or PRO, and the RA2 Select and RadioRA 3 processors) covers wall dimmers and Serena shades; you swap the wall switch for a Caséta dimmer and your existing bulbs keep working. Hunter Douglas PowerView shades work the same local way through their gateway. One honest contrast: Somfy shades connect through the Overkiz integration, which runs through the vendor's **cloud** by default — they work, but the "local hub" label doesn't apply.

> [!DETAILS] Locks, without the drama
> Smart locks sound like the scariest category, but the Z-Wave route keeps everything in the house: the lock pairs with your Z-Wave radio, control stays local, and the keypad and physical key keep working exactly as before — Home Assistant is an *addition*, not a replacement. Two well-trodden examples: the Yale Assure line accepts a plug-in Z-Wave module, and the Schlage Connect ships with Z-Wave built in.

> [!DETAILS] Matter — and the phone it requires
> Matter is the newer, vendor-neutral standard: local control, no manufacturer cloud. Two things to know before buying. Matter devices that use **Thread** need a *border router* on your network (some smart speakers and hubs double as one; Wi-Fi and Ethernet Matter devices need nothing extra). And commissioning a Matter device — scanning its QR code — happens in the **Home Assistant companion app on a phone with Bluetooth**; the web UI alone can't do it, which surprises people running HA in a VM with no Bluetooth at all. The phone bridges that gap.

> [!TIP]
> When buying anything new, search "[device] home assistant" first and favor whatever works locally — Zigbee, Z-Wave, Matter, or a local hub. For motorized blinds specifically, check the power story: battery models recharge on your schedule, wired or solar ones don't ask.

### Put every device in an Area
As each device lands, assign it a room under **Settings → Areas, labels & zones** (or on the device's own page). Two minutes of housekeeping that pays forever: dashboards group by area automatically, and a voice command like "turn off the kitchen" only works if Home Assistant knows what's *in* the kitchen. Connected, named, and sorted devices are the raw material — making them act on their own (lights at sunset, a porch light when someone's at the door) is a later guide's territory.

## Keep it healthy

### Turn on automatic backups
Go to **Settings > System > Backups** and select **Set up backups**. Pick a schedule — daily, or specific days — and a time preference (**System optimal** or **Custom**), and Home Assistant handles the rest from then on.

> [!DETAILS] Where the backups can live
> Three options. **Local** — the default, stored in the VM's own `/backup` directory; convenient, but it lives on the same virtual disk as Home Assistant itself. **Network storage** — add a network share and mark it for Backup use, putting copies on different hardware. **Home Assistant Cloud** — up to 5 GB, holding only the most recent backup saved there. The docs themselves recommend keeping backups somewhere other than the device Home Assistant runs on, and that advice is sound.

### Update safely
Updates appear under **Settings > System > Updates** — Home Assistant Core and the Operating System update separately, each with its own entry. The update dialog has a backup toggle; the docs recommend enabling it, and the automatic-backup setup can also back up before every update for you.

> [!TIP]
> Before a major update, also take a Proxmox snapshot of the VM — the snapshot habit from the *Virtual machines* guide. Two layers, two jobs: Home Assistant's own backups capture its configuration; the Proxmox snapshot captures the whole VM for a one-click rollback if an update goes sideways.
