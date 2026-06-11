---
title: UPS Shutdown
subtitle: Ride out the blips, shut down clean when the power really goes
collection: Proxmox Home Server
order: 14
accent: rose
---

## Why a UPS

### Know what the battery buys
Every guide so far has quietly assumed the wall socket never falters. When it does — a half-second blip, a sagging brownout, a real outage — the server stops mid-write, which is the ending ZFS pools and databases handle worst. Usually everything journals its way back on reboot; occasionally something doesn't, and you don't get to pick which. A UPS — an uninterruptible power supply, a battery sitting between the wall and the server — fixes both halves: blips and brownouts are absorbed before anything notices, and in a real outage the battery buys the minutes needed to shut the whole stack down in good order.

> [!NOTE]
> Scope, honestly: a UPS buys minutes, not evenings. Vendor figures for a flagship 1500 VA unit are around ten minutes of runtime at half load, and Eaton's sizing guidance treats roughly ten minutes — enough for a complete clean shutdown — as the design target. A home server's few dozen watts stretch the window much further, but the plan stays the same: ride out the short stuff, shut down clean for the long stuff.

> [!NOTE]
> Two earlier guides left a thread hanging here: *AdGuard Home* asked you to have a plan for this box going down, and *Uptime Kuma* admitted its one blind spot is the server itself dying. A UPS answers the first and narrows the second — outages become rare, short, and tidy.

## Pick and plug it in

### Choose the UPS
Three requirements, in order: a **line-interactive** design, a **USB data port** so the UPS can tell the server what is happening, and a **watt rating** comfortably above what you plug into it. The line-interactive consumer picks: APC **Back-UPS Pro**, CyberPower's CP/BR series, Eaton **Ellipse PRO** and 5S. Watch the entry models — the plain Back-UPS BE and Ellipse ECO are standby designs, so check the topology line on the spec sheet before paying. Before paying, look up the exact model on NUT's hardware compatibility list at `networkupstools.org/stable-hcl.html` — consumer USB units from these brands almost all appear with the `usbhid-ups` driver, which is the one this guide configures.

> [!WARNING]
> The data port is the whole point. A battery-backed unit with no USB (or network) port keeps the server up until the battery dies, then drops it mid-write anyway — the same dirty power-off, just delayed. No data link, no shutdown signal.

> [!DETAILS] Telling the three UPS designs apart
> The classic taxonomy (APC's own white paper) has three tiers. **Standby** is the cheapest: the inverter only starts when the power fails, which is fine for desktops and routers. **Line-interactive** also corrects low or high mains voltage without touching the battery, and is "the dominant type of UPS in the 0.5–5 kVA power range" — the standard for small servers, and exactly the band a home server sits in. **Double-conversion on-line** rebuilds the power continuously and is the usual choice above 10 kVA — data-center territory, priced accordingly.

> [!DETAILS] Sizing it without guesswork
> Every box carries two numbers, and the headline VA (volt-amperes — the vendor's marketing figure) is not the limit — the **watt rating** is. As an industry rule of thumb the watt rating runs about 60% of the VA figure (a flagship 1500 VA unit is a 1000 W unit). Add up the watt draw of everything going on the battery outlets and keep at least 15–25% headroom, per Eaton's sizing guidance. For scale, community wall-meter measurements put an N100-class mini PC at roughly 6–12 W idle and a modest desktop build at 20–30 W — spinning disks, real load, and any attached monitor add more. Even so, a small 600–900 VA unit is barely working to carry a mini-PC build plus network gear; spending more buys extra minutes of runtime, not extra protection.

### Plug it in
The server goes into the **battery-backed** outlets — many units also have surge-only outlets that go dark in an outage, so read the labels. Connect the USB cable: the square B end into the UPS, the flat A end into the server. Most consumer units include the cable (CyberPower's flagship lists one in the box), but confirm for your model at purchase. If the router and switch are within reach, put them on battery too — with the network riding out a blip alongside the server, *Remote Access* keeps answering and nobody in the house notices anything happened.

> [!NOTE]
> A new UPS may arrive only partly charged. Plug it in, let it top up, and save the rehearsals at the end of this guide for when the battery shows full.

## Teach the server to listen

### Install NUT
NUT — Network UPS Tools — is the open-source layer that talks to the UPS and acts on what it hears. On the Proxmox host's shell:

```bash
apt install nut
```

The metapackage pulls in both halves: `nut-server` (the hardware driver plus `upsd`, a small daemon that publishes the UPS's state) and `nut-client` (`upsmon`, the watcher that will eventually order the shutdown). On Debian 13 / Proxmox VE 9 that is NUT 2.8.1, and the package also installs the USB permission rules and systemd units for you. Everything then sits idle, because NUT ships switched off (`MODE=none`) until configured.

### Write the four config files
NUT's behavior lives in `/etc/nut/`. Four small edits: switch it on, name the UPS, create an account, and point the watcher at it.

```ini
# /etc/nut/nut.conf — change the existing MODE= line to:
MODE=standalone
```

```ini
# /etc/nut/ups.conf — append at the end:
[myups]
    driver = usbhid-ups
    port = auto
    desc = "Server UPS"
```

```ini
# /etc/nut/upsd.users — append: the account upsmon signs in with
[admin]
    password = pick-a-long-password
    upsmon primary
```

```ini
# /etc/nut/upsmon.conf — append: watch that UPS (same password)
MONITOR myups@localhost 1 admin pick-a-long-password primary
```

Two things that look like typos but aren't: the `upsmon primary` line really has no equals sign, and there is no shutdown command to add — Debian ships `upsmon.conf` with `SHUTDOWNCMD "/sbin/shutdown -h +0"` already active.

> [!NOTE]
> These files hold a password, which is why they ship owned by `root:nut` and readable by no one else. Edit them in place and leave the ownership and permissions alone.

> [!SECRET] nut-admin-password | NUT admin password
> Replaces `pick-a-long-password` in both files above — `upsd.users` and the `MONITOR` line must match.

> [!DETAILS] Reading the four files back
> `MODE=standalone` means one local UPS protecting this machine, and starts all three NUT layers — driver, `upsd`, `upsmon`. The `[myups]` section names the UPS (any name works, it just has to match the `MONITOR` line); `port = auto` is required syntax that `usbhid-ups` ignores, since it finds the UPS over USB by itself. The `MONITOR` line reads left to right: the UPS called `myups` on this machine feeds **1** of this machine's power supplies; sign in as `admin`; this machine is the **primary** — the one wired to the UPS, responsible for deciding when the load shuts down.

### Start it and prove it

```bash
systemctl restart nut-server nut-monitor
```

The driver needs no enabling by hand — NUT watches `ups.conf` and spins up a `nut-driver@myups` service for the new section automatically. Then ask the UPS how it is doing:

```bash
upsc myups@localhost
```

A healthy answer is a screenful of live variables. Three are worth knowing by name: `ups.status` (`OL` means on line power), `battery.charge` (percent), and `battery.runtime` (the UPS's own estimate of seconds remaining at the current load). You can also ask for one at a time: `upsc myups@localhost ups.status`.

> [!DETAILS] Getting a stubborn driver going
> If `upsc` has nothing to say, check `systemctl status nut-driver@myups`. Errors like "no appropriate HID device found" or permission denied usually mean a USB problem: reseat the cable first, then run `lsusb` and find the UPS's vendor:product ID. Debian's shipped udev rules cover hundreds of UPS IDs and are applied automatically, but an oddball unit may need a custom rule keyed to its ID — after adding one, replug the cable (or run `udevadm trigger`) and restart the driver.

## Make the shutdown automatic

### Understand the shutdown chain
From here the sequence is already wired, and it is deliberately patient. When the wall goes dead, the UPS reports on battery (`upsc` shows `OB`) and `upsmon` does nothing but wait — power usually comes back. Only when the UPS itself declares low battery (`OB LB`) does `upsmon` raise the forced-shutdown flag (`FSD`) and call `shutdown`. The host's shutdown stops the Proxmox guest service, which halts any running backup job (the *Proxmox Backups* schedule cannot wedge the exit) and asks every guest to shut down cleanly — in reverse startup order, with up to 180 seconds per VM and 60 per container before a stuck guest is stopped hard. Then the host powers off, and last of all NUT tells the UPS to cut its output, so the load stops draining the battery and everything gets a clean power-cycle when mains returns.

> [!NOTE]
> Who decides "low"? The UPS does — the threshold is set in the device by its vendor, and `usbhid-ups` falls back to 30% only if the UPS reports nothing. The patience is by design; NUT's own FAQ puts it plainly: every extra minute on battery is another minute in which the power might return without anything having to stop.

> [!DETAILS] Ordering the guests' exit
> If some guests should outlast others — TrueNAS holding shares the rest are still flushing to, say — revisit the **Start/Shutdown order** in each guest's **Options** tab, the same knob the *Containers* guide pointed at: shutdown runs the startup order in reverse, so order 1 boots first and goes down last. Guests with no order set shut down before the numbered ones. Each guest's **Shutdown timeout** lives there too, if one genuinely needs longer than the default to stop.

> [!DETAILS] Shutting down earlier than the UPS would
> If your UPS calls low battery later than you'd like, NUT documents two routes. One: in the `[myups]` section of `ups.conf`, add `ignorelb` together with `override.battery.charge.low = 50` (and/or `override.battery.runtime.low = 600`) so NUT judges "low" by your numbers instead of the device's flag — this needs a UPS that reports charge or runtime reliably, and some CyberPower models quietly round the value to ones they accept. Two: an `upssched` timer started by the on-battery event that runs `upsmon -c fsd` after a fixed number of minutes. NUT's FAQ pushes back on both, fairly: shutting down early throws away runtime during which the power might have returned.

### Teach it to come back
The loop has one more arc: after the shutdown the UPS cuts its outlets, and when mains returns it switches them back on — but a powered outlet only boots the server if the firmware agrees. Back in the BIOS screens from *Prep & BIOS*, find the AC-power-loss behavior — vendors name it differently, along the lines of **Restore on AC Power Loss** or **AC Power Recovery** — and set it to **power on**. NUT's own FAQ recommends "always power on" over "last state": the UPS shutdown was clean, so "last state" can remember *off* and leave the server dark in a powered house.

> [!TIP]
> With this set, the stack reassembles itself: the host boots when the outlets wake, and every guest marked to start at boot returns in its startup order. Nobody has to be home for the house to recover.

### Rehearse the outage
Two rehearsals, gentle then real. First the gentle one — pull the UPS's plug out of the wall for half a minute while everything runs:

```bash
# Run before pulling the plug, then again while on battery:
upsc myups@localhost ups.status
```

`OL` becomes `OB` (often `OB DISCHRG`), then returns to `OL` when you plug back in. Nothing shuts down — `upsmon` only acts when on-battery and low-battery are true at the same time — but it proves the battery carries the load and the data link reports it. Then, at a quiet moment, the documented full drill, no battery-draining required:

```bash
upsmon -c fsd
```

This raises the forced-shutdown flag exactly as a critical battery would, and the whole chain runs for real: guests down in order, host off, UPS output cut and restored (the machine may stay dark anywhere from seconds to a few minutes, depending on the unit), and — BIOS step done — the stack boots back up on its own. Time the run from command to powered-off; that is the number your battery's low-battery margin has to beat. When it's all back, glance over *Uptime Kuma* — anything that didn't make the round trip shows red.

> [!WARNING]
> `upsmon -c fsd` is a real shutdown, not a simulation, and once the flag is set it cannot be withdrawn — there is no cancelling mid-drill. Pick a quiet moment and warn the household first.

> [!DETAILS] Dry-running pieces of the drill
> `upsdrvctl -t shutdown` prints the UPS power-off sequence the drivers would execute, without calling them. And to watch `upsmon` pull the trigger without rebooting anything, NUT's docs suggest temporarily pointing `SHUTDOWNCMD` at something harmless and watching the logs — just know that `SHUTDOWNCMD` changes need a full `systemctl restart nut-monitor`, not a reload, both when you set the dummy and when you put the real command back.

## Watch it from Home Assistant (optional)

### Let Home Assistant see the UPS
So far `upsd` speaks only to this machine. Three edits open it to the LAN, read-only, and Home Assistant's native NUT integration does the rest.

```ini
# /etc/nut/nut.conf — change MODE once more:
MODE=netserver
```

```ini
# /etc/nut/upsd.conf — append: keep localhost, add the host's LAN address
LISTEN 127.0.0.1 3493
LISTEN 192.168.1.50 3493
```

```ini
# /etc/nut/upsd.users — append: a watch-only account for Home Assistant
[hauser]
    password = a-different-long-password
```

Swap in your Proxmox host's IP on the second `LISTEN` line, then `systemctl restart nut-server nut-monitor`. In Home Assistant — the VM from *Home Assistant OS* — go to **Settings → Devices & services**; the integration may already be waiting under discovered devices, otherwise add **Network UPS Tools (NUT)** and enter the host's IP, port `3493`, and the `hauser` credentials. The UPS appears as a device with **Battery charge** and **Status** sensors enabled out of the box — the latter reading "On Battery, Battery Discharging" when things get interesting. **Battery runtime** and the rest arrive disabled; enable them per entity if you want them.

> [!TIP]
> One automation earns its keep: trigger on the **Status** sensor changing to a state that contains "On Battery" (capital B — the match is case-sensitive), and send a phone notification (via the Home Assistant companion app on your phone, if you use it — otherwise the alert-email habit from *Protect TrueNAS Data* works here too). The server already looks after itself; this just turns a 3 am outage into a message you read at breakfast instead of a mystery in the logs.

> [!NOTE]
> Port 3493 stays on the LAN. Listing specific addresses instead of `0.0.0.0` keeps the daemon off interfaces it doesn't need — though NUT's docs are frank that address binding alone is not a security boundary, which is why Home Assistant gets its own low-privilege account. Never port-forward 3493 to the internet.

> [!DETAILS] Unblocking a connection that fails
> Proxmox's firewall is disabled by default, so guest-to-host traffic on TCP 3493 simply works; if you have since enabled it, add a rule allowing 3493 in. Otherwise confirm the restart took (`systemctl status nut-server`), that `MODE=netserver` is really set, and that the `LISTEN` address matches the host's actual IP. Inside the integration, most sensors beyond Battery charge and Status arrive disabled by default — enable them per entity. Buttons and switches (outlet control, on units that support it) need an account with `instcmds` rights, which `hauser` deliberately lacks.
