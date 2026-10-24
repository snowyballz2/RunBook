---
title: UPS & Safe Shutdown
subtitle: Ride out the blips on the CyberPower battery, then shut the whole stack down clean
collection: My Build
order: 21
accent: azure
---

The AdGuard and Uptime Kuma pages both leaned on this box's UPS (uninterruptible power supply) to shrug off brief power blips — this is the page that actually installs and wires it. When the wall socket falters — a half-second blip, a sagging brownout, a real outage — this server stops mid-write, which is the ending the ZFS (Zettabyte File System) mirror and a busy Frigate database handle worst. A UPS — a battery sitting between the wall and the machine — fixes both halves: blips and brownouts are absorbed before anything notices, and in a real outage the battery buys the minutes needed to bring the stack down in order. The hardware is the **CyberPower CP1500PFCLCD**, a line-interactive 1500 VA / 1000 W unit with a USB data port, already on NUT's (Network UPS Tools) hardware compatibility list under the `usbhid-ups` driver.

> [!NOTE]
> A UPS buys minutes, not evenings. The CP1500PFCLCD's runtime at this build's modest draw is generous, but the plan stays the same: ride out the short stuff, shut down clean for the long stuff. This is also the answer to the two threads left hanging earlier — the AdGuard page promised outages would end in a clean shutdown once this page wired one up, and Uptime Kuma's one blind spot is the server itself dying.

## Plug it in

### Wire the battery side
Four things go on the CyberPower's **battery-backed** outlets — the CP1500PFCLCD also has surge-only outlets that go dark in an outage, so read the labels before plugging anything in:

- **The server** — the View 71's Toughpower Grand RGB 850W PSU (power supply unit)
- **The Fios router**
- **The Fios ONT**
- **The Caséta bridge**

That set is deliberate — the server plugs straight into the router with no switch between them, so through an outage you keep Wi-Fi, Tailscale, the dashboards, and every Zigbee/Thread automation (both radios hang off the server), and with the ONT on battery, internet and push notifications survive as well. The **rack switches stay on wall power** — the cameras stop recording and the shades go dark until mains returns. If that recording gap ever bothers you, the switches idle at roughly 70–90 W with the shades asleep — adding the GS308EPP and the VIMIN to battery is what restores the camera pipeline.

The two RJ45 jacks on the back — the Ethernet surge pass-through, marked as a network in and out — stay empty. The server's cable runs straight to the router, both already on battery, and routing it through the UPS adds a point of failure to the box's one network path to guard against a surge that does not arrive by Ethernet inside a house. Before ever using them, read the rating on the rear label: on some CyberPower models the pass-through is 10/100 only, which would quietly cap the server at a tenth of its link speed.

### Move the plugs with the server off
A hard power cut is the very thing this page exists to prevent, so do not become the cause of one. The server moves last, and it moves off:

1. In Proxmox, click the **pve** node, then **Shutdown** at the top right, and confirm. Proxmox stops every guest in reverse start order — Frigate before Home Assistant, the TrueNAS VM cleanly through its guest agent — and then powers the host off.
2. Wait for the fans to stop and the case lights to go out. Give it a few minutes: nine guests are stopping and the backup share is being let go. If ten minutes on the fans are still turning, the web UI is dead and the board's Q-code reads `05`, the operating system has halted but the board has not switched off — seen here on this box's first shutdown — so hold the power button until the fans stop; the When Something Breaks page's *The server will not power off* entry has the BIOS follow-up.
3. Move the router, the ONT and the Caséta bridge to the battery-backed outlets — the house's internet drops for a minute or two.
4. Move the server's plug last.
5. The server starts on its own, because the BIOS's **Restore AC Power Loss → Power On** treats the new outlet as power returning. If it is still dark after a minute, press the power button once.
6. When it has booted, check that Kuma's status page at `https://status.kuzco.org/status/home` is all green and the Home Assistant app answers — the first boot on the new feed, witnessed.

> [!NOTE]
> Never **Stop** the node or pull a running server's plug for this. Shutdown is the clean path: guests get their stop signals and time to write, the host unmounts its storage, and nothing in the journal ends mid-sentence. The same Shutdown button is the right way to power the box down for any hardware work later.

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

That one package brings three programs, and the next section configures each in turn. The grey names are the exact words the system uses for them; they appear in the commands and the output on this page, so they are worth recognising:

- **The driver, `usbhid-ups`** — talks to the CyberPower over the USB cable and reads its state. It runs as the service `nut-driver@cyberpower` once the UPS has been given that name below.
- **The server, `upsd`** — holds what the driver reads and answers anyone who asks: the watcher next, and Home Assistant later. It runs as the service `nut-server`.
- **The watcher, `upsmon`** — asks the server every few seconds and is the one that orders the shutdown when the battery runs low. It runs as the service `nut-monitor`.

On Proxmox VE 9 the package is NUT 2.8.1. It installs its own USB permission rules and services, and it arrives switched off — `MODE=none` in its main file — so nothing runs until the next section turns it on.

### Write the five config files
NUT's behaviour lives in `/etc/nut/`. Five short files, each written once in its final form — including the lines the USB-drop section and the Home Assistant section rely on later, so no file on this page is opened twice. What each line does is explained under its file.

Open `/etc/nut/nut.conf`:

```bash
nano /etc/nut/nut.conf
```

Change the existing `MODE=` line to:

```ini
MODE=netserver
```

- **`MODE=netserver`** — one local UPS protecting this machine, with its state also answerable over the LAN. It starts all three programs: the driver, `upsd` and `upsmon`. The LAN half sits unused until Home Assistant asks, at the end of this page, and the `LISTEN` lines below decide exactly where it answers.

Open `/etc/nut/ups.conf`:

```bash
nano /etc/nut/ups.conf
```

Append this at the end — the shipped file is comments only, so the `maxretry` line still lands above the first section, which is where it must be:

```ini
maxretry = 3

[cyberpower]
    driver = usbhid-ups
    port = auto
    desc = "CyberPower CP1500PFCLCD"
    pollinterval = 5
    pollfreq = 30
```

- **`maxretry = 3`** — a setting for the launcher, `upsdrvctl`, not for the driver, which is why it sits above the section with no indentation. Put inside `[cyberpower]` it stops the driver cold with `'maxretry' is not a valid variable name for this driver` — seen here.
- **`[cyberpower]`** — the name you give the UPS. Any name works; it only has to match the `MONITOR` line below.
- **`driver = usbhid-ups`** — the driver for a USB UPS that speaks the standard HID protocol, which this one does.
- **`port = auto`** — required by the file's syntax, and ignored by `usbhid-ups`, which finds the CyberPower over USB by itself.
- **`desc`** — a label for you; it changes nothing.
- **`pollinterval` and `pollfreq`** — with `maxretry`, the settings that make the driver survive this model's habit of dropping its USB link. The *Handle the CyberPower USB-drop quirk* section explains each.

Open `/etc/nut/upsd.conf`:

```bash
nano /etc/nut/upsd.conf
```

Append this at the end:

```ini
LISTEN 127.0.0.1 3493
LISTEN 192.168.1.50 3493
```

- **`LISTEN 127.0.0.1 3493`** — the server answers on the host itself, which is how `upsmon` reaches it.
- **`LISTEN 192.168.1.50 3493`** — and on the host's LAN address, which is how Home Assistant reaches it at the end of this page. Listing addresses instead of `0.0.0.0` keeps the server off interfaces it does not need; port 3493 stays on the LAN and is never forwarded.

> [!INPUT] proxmox-ip | Proxmox host IP | 192.168.1.50
> The address on that second line, and the one Home Assistant is given as **Host** at the end of this page.

Open `/etc/nut/upsd.users`:

```bash
nano /etc/nut/upsd.users
```

Append both accounts — the one `upsmon` signs in with, and a watch-only one for Home Assistant:

```ini
[admin]
    password = pick-a-long-password
    upsmon primary

[hauser]
    password = a-different-long-password
```

- **`[admin]`** — the account `upsmon` uses. The `upsmon primary` line really has no equals sign: it says this account may run the shutdown, and that this host is the primary, the one wired to the UPS.
- **`[hauser]`** — Home Assistant's account, which can only read. No `upsmon` line, so it can never order a shutdown.

> [!INPUT] nut-admin-user | NUT admin username | | admin
> The `[admin]` section name in `upsd.users` — if you rename it, the `MONITOR` line must match.

> [!SECRET] nut-admin-password | NUT admin password
> Replaces `pick-a-long-password` in both files — `upsd.users` and the `MONITOR` line must match.

> [!INPUT] nut-ha-user | NUT read-only username | | hauser
> The `[hauser]` section name in `upsd.users` — the account Home Assistant signs in with.

> [!SECRET] nut-ha-password | NUT read-only password
> Replaces `a-different-long-password` in `upsd.users` — enter it alongside the username in Home Assistant's NUT dialog at the end of this page. Keep it in Vaultwarden too.

Open `/etc/nut/upsmon.conf`:

```bash
nano /etc/nut/upsmon.conf
```

Append the line that watches that UPS, with the admin password:

```ini
MONITOR cyberpower@localhost 1 admin pick-a-long-password primary
```

- **The `MONITOR` line** — reads left to right: the UPS called `cyberpower` on this host feeds **1** of this host's power supplies; sign in as `admin` with that password; this host is the **primary**, responsible for deciding when the load shuts down.
- **No shutdown command to add** — Debian ships `upsmon.conf` with `SHUTDOWNCMD "/sbin/shutdown -h +0"` already active.

> [!NOTE]
> These files hold passwords, which is why they ship owned by `root:nut` and readable by no one else. Edit them in place and leave the ownership and permissions alone. Keep the passwords in Vaultwarden as the source of truth.

### Start it and prove it

```bash
systemctl restart nut-server nut-monitor
```

The driver needs no enabling by hand — NUT watches `ups.conf` and spins up a `nut-driver@cyberpower` service for the new section automatically. Then ask the UPS how it is doing:

```bash
upsc cyberpower@localhost
```

A healthy answer is a screenful of live variables. Three are worth knowing by name:

- **`ups.status`** — `OL` means on line power.
- **`battery.charge`** — the charge, in percent.
- **`battery.runtime`** — the UPS's own estimate of seconds remaining at the current load.

To ask for just one of them:

```bash
upsc cyberpower@localhost ups.status
```

If `upsc` answers `Error: Driver not connected` instead — seen here on the first try — the server half is listening but the driver half is not running. The line `Init SSL without certificate database` above it is noise. Find out why:

1. Ask for the driver's service:

```bash
systemctl status nut-driver@cyberpower
```

2. If it says the unit could not be found, the per-UPS service was never generated from your `ups.conf` entry — run the helper that generates it:

```bash
systemctl restart nut-driver-enumerator
```

3. Start the driver:

```bash
systemctl start nut-driver@cyberpower
```

4. Ask the UPS again — the screenful of variables means the driver is connected:

```bash
upsc cyberpower@localhost
```

5. If step 1 found the unit but showed it failing, read its log — the two `upsnotify` lines in it are noise; the line before them is the reason:

```bash
journalctl -u nut-driver@cyberpower -n 20 --no-pager
```

6. If it says `Could not open any HID devices: insufficient permissions`, the UPS is on the bus but the rule that lets the `nut` user open it was never applied to the device — the UPS was plugged in before the package and its rules existed, which is how it went here. Apply the rules to every device now:

```bash
udevadm trigger
```

7. If it says only `No matching HID UPS found`, with no permissions line, the host does not see the UPS at all: reseat the USB cable at both ends, then confirm a line with `0764:` — the CyberPower — appears:

```bash
lsusb
```

8. Restart the driver and ask again:

```bash
systemctl restart nut-driver@cyberpower && upsc cyberpower@localhost
```

9. If the permissions line is still there after step 6, unplug the USB cable from the server for ten seconds, plug it back in, and repeat step 8 — a fresh plug-in runs the rules on the device the way the first one should have.

## Handle the CyberPower USB-drop quirk

### Know the failure mode
CyberPower units, this model included, have a well-documented habit: the `usbhid-ups` driver loses the USB device under load or after a glitch and never reconnects on its own. `upsc` starts answering "Driver not connected" or the data goes stale, and a UPS the host can no longer hear is a UPS that will not trigger a shutdown when it matters — the silent failure this whole page exists to prevent. Three settings make the driver resilient, and a watchdog catches the case where it still wedges.

### Make the driver reconnect itself
Nothing to run in this step — the three settings are already in the `ups.conf` you wrote, two inside the `[cyberpower]` section and one above it, and the driver has been running with them since it started. They make it poll steadily and re-grab the device when the kernel re-enumerates it:

- **`pollinterval = 5`** — how often the `usbhid-ups` driver polls the UPS for critical status changes: the `OB` (on-battery) and `LB` (low-battery) bits.
- **`pollfreq = 30`** — how often the driver re-reads the full variable set from the hardware. NUT's default for CyberPower units is already 12 seconds, so the `30` here *relaxes* the full re-read, trading freshness for fewer USB round-trips on a link this model likes to drop.
- **`maxretry = 3`**, above the section — tells **upsdrvctl**, the launcher, to attempt starting the driver three times before giving up, which clears most cold-boot races where the UPS enumerates slightly after the driver launches. It is the launcher's setting, not the driver's, which is why it cannot live inside the section.

These tame the common case; the watchdog below covers the case where the link drops anyway.

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

Then create `/etc/systemd/system/nut-watchdog.service`:

```bash
nano /etc/systemd/system/nut-watchdog.service
```

Give it this content:

```ini
[Unit]
Description=Restart NUT driver if the CyberPower USB link drops
[Service]
Type=oneshot
ExecStart=/usr/local/bin/nut-watchdog.sh
```

And `/etc/systemd/system/nut-watchdog.timer`, which fires it every two minutes:

```bash
nano /etc/systemd/system/nut-watchdog.timer
```

```ini
[Unit]
Description=Run the NUT USB watchdog every two minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
```

Enable it:

```bash
systemctl daemon-reload && systemctl enable --now nut-watchdog.timer
```

> [!TIP]
> Prove the watchdog works: unplug and replug the UPS's USB cable, wait two minutes, and confirm `upsc cyberpower@localhost ups.status` answers again. `journalctl -t nut-watchdog` shows whether it had to step in. A watchdog you have never seen fire is the same unknown it was meant to remove.

## Make the shutdown automatic

### Understand the shutdown chain
From here the sequence is already wired, and it is deliberately patient. What happens, in order:

- **The wall goes dead.** The UPS reports on battery — `upsc` shows `OB` — and `upsmon` does nothing but wait, because power usually comes back.
- **The CyberPower declares low battery, `OB LB`.** Only now does `upsmon` raise the forced-shutdown flag, `FSD`, and call `shutdown`.
- **The host stops the Proxmox guest service.** That interrupts any running backup job — a shutdown that lands mid-backup takes noticeably longer, which is why the battery headroom matters.
- **Every guest is asked to shut down cleanly,** VM or container alike, in reverse startup order, with up to 180 seconds each before a stuck one is stopped hard. A guest's own **Shutdown timeout** in its Options overrides that default.
- **The host powers off,** and last of all NUT tells the UPS to cut its output, so the load stops draining the battery and everything gets a clean power-cycle when mains returns.

Two shipped defaults make that last act work, both already active in Debian's `upsmon.conf`: `MINSUPPLIES 1` and the `POWERDOWNFLAG` file — nothing to add, just do not delete them.

> [!NOTE]
> Who decides "low"? The CyberPower does — the threshold is set in the device by its vendor, and `usbhid-ups` falls back to 30% only if the UPS reports nothing. The patience is by design: every extra minute on battery is another minute in which the power might return without anything having to stop.

Set the shutdown order so Frigate stops before Home Assistant and TrueNAS outlasts the service containers:

1. In each guest's **Options** tab, find **Start/Shutdown order** — shutdown runs the startup order in reverse, so order 1 boots first and goes down last.
2. Give **TrueNAS** the lowest order.
3. Give **Home Assistant** a lower order than **Frigate**.
4. Leave every other guest with no order set.
5. If a guest genuinely needs longer than the default to stop cleanly, set its **Shutdown timeout** in the same **Options** tab.

> [!WARNING]
> Order matters for this build. The Home Assistant VM holds the Mosquitto-dependent automations, and the Frigate LXC (Linux container) talks to it over MQTT (MQ Telemetry Transport) — so the **Frigate LXC must go down before the HA VM** (its MQTT broker must outlast it), and the TrueNAS VM should outlast the service containers that may still be flushing to its shares. One catch: **guests with no order set shut down before any numbered guest** — which is what you want here, since a service container still writing to a share finishes and stops before the numbered TrueNAS VM goes down; only a guest that must outlast one of the numbered three needs an explicit order of its own.

> [!DETAILS] Shutting down earlier than the UPS would
> If the CyberPower calls low battery later than you'd like, NUT documents two routes:
>
> - **Your own threshold, in `ups.conf`** — in the `[cyberpower]` section add `ignorelb`, then `override.battery.charge.low = 50`, or `override.battery.runtime.low = 600`, or both. NUT then judges "low" by your numbers instead of the device's flag. Some CyberPower models round the reported charge, so check that `upsc` shows a sane figure first.
> - **A timer, in `upssched`** — started by the on-battery event, it runs `upsmon -c fsd` after a fixed number of minutes.
>
> Either way, shutting down early throws away runtime during which the power might have returned.

### Teach it to come back
After the shutdown the UPS cuts its outlets, and when mains returns it switches them back on — but a powered outlet only boots the server if the firmware agrees. You set this on the Hardware & BIOS page with the other firmware toggles; confirm it stuck before trusting it:

1. Plug the install-day monitor and keyboard back into the box — this board has no remote console, so the BIOS exists only on a screen attached to it.
2. From **pve → Shell**, reboot straight into the BIOS, which spares you catching the **Del** key at the logo:

```bash
systemctl reboot --firmware-setup
```

3. Check **Advanced → APM Configuration → Restore AC Power Loss** reads **Power On**.
4. If it does not, set it.
5. Press **F10**.

> [!NOTE]
> NUT recommends "always power on" over "last state": the UPS shutdown was clean, so "last state" can remember *off* and leave the server dark in a powered house.

> [!TIP]
> With this set, the stack reassembles itself: the host boots when the outlets wake, and every guest marked to start at boot returns in its startup order — TrueNAS first, then the rest, with the HA VM ahead of the Frigate LXC. Nobody has to be home for the house to recover.
>
> That last sentence is a claim worth testing rather than trusting, because a guest can fail to boot *unattended* while booting perfectly whenever you happen to be watching — the TrueNAS VM's `Press any key to continue...` firmware halt (prevented by `rombar=0` on the GPU/HBA page) is exactly that trap. Before relying on any of this, cold-start each guest with its console closed and confirm it answers on its own.

> [!WARNING]
> One failure the self-heal cannot fix: a **tripped breaker** never resets itself, so the whole recovery story ends at the panel.
>
> 1. Check what kind of breaker feeds the server's outlet — a **TEST button** means AFCI or GFCI (the label says which).
> 2. If the server's permanent circuit nuisance-trips, have an electrician look at it.
>
> Both have nuisance modes with exactly this equipment: AFCIs can read a big PSU's power-on inrush or a UPS charger as an arc (this build tripped one during setup), and GFCIs can trip on the summed ground leakage of many switching supplies — a worn breaker can be replaced in kind, or the server can get a dedicated circuit. Never swap an AFCI/GFCI for a plain breaker to stop the trips; it is fire and shock protection required by code.
>
> Day to day:
>
> 1. Power the UPS first.
> 2. Let it settle.
> 3. Then the server.
>
> One strip slamming everything on at once is the sharpest inrush spike.
>
> **A rare trip is not a benign one.** Intermittent is the normal signature of an arcing fault — it needs conditions to line up (a cold night, a humidity swing) rather than a heavy load, so a fault that fires monthly is the same fault that fires daily, just earlier in its life. It is also the hardest kind to diagnose, because nothing is wrong while the electrician is standing there.
>
> 1. **Keep a log**: date, time, outdoor temperature, and what was running.
> 2. One habit the automation cannot cover: on the next trip, **read the breaker before resetting it** — most modern AFCIs blink a diagnostic code afterwards saying whether they saw an arc, a ground fault, or an overload, and resetting clears it.
> 3. Cross-check the timestamps against the UPS's own periodic **battery self-test** schedule too — that transfer to battery and back is a switching transient, and if the trips line up with it, that is your answer.
>
> A handful of log entries turns "it trips sometimes" into a pattern someone can act on, and it is the only evidence that survives between visits. Conveniently, most of that log writes itself once this page is done — every transfer to battery lands in the host's journal (`journalctl -u nut-monitor`) and, once the Home Assistant integration below is wired up, in HA's history as a timestamped state change on the UPS status sensor. A trip at 3 am that nobody witnessed still gets recorded to the minute. One trap to avoid: moving the server to a different circuit fixes *your* uptime and nothing else. If the fault is a damaged cable in a wall, it is still there, still arcing, just no longer inconveniencing you enough to chase.

### Rehearse the outage
Two rehearsals, gentle then real. First the gentle one — pull the CyberPower's plug from the wall for half a minute while everything runs. Run this before pulling the plug, then again while on battery:

```bash
upsc cyberpower@localhost ups.status
```

What to expect: the status reads `OL` on line power, becomes `OB` — often `OB DISCHRG` — on battery, and returns to `OL` when you plug back in. Nothing shuts down, because `upsmon` only acts when on-battery and low-battery are true together. What the drill proves is that the battery carries the load and the data link reports it. Then, at a quiet moment, the documented full drill, no battery-draining required:

```bash
upsmon -c fsd
```

This raises the forced-shutdown flag exactly as a critical battery would, and the whole chain runs for real: guests down in order, host off, UPS output cut and restored, and — BIOS step done — the stack boots back on its own. Time the run from command to powered-off; that number is what your battery's low-battery margin has to beat. When it's all back, glance over Uptime Kuma — anything that didn't make the round trip shows red.

> [!WARNING]
> `upsmon -c fsd` is a real shutdown, not a simulation, and once the flag is set it cannot be withdrawn. Pick a quiet moment and warn the household first — this drops the cameras, locks' HA control, and AdGuard DNS (Domain Name System) for the duration.

> [!DETAILS] Dry-running pieces of the drill without shutting down
> If you want to validate parts of the chain without the irreversible `upsmon -c fsd`, `upsdrvctl -t shutdown` prints the UPS power-off sequence the drivers would run, without calling them.
>
> To watch `upsmon` pull the trigger without rebooting, point `SHUTDOWNCMD` at something harmless instead:
>
> 1. Open `/etc/nut/upsmon.conf`:
>
> ```bash
> nano /etc/nut/upsmon.conf
> ```
>
> Change the `SHUTDOWNCMD` line to something harmless, say:
>
> ```ini
> SHUTDOWNCMD "/usr/bin/logger -t nut-test FSD-fired"
> ```
>
> 2. Restart NUT so the change takes effect — a full restart, not a reload:
>
> ```bash
> systemctl restart nut-monitor
> ```
>
> 3. Trigger it, then watch the log:
>
> ```bash
> journalctl -t nut-test
> ```
>
> 4. Put the real command back (`SHUTDOWNCMD "/sbin/shutdown -h +0"`) and restart `nut-monitor` again. Do not leave the dummy in place.

> [!TIP]
> Once, ever, on a quiet day, pull the plug and let the battery actually drain until the CyberPower itself declares `OB LB` and triggers everything. The timed `upsmon -c fsd` drill above proves the *shutdown chain* runs cleanly, but it bypasses the CyberPower's own low-battery logic entirely — it never tests whether the device asserts `OB LB` before the battery is exhausted. This full drain is the only test that proves the real low-battery trigger fires with margin to spare, at the cost of one battery cycle — worth doing once so the timed drill has a real-world anchor.

### Prove the return
The drill above proves the stack comes back *up*; this proves it comes back *working*. A dependency that only exists at boot can only be found by booting — this build's first unplanned reboot cost sixteen days of camera recordings to one, while every dashboard stayed green. Run this list after every reboot, planned or not:

1. In Proxmox, every guest shows **running**.
2. At `https://status.kuzco.org`, every monitor is green — including **Frigate frames**, the one that watches the cameras rather than Frigate's page.
3. Frigate shows live video on every tile.
4. In **Proxmox → 102 (frigate) → Console**, the card is doing work — hundreds of MiB in use, not 2 MiB:

```bash
nvidia-smi
```

5. In the Home Assistant app, lock a door and unlock it again.
6. On the Mac, open the TrueNAS `files` share.
7. Browse to `https://proxmox.kuzco.org` — a padlock, so DNS and the proxy are back.

## Watch it from Home Assistant

### Open the UPS to the LAN
Nothing to edit on the host — `MODE=netserver`, the LAN `LISTEN` line and the `hauser` account were written with the other config files, so `upsd` has been answering on the LAN, read-only, since it started. Home Assistant's native NUT integration does the rest:

1. In Home Assistant, go to **Settings → Devices & services**.
2. If **Network UPS Tools (NUT)** is not already waiting under discovered devices, add it:

- **Host** → `192.168.1.50`
- **Port** → `3493`
- **Username / Password** → the `hauser` login recorded with the config files above

The CyberPower appears as a device with **Battery charge**, **Status**, **Load**, and **Input voltage** enabled out of the box — Status reading "On Battery, Battery Discharging" when things get interesting. **Battery runtime**, **Battery voltage**, and the diagnostic sensors arrive disabled; enable them per entity if you want them.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!TIP]
> One automation earns its keep: trigger on the **Status** sensor changing to a state containing "On Battery" (capital B — the match is case-sensitive) and announce it through the Nest and Google speakers via Cast, plus a phone push from the Home Assistant companion app. The push half works today; the spoken half needs the Google Cast integration and the Piper voice, both added on the Voice page later in this build — build the automation now and the announcement starts working once that page is done. The server already looks after itself; this turns a 3 am outage into a heads-up you actually hear instead of a mystery in the logs.

> [!NOTE]
> Port 3493 stays on the LAN. Listing specific addresses instead of `0.0.0.0` keeps the daemon off interfaces it doesn't need, and Home Assistant gets its own low-privilege account regardless. Never port-forward 3493 to the internet — remote access is Tailscale's job.

> [!DETAILS] Unblocking a connection that fails
> The Cameras & Frigate page turned the Proxmox firewall **on** (to fence Frigate's unauthenticated port), and the host's input policy drops what is not allowed — so add the rule before the integration can connect. At **Node `pve` → Firewall → Add**:
>
> - **Direction** → `in`
> - **Action** → `ACCEPT`
> - **Protocol** → `tcp`
> - **Dest. port** → `3493`
> - **Source** → `192.168.1.51`
> - **Enable** → ticked — the dialog adds rules disabled by default
>
> If the connection still fails afterwards, check the usual suspects:
>
> 1. Confirm the restart took (`systemctl status nut-server`).
> 2. Confirm `MODE=netserver` is really set.
> 3. Confirm the `LISTEN` address matches the host's real IP.
>
> Buttons and switches (outlet control) would need an account with `instcmds` rights, which `hauser` deliberately lacks.
