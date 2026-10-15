---
title: When Something Breaks
subtitle: Symptom-first ladders for a house that is already built — what to check, in what order, before touching anything
collection: My Build
order: 26
accent: spruce
search: true
---

The build pages say how to stand each piece up. They do not say what to do six months later when a tile goes red, and they should not — a build page is a build. This page is for the later day: find what you *see* in the headings below, run its ladder top to bottom, and stop at the first step that fixes it. Every ladder here was added the day this house actually needed it.

> [!NOTE]
> Two habits before any ladder. Uptime Kuma at `https://status.kuzco.org` tells you *what* is down, so start there rather than guessing. And the Maintenance page's rule holds: snapshot before any change that is more than a restart.

## Host

### Everything is down, and Task History shows a run of "Bulk start VMs and Containers" lines minutes apart
Each **Bulk start VMs and Containers** line is one boot — starting every guest is the last step of booting — so a run of them minutes apart is the host rebooting over and over, and the red CT start errors beside them are starts cut off by the next reboot, not failed containers. Seen here on 2026-10-14: fifteen boots in forty-two minutes, five of them dead within a second. In **pve → Shell**:

1. List the boots — one row each, with its first and last timestamp; a row lasting seconds died while still booting:

```bash
journalctl --list-boots | tail -15
```

2. Read how the previous boot ended:

```bash
journalctl -b -1 -n 40 --no-pager
```

3. If it ends in ordinary startup or running lines with no shutdown request, the power was cut or the hardware reset itself — software never ends a journal mid-sentence — so carry on at step 5.
4. If it ends with `upsmon`, `Forced shutdown` or `Reached target Power-Off`, something asked for the shutdown — NUT, when the UPS reports low battery on line power, or a person — and NUT's own reason is in its log:

```bash
journalctl -b -1 -u nut-monitor --no-pager | tail -20
```

5. Find out whether the whole house flickered — the router's uptime on its status page, the GS308EPP's uptime, a stove clock, or a gap across every camera's recordings at once.
6. If the house flickered, the server is riding unprotected power, or a UPS whose battery can no longer carry it — move it to the UPS's battery-side outlets, and run the UPS page if it is not done.
7. If nothing else reset, the fault is the server's own power feed or something inside the box — work down the list in the next entry.

> [!NOTE]
> The BIOS's **Restore AC Power Loss → Power On** is what brings the host back after every cut; it is doing its job, not causing the loop. And the containers were never the problem: once the reboots stop, the last boot's Bulk start finishes on its own, and every guest shows running within a few minutes.

### The server resets by itself and nothing else in the house does
A hard reset with no shutdown in the journal is power or hardware, so the suspects are the feed into the box and the box itself — cheapest test first, and only one change at a time, so the cure names the cause. First, the one piece of software evidence that exists: every boot's kernel errors in one list, where machine-check (`mce`), thermal, or NVIDIA `Xid` lines before a reset point at the CPU, the cooling, or the card:

```bash
journalctl -k -p err --no-pager | tail -40
```

1. Note what else was running on the server's circuit during each episode — an air conditioner, dryer, vacuum, microwave or space heater cycling on the same circuit sags the voltage enough to drop a power supply while the router on another circuit never notices.
2. Move the server's plug to the UPS's battery-side outlets, or to a different circuit — the UPS rides through sags even before the UPS page configures it.
3. If it still resets, unplug the case's **RESET SW** lead from the motherboard's front-panel header — a reset switch or its lead pinched during the cooling work shorts at random and produces exactly this.
4. If it still resets, reseat the 24-pin, the CPU 8-pin, and both GPU power cables at both ends.
5. Check the cooling is alive — the AIO pump's RPM and the CPU temperature in BIOS at POST, or from the host:

```bash
cat /sys/class/thermal/thermal_zone*/type /sys/class/thermal/thermal_zone*/temp
```

6. Check the card the same way:

```bash
nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv
```

7. Still resetting with clean temperatures and cables: the power supply is next, and a memory test overnight after that.

> [!NOTE]
> A thermal trip usually announces itself with a **CPU Over Temperature Error** at the next POST, and a kernel panic hangs rather than reboots, so a machine that silently resets and comes straight back is almost always power — the wall, the supply, or a short — before it is anything else.

## Names

### A service loads by address but not by its kuzco.org name
Seen here after the host's reboot storm, with every guest running again. The `kuzco.org` names exist only inside AdGuard, so this is the chain from the Mac to AdGuard breaking somewhere — and two lookups find where. On the Mac, in Terminal:

1. Ask the way the house normally asks, through the router:

```bash
nslookup home.kuzco.org
```

2. Ask AdGuard directly:

```bash
nslookup home.kuzco.org 192.168.1.53
```

3. If the first says `No answer` or `NXDOMAIN` and the second answers `192.168.1.54`, AdGuard is fine and the router stopped asking it — carry on at step 5.
4. If the second fails too, AdGuard's service did not survive the restart even though its container runs — in **Proxmox → 103 (adguard) → Console**:

```bash
systemctl restart AdGuardHome
```

5. Check the router's setting survived, at `http://192.168.1.1` → **Advanced → Network Settings → Network Connections → Broadband Connection (Ethernet) → Settings**: **IPv4 DNS Address 1** should still read `192.168.1.53`.
6. If it changed, set it back and click **Apply**.
7. If it is unchanged, restart the router — pull its power for ten seconds; the house loses internet for about two minutes.
8. Repeat step 1 — `192.168.1.54` means the chain is whole again.

> [!NOTE]
> Why the router drifts: with AdGuard dark for an hour, the CR1000A either fell back to Verizon's resolvers and stayed there, or cached the "no such name" answer a public resolver gave it and kept serving that after AdGuard returned. A restart clears both — and so does waiting: here the name came back on its own within a day, once the cached answer expired. If the Mac's own cache is the last thing holding a stale answer, flush it with `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`.

## Cameras

### Every camera says "No frames have been received"
One camera failing is that camera. All of them at once — the Wi-Fi doorbell included, so the switch is not it — is one of the two things every stream shares inside the Frigate container: the go2rtc restreamer, or the 1080 Ti that decodes every stream. In **Proxmox → 102 (frigate) → Console**, logged in as `root`:

1. Check the GPU is still usable inside the container:

```bash
nvidia-smi
```

2. If it errors — `Driver/library version mismatch`, or `couldn't communicate with the NVIDIA driver` — the container's driver no longer matches the host's kernel module; a host or container update since the last reboot does this. Run the driver fix under *Lend the GPU into the container* on the Cameras page, then come back to step 6.
3. If it prints the card, check the two services:

```bash
systemctl status go2rtc frigate --no-pager
```

4. If both are `active`, read what ffmpeg is complaining about — in this install Frigate's own output goes to a file, not to the journal, so `journalctl` shows only starts, stops and OOM kills:

```bash
tail -n 40 /dev/shm/logs/frigate/current
```

5. Read the restreamer's log the same way:

```bash
tail -n 15 /dev/shm/logs/go2rtc/current
```

> [!WARNING]
> go2rtc's log prints every stream URL with the camera password in clear — `url=rtsp://admin:PASSWORD@192.168.1.73:554/…`. Blank the password before that log goes anywhere: a forum post, a screenshot, a chat. If it has already gone out, *Change the EmpireTech camera password* on the Maintenance page is the fix.

> [!NOTE]
> Reading the two logs: `cuInit(0) failed` with a working step 1 is the next entry; any other `cuda` or `hwaccel` line is the driver (step 2); `Connection refused` on `127.0.0.1:8554` is go2rtc (step 6). In the go2rtc log, `i/o timeout` means that camera is unreachable — its cable, PoE port or the switch. A camera that is reachable but whose stream never starts is a password question: log in to its web UI with the password from the config, and a rejected login is the answer.

6. Restart both services — go2rtc is its own service in this install, and the config editor's Save & Restart never touches it:

```bash
systemctl restart go2rtc frigate
```

### The Frigate log says `cuInit(0) failed -> CUDA_ERROR_UNKNOWN` while `nvidia-smi` works
Seen here after the first host reboot since the container was built. `nvidia-smi` needs two device nodes; CUDA needs a third, `/dev/nvidia-uvm`, which nothing recreated at boot — so every decoder and the detector failed, ffmpeg crash-looped every second, nothing recorded for sixteen days, and the loop's leak had the OOM killer restarting Frigate every three days. In the **Proxmox node Shell**:

1. Check for the node:

```bash
ls -l /dev/nvidia-uvm*
```

2. If it is missing, load the module:

```bash
modprobe nvidia_uvm
```

3. Create the nodes:

```bash
nvidia-modprobe -c0 -u
```

4. Check the container config carries them:

```bash
grep nvidia-uvm /etc/pve/lxc/102.conf
```

5. If nothing prints, add them on the next free `devN` numbers:

```bash
pct set 102 -protection 0 && pct set 102 -dev3 /dev/nvidia-uvm,gid=44 -dev4 /dev/nvidia-uvm-tools,gid=44 && pct set 102 -protection 1
```

6. Reboot the container:

```bash
pct reboot 102
```

7. Make it permanent — the *Make the CUDA device node exist at every boot* step on the GPU Sharing & HBA Passthrough page, if it was never done.
8. Prove it a minute later, in the container's console: `nvidia-smi` shows hundreds of MiB in use, and the last lines of `/dev/shm/logs/frigate/current` show the model loaded with no `cuInit` errors.

> [!NOTE]
> How you hear about the next one: the *Frigate went down* rule on the Automations page pushes within seconds of any crash, and the *Frigate frames* monitor on the Uptime Kuma page goes red when frames stop while the page stays up. To see the history, in the container's console:
>
> ```bash
> journalctl -u frigate --no-pager | grep -i "oom\|Failed with result"
> ```
>
> If `oom-kill` keeps appearing with CUDA healthy, the container's 4 GB cap is genuinely too small — raise it in Proxmox under **102 → Resources → Memory** to 8 GB.

## Home Assistant

### Home Assistant is unreachable and its console says "You are in rescue mode"
Seen here after the host's reboot storm: fifteen hard resets caught the VM mid-boot, and Home Assistant OS stopped at its rescue shell — **Press Enter for maintenance (or press Control-D to continue)** at the bottom of **Proxmox → 101 (haos) → Console**. Two different things put it there, and one command tells them apart. Home Assistant OS keeps two copies of itself, slot A and slot B, and its bootloader gives each three tries; a boot only counts as good once the system finishes starting, so a run of power cuts mid-boot exhausts both slots and the bootloader falls through to rescue with nothing actually broken. The other cause is the data partition failing its filesystem check, which after power cuts is the one that needs a repair.

1. In **Proxmox → 101 (haos) → Snapshots**, click **Take Snapshot**, name it `pre-fsck`, and leave **Include RAM** unticked — the way back if a repair makes things worse.
2. In the console, press **Enter** — the rescue shell opens as root with no password.
3. List what failed:

```bash
systemctl list-units --state=failed --no-pager
```

4. If it says `0 loaded units listed`, nothing is broken and the boot counter is the cause. Rescue mode leaves the message bus and RAUC stopped — `rauc status` answers `Could not connect` until they run — so start them:

```bash
systemctl start dbus.socket rauc
```

5. Confirm the signature — `rauc status` prints `No bootable slot found in ORDER 'A B'`, the booted slot named under **Booted from**, and `boot status: bad` on both:

```bash
rauc status
```

6. Mark the booted slot good, which resets its tries — the other slot staying bad does not matter; it is the inactive copy:

```bash
rauc status mark-good
```

7. Reboot the VM — it boots normally:

```bash
systemctl reboot
```

8. If step 3 listed a unit, read its error:

```bash
journalctl -xb -p err --no-pager | tail -30
```

9. If it names `hassos-data` or `/mnt/data`, stop the journal, which keeps that partition busy:

```bash
systemctl stop systemd-journald
```

10. Unmount the partition:

```bash
umount -A /dev/disk/by-label/hassos-data
```

11. Repair it — `-y` answers every repair prompt yes:

```bash
fsck.ext4 -f -y /dev/disk/by-label/hassos-data
```

12. Run the same command again until it ends without listing errors.
13. Reboot the VM:

```bash
systemctl reboot
```

14. If the failed unit named something else, or the repair ends with errors every time, the partition is beyond repair — restore the VM from the newest nightly archive on the Proxmox Backups page, or build a fresh VM and restore Home Assistant's own backup from the TrueNAS share.

> [!NOTE]
> The unit names in step 8 read like `Failed to start File System Check on /dev/disk/by-label/hassos-data` or `Failed to start Grow File System on /mnt/data`. If step 10 refuses because the partition is busy, the journal is still running — repeat step 9.

> [!DETAILS] Why it waits for you, and what prevents it
> The two slots exist so a failed operating-system update can fall back to the previous version. An attempt only counts as good once the system finishes starting, so a hard reset mid-boot looks exactly like a broken OS, and after both slots fail three times the safe behaviour is to stop and wait for a person rather than loop forever; the counters never reset themselves. One power cut costs nothing — it took fifteen in an hour on unprotected power to exhaust them. The prevention is the UPS page: on the battery-side outlets the server rides through sags and flickers, and NUT turns a real outage into one clean shutdown and one clean boot. Proxmox shows a VM in rescue mode as *running*, so after any outage the UPS page's prove-the-return list — lock a door, unlock it — is what catches this. The two harmless lines every HAOS boot logs at error level — a timezone event source it cannot create, and `snd_hda_intel … no codecs found` — are not the cause of anything.

## Locks

### A lock shows connected, reports a stale state, and times out on lock and unlock
Seen here after a storm outage: Home Assistant came back, the Matter subscription did not. The keypad never depended on Home Assistant — the codes live in the lock — so nobody is locked out while you work through this.

1. Confirm something else live is still updating — a motion or temperature entity. If *everything* is frozen, it is the app's connection, not the lock: pull to refresh.
2. Go to **Settings → Devices & services → Matter → ⋮ → Reload**.
3. Wait thirty seconds, then try the lock.
4. Open the lock's device page and check its battery entity — a dying lock keeps its last-known face while it stops answering.
5. Go to **Settings → Apps → Matter Server → Restart**.
6. Restart Home Assistant from **Settings → System**.
7. Still dead: pull the lock's battery pack, reseat it, and wait for it to re-join.

## Remote access

### The phone reaches home on cellular but not on someone else's Wi-Fi
That Wi-Fi is on `192.168.1.x` too, and a network you are standing in beats the Tailscale subnet route.

1. On the phone, open **Settings → Wi-Fi → (i)** beside the network — an address starting `192.168.1.` confirms it.
2. Open Home Assistant at `https://homeassistant.<tailnet>.ts.net` — the collision-proof address from the Remote Access page.
3. For anything else, turn Wi-Fi off for the visit. The Renumber the LAN page is the permanent fix.

### Every site fails while Tailscale is on, and works the moment it is off
Not an internet problem — a DNS one, and a designed cost. The tailnet's DNS override sends every lookup from your phone and Mac to AdGuard at home, so when the house is unreachable — the server down, the home internet down, or the tunnel itself broken — those two devices have no DNS at all while everyone else's internet is fine. Tailscale off means the carrier's DNS, which is why everything returns at once.

1. Turn Tailscale off on the device.
2. Test whether the house itself is reachable — on cellular, with Tailscale back on for the test, browse to the host's tailnet address, `https://100.x.y.z:8006`, the one recorded on the Remote Access page; an address needs no DNS.
3. If it loads, the house is up and the fault is on the phone's side — carry on at step 5.
4. If it does not load, the house is down: at home, check the host's power light and the UPS display, and the UPS page's return-from-outage list; away, there is nothing to do until someone at home can.
5. Open the Tailscale app's **Warnings** screen — a **MagicSock function not running** warning means the app's own networking has stopped, a known client bug that a VPN toggle does not clear.
6. On the Mac, quit Tailscale from the menu bar and relaunch it from Applications.
7. On the iPhone, restart the phone.
8. Update the Tailscale app on both if an update is waiting.
9. Turn Tailscale back on once the house answers.

> [!NOTE]
> The way to never have this again is the Remote Access page's **split DNS** alternative: scope AdGuard to `kuzco.org` instead of overriding every lookup, so a down house costs the phone only your own names, not the internet. The trade is losing AdGuard's ad-blocking away from home.

### The Mac cannot reach home while the phone can
1. Menu bar → Tailscale: confirm it shows connected; if not, click **Connect**.
2. Read the signed-in account at the top of that menu. If it is the passkey admin, sign out and sign in with the Apple ID — the passkey is a browser-only login, and a client signed in as a removed user dies alone while every other device works.
3. In the Mac app's settings, confirm **Use Tailscale DNS settings** is on.

## Valheim

### Nobody can join the Valheim server
Three things can be wrong, in this order: the server itself, the path in, or the game version. In **Proxmox → 109 (valheim) → Console**:

1. Check the server is running:

```bash
docker ps --format '{{.Names}} {{.Status}}'
```

2. If `valheim-server` is missing or not `Up`, read its last lines — an update in progress says so, a crash shows the reason:

```bash
docker logs --tail 30 valheim-server
```

3. Start it if it is stopped:

```bash
docker start valheim-server
```

4. From a PC at home, join `192.168.1.62:2456` through **Join IP** — if that fails too, the problem is the server, not the path in, and the log above is where it shows.
5. For a Tailscale share, print the container's own view of the tailnet — it should show itself online, and the friend's Tailscale app should list `valheim` without a warning:

```bash
tailscale status
```

6. For a port-forward, compare the address friends are using with the current one:

```bash
curl -4 https://ifconfig.me
```

> [!NOTE]
> Reading the results: a share the friend no longer sees was revoked, or its invite link went unused for 30 days — share it again from the Machines page. A public address that moved is the usual port-forward failure; the Renumber the LAN page is the other one, since the router rule still points at the old container address afterwards. A join screen that says the version is incompatible means the game patched before the server did — with nobody connected the server updates itself within fifteen minutes, and `docker restart valheim-server` makes it check at once.

## Not a fault
Gauges that look wrong by design — check the list before debugging:

- **Proxmox shows the TrueNAS VM at 100% memory, or a hair over.** ZFS caches with every byte it is given, and with ballooning off Proxmox only sees the host side. The real picture is TrueNAS's **Dashboard → Memory** widget: Free, ZFS Cache, Services.
- **A pre-created proxy host answers 502.** "Not built yet," not "broken" — the Reverse Proxy page creates all eight hosts before their services exist.
- **Homepage's Nginx Proxy Manager tile opens port 81.** On purpose: 80 is the proxy's public side, 81 is its admin UI.
- **A Matter lock's Manage access dialog lists more users than you created.** Re-running a setup script stacks credentials; the Matter Locks page's broom script clears the guest slots.

> [!NOTE]
> When a new failure teaches something, it goes here under its symptom — the build pages stay a build.
