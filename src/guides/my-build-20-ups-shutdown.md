---
title: UPS & Safe Shutdown
subtitle: Ride out the blips on the CyberPower battery, then shut the whole stack down clean
collection: My Build
order: 20
accent: azure
---

Every page up to here has quietly assumed the wall socket never falters. When it does — a half-second blip, a sagging brownout, a real outage — this server stops mid-write, which is the ending the ZFS (Zettabyte File System) mirror and a busy Frigate database handle worst. A UPS (uninterruptible power supply) — a battery sitting between the wall and the machine — fixes both halves: blips and brownouts are absorbed before anything notices, and in a real outage the battery buys the minutes needed to bring the stack down in order. The hardware is the **CyberPower CP1500PFCLCD**, a line-interactive 1500 VA / 1000 W unit with a USB data port, already on NUT's (Network UPS Tools) hardware compatibility list under the `usbhid-ups` driver.

> [!NOTE]
> A UPS buys minutes, not evenings. The CP1500PFCLCD's runtime at this build's modest draw is generous, but the plan stays the same: ride out the short stuff, shut down clean for the long stuff. This is also the answer to the two threads left hanging earlier — AdGuard needs a plan for this box going down, and Uptime Kuma's one blind spot is the server itself dying.

## Plug it in

### Wire the battery side
The whole tower goes on the CyberPower. Plug the View 71's EVGA 850W GQ PSU (power supply unit) into one of the UPS's **battery-backed** outlets — the CP1500PFCLCD also has surge-only outlets that go dark in an outage, so read the labels. If the Netgear GS308EPP switch and the house router reach, put them on battery too; with the network riding out a blip alongside the server, Tailscale and the local dashboards keep answering and nobody in the house notices anything happened.

Connect the bundled USB cable: the square B end into the UPS, the flat A end into a motherboard USB port on the ASUS ROG Maximus X Hero. This data link is the entire point — a battery with no USB port keeps the server up until it dies, then drops it mid-write anyway, the same dirty power-off, just delayed.

> [!NOTE]
> A new UPS may arrive only partly charged. Plug it in, let it top up, and save the rehearsals at the end of this page for when the battery shows full.

> [!WARNING]
> Pass the USB cable to the **Proxmox host**, not to any guest. NUT runs on the host because the host is what decides when the whole stack shuts down; the Home Assistant VM (virtual machine) reads the UPS later over the LAN (local area network), read-only.

## Teach the host to listen

### Install NUT
NUT is the open-source layer that talks to the UPS and acts on what it hears. On the Proxmox host's shell:

```bash
apt install nut
```

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50

The metapackage pulls in both halves: `nut-server` (the `usbhid-ups` driver plus `upsd`, a small daemon that publishes the UPS's state) and `nut-client` (`upsmon`, the watcher that will order the shutdown). On Debian 13 / Proxmox VE 9 (PVE) that is NUT 2.8.1, and the package installs the USB permission rules and systemd units for you. Everything sits idle until configured — NUT ships switched off (`MODE=none`).

### Write the four config files
NUT's behaviour lives in `/etc/nut/`. Four small edits: switch it on, name the UPS, create an account, and point the watcher at it.

```ini
# /etc/nut/nut.conf — change the existing MODE= line to:
MODE=standalone
```

```ini
# /etc/nut/ups.conf — append at the end:
[cyberpower]
    driver = usbhid-ups
    port = auto
    desc = "CyberPower CP1500PFCLCD"
```

```ini
# /etc/nut/upsd.users — append: the account upsmon signs in with
[admin]
    password = pick-a-long-password
    upsmon primary
```

```ini
# /etc/nut/upsmon.conf — append: watch that UPS (same password)
MONITOR cyberpower@localhost 1 admin pick-a-long-password primary
```

Two things that look like typos but aren't: the `upsmon primary` line really has no equals sign, and there is no shutdown command to add — Debian ships `upsmon.conf` with `SHUTDOWNCMD "/sbin/shutdown -h +0"` already active.

> [!INPUT] nut-admin-user | NUT admin username | | admin
> The `[admin]` section name in `upsd.users` — if you rename it, the `MONITOR` line must match.

> [!SECRET] nut-admin-password | NUT admin password
> Replaces `pick-a-long-password` in both files above — `upsd.users` and the `MONITOR` line must match.

> [!NOTE]
> These files hold a password, which is why they ship owned by `root:nut` and readable by no one else. Edit them in place and leave the ownership and permissions alone. Keep the password in Vaultwarden as the source of truth.

> [!DETAILS] Reading the four files back
> `MODE=standalone` means one local UPS protecting this machine, and starts all three NUT layers — driver, `upsd`, `upsmon`. The `[cyberpower]` section names the UPS (any name works, it just has to match the `MONITOR` line); `port = auto` is required syntax that `usbhid-ups` ignores, since it finds the CyberPower over USB by itself. The `MONITOR` line reads left to right: the UPS called `cyberpower` on this host feeds **1** of this host's power supplies; sign in as `admin`; this host is the **primary** — the one wired to the UPS, responsible for deciding when the load shuts down.

### Start it and prove it

```bash
systemctl restart nut-server nut-monitor
```

The driver needs no enabling by hand — NUT watches `ups.conf` and spins up a `nut-driver@cyberpower` service for the new section automatically. Then ask the UPS how it is doing:

```bash
upsc cyberpower@localhost
```

A healthy answer is a screenful of live variables. Three are worth knowing by name: `ups.status` (`OL` means on line power), `battery.charge` (percent), and `battery.runtime` (the UPS's own estimate of seconds remaining at the current load). You can also ask for one at a time: `upsc cyberpower@localhost ups.status`.

> [!DETAILS] Getting a stubborn driver going
> If `upsc` has nothing to say, check `systemctl status nut-driver@cyberpower`. If that unit doesn't *exist* at all, the per-UPS service was never generated from your `ups.conf` entry — `systemctl restart nut-driver-enumerator` creates it, then check again. Errors like "no appropriate HID device found" or permission denied usually mean a USB problem instead: reseat the cable first, then run `lsusb` and look for the CyberPower's vendor:product ID (CyberPower units commonly show as `0764:`). Debian's shipped udev rules cover it, but after any cable change replug it (or run `udevadm trigger`) and restart the driver.

## Handle the CyberPower USB-drop quirk

### Know the failure mode
CyberPower units, this model included, have a well-documented habit: the `usbhid-ups` driver loses the USB device under load or after a glitch and never reconnects on its own. `upsc` starts answering "Driver not connected" or the data goes stale, and a UPS the host can no longer hear is a UPS that will not trigger a shutdown when it matters — the silent failure this whole page exists to prevent. Two settings make the driver resilient, and a watchdog catches the case where it still wedges.

### Make the driver reconnect itself
Add three lines to the UPS's section so the driver polls steadily and re-grabs the device when the kernel re-enumerates it:

```ini
# /etc/nut/ups.conf — the [cyberpower] section becomes:
[cyberpower]
    driver = usbhid-ups
    port = auto
    desc = "CyberPower CP1500PFCLCD"
    pollinterval = 5
    pollfreq = 30
    maxretry = 3
```

Restart with `systemctl restart nut-server`, then confirm `upsc cyberpower@localhost ups.status` still returns `OL`.

> [!DETAILS] What the three knobs do
> `pollinterval` is how often the `usbhid-ups` driver polls the UPS for critical status changes — it watches the `OB` (on-battery) and `LB` (low-battery) bits on this cadence; `pollfreq` is how often the driver re-reads the full variable set from the hardware. `maxretry = 3` tells the driver to attempt the USB handshake three times before giving up at startup, which clears most cold-boot races where the UPS enumerates slightly after the driver launches. These tame the common case; the watchdog below covers the case where the link drops anyway.

### Add a watchdog timer
A small systemd timer restarts the driver if `upsc` ever reports it as not connected. Write the check script and make it executable:

```bash
cat > /usr/local/bin/nut-watchdog.sh <<'EOF'
#!/bin/bash
# Revive the CyberPower driver if the USB link has dropped.
if ! upsc cyberpower@localhost ups.status >/dev/null 2>&1; then
    logger -t nut-watchdog "cyberpower not answering — restarting driver"
    systemctl restart nut-driver@cyberpower
fi
EOF
chmod +x /usr/local/bin/nut-watchdog.sh
```

Then a service and a timer that fire it every two minutes:

```ini
# /etc/systemd/system/nut-watchdog.service
[Unit]
Description=Restart NUT driver if the CyberPower USB link drops
[Service]
Type=oneshot
ExecStart=/usr/local/bin/nut-watchdog.sh
```

```ini
# /etc/systemd/system/nut-watchdog.timer
[Unit]
Description=Run the NUT USB watchdog every two minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
```

Enable it: `systemctl daemon-reload && systemctl enable --now nut-watchdog.timer`.

> [!TIP]
> Prove the watchdog works: unplug and replug the UPS's USB cable, wait two minutes, and confirm `upsc cyberpower@localhost ups.status` answers again. `journalctl -t nut-watchdog` shows whether it had to step in. A watchdog you have never seen fire is the same unknown it was meant to remove.

## Make the shutdown automatic

### Understand the shutdown chain
From here the sequence is already wired, and it is deliberately patient. When the wall goes dead, the UPS reports on battery (`upsc` shows `OB`) and `upsmon` does nothing but wait — power usually comes back. Only when the CyberPower declares low battery (`OB LB`) does `upsmon` raise the forced-shutdown flag (`FSD`) and call `shutdown`. The host's shutdown stops the Proxmox guest service, which halts any running backup job (the vzdump schedule cannot wedge the exit) and asks every guest to shut down cleanly — in reverse startup order, up to 180 seconds per VM and 60 per container before a stuck guest is stopped hard. Then the host powers off, and last of all NUT tells the UPS to cut its output, so the load stops draining the battery and everything gets a clean power-cycle when mains returns.

> [!NOTE]
> Who decides "low"? The CyberPower does — the threshold is set in the device by its vendor, and `usbhid-ups` falls back to 30% only if the UPS reports nothing. The patience is by design: every extra minute on battery is another minute in which the power might return without anything having to stop.

> [!WARNING]
> Order matters for this build. The Home Assistant VM holds the Mosquitto-dependent automations, and the Frigate LXC (Linux container) talks to it over MQTT (Message Queuing Telemetry Transport) — so the **HA VM must go down before the Frigate LXC**, and the TrueNAS VM should outlast the service containers that may still be flushing to its shares. Set this with each guest's **Start/Shutdown order** in its **Options** tab: shutdown runs the startup order in reverse, so order 1 boots first and goes down last. Give TrueNAS the lowest order, HA a lower order than Frigate. One catch: **guests with no order set shut down before any numbered guest**, so anything that must outlast TrueNAS or HA — such as a service container still writing to a share — needs an explicit order too, not the default. Each guest's **Shutdown timeout** lives in the same **Options** tab, if one genuinely needs longer than the default to stop cleanly.

> [!DETAILS] Shutting down earlier than the UPS would
> If the CyberPower calls low battery later than you'd like, NUT documents two routes. One: in the `[cyberpower]` section, add `ignorelb` with `override.battery.charge.low = 50` (and/or `override.battery.runtime.low = 600`) so NUT judges "low" by your numbers instead of the device's flag — note some CyberPower models round the reported charge, so verify `upsc` shows a sane figure first. Two: an `upssched` timer started by the on-battery event that runs `upsmon -c fsd` after a fixed number of minutes. Either way, shutting down early throws away runtime during which the power might have returned.

### Teach it to come back
After the shutdown the UPS cuts its outlets, and when mains returns it switches them back on — but a powered outlet only boots the server if the firmware agrees. This is a fresh BIOS visit (the earlier hardware prep set virtualization and the slot mode, but not this): reboot the server, press **Del** at POST to enter the ASUS ROG Maximus X Hero BIOS, and go to **Advanced → APM Configuration → Restore AC Power Loss**, set it to **Power On**, then **F10** to save. NUT recommends "always power on" over "last state": the UPS shutdown was clean, so "last state" can remember *off* and leave the server dark in a powered house.

> [!TIP]
> With this set, the stack reassembles itself: the host boots when the outlets wake, and every guest marked to start at boot returns in its startup order — TrueNAS first, then the rest, with the HA VM ahead of the Frigate LXC. Nobody has to be home for the house to recover.

### Rehearse the outage
Two rehearsals, gentle then real. First the gentle one — pull the CyberPower's plug from the wall for half a minute while everything runs:

```bash
# Run before pulling the plug, then again while on battery:
upsc cyberpower@localhost ups.status
```

`OL` becomes `OB` (often `OB DISCHRG`), then returns to `OL` when you plug back in. Nothing shuts down — `upsmon` only acts when on-battery and low-battery are true together — but it proves the battery carries the load and the data link reports it. Then, at a quiet moment, the documented full drill, no battery-draining required:

```bash
upsmon -c fsd
```

This raises the forced-shutdown flag exactly as a critical battery would, and the whole chain runs for real: guests down in order, host off, UPS output cut and restored, and — BIOS step done — the stack boots back on its own. Time the run from command to powered-off; that number is what your battery's low-battery margin has to beat. When it's all back, glance over Uptime Kuma — anything that didn't make the round trip shows red.

> [!WARNING]
> `upsmon -c fsd` is a real shutdown, not a simulation, and once the flag is set it cannot be withdrawn. Pick a quiet moment and warn the household first — this drops the cameras, locks' HA control, and AdGuard DNS (Domain Name System) for the duration.

> [!DETAILS] Dry-running pieces of the drill without shutting down
> If you want to validate parts of the chain without the irreversible `upsmon -c fsd`: `upsdrvctl -t shutdown` prints the UPS power-off sequence the drivers would run, without calling them. And to watch `upsmon` pull the trigger without rebooting, temporarily point `SHUTDOWNCMD` at something harmless — edit the `SHUTDOWNCMD` line in `/etc/nut/upsmon.conf` to, say, `SHUTDOWNCMD "/usr/bin/logger -t nut-test FSD-fired"`, then trigger and watch `journalctl -t nut-test`. The catch: `SHUTDOWNCMD` changes need a full `systemctl restart nut-monitor`, not a reload — both when you set the dummy and when you put the real `/sbin/shutdown -h +0` back. Do not leave the dummy in place.

> [!TIP]
> Once, ever, on a quiet day, pull the plug and let the battery actually drain until the CyberPower itself declares `OB LB` and triggers everything. The timed `upsmon -c fsd` drill above proves the *shutdown chain* runs cleanly, but it bypasses the CyberPower's own low-battery logic entirely — it never tests whether the device asserts `OB LB` before the battery is exhausted. This full drain is the only test that proves the real low-battery trigger fires with margin to spare, at the cost of one battery cycle — worth doing once so the timed drill has a real-world anchor.

## Watch it from Home Assistant

### Open the UPS to the LAN
So far `upsd` speaks only to the host. Three edits open it to the LAN, read-only, and Home Assistant's native NUT integration does the rest.

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

Swap in the Proxmox host's actual IP on the second `LISTEN` line, then `systemctl restart nut-server nut-monitor`. In Home Assistant, go to **Settings → Devices & services**; the integration may already be waiting under discovered devices, otherwise add **Network UPS Tools (NUT)** and enter the host's IP, port `3493`, and the `hauser` credentials. The CyberPower appears as a device with **Battery charge** and **Status** sensors enabled out of the box — the latter reading "On Battery, Battery Discharging" when things get interesting. **Battery runtime** and the rest arrive disabled; enable them per entity if you want them.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!TIP]
> One automation earns its keep: trigger on the **Status** sensor changing to a state containing "On Battery" (capital B — the match is case-sensitive) and announce it through the Nest and Google speakers via Cast, plus a phone push from the Home Assistant companion app. The server already looks after itself; this turns a 3 am outage into a heads-up you actually hear instead of a mystery in the logs.

> [!NOTE]
> Port 3493 stays on the LAN. Listing specific addresses instead of `0.0.0.0` keeps the daemon off interfaces it doesn't need, and Home Assistant gets its own low-privilege account regardless. Never port-forward 3493 to the internet — remote access is Tailscale's job.

> [!DETAILS] Unblocking a connection that fails
> Proxmox's firewall is off by default, so guest-to-host traffic on TCP 3493 simply works; if you have since enabled it, add a rule allowing 3493 in. Otherwise confirm the restart took (`systemctl status nut-server`), that `MODE=netserver` is really set, and that the `LISTEN` address matches the host's real IP. Buttons and switches (outlet control) would need an account with `instcmds` rights, which `hauser` deliberately lacks.
