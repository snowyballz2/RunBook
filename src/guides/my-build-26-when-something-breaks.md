---
title: When Something Breaks
subtitle: Symptom-first ladders for a house that is already built — what to check, in what order, before touching anything
collection: My Build
order: 26
accent: spruce
---

The build pages say how to stand each piece up. They do not say what to do six months later when a tile goes red, and they should not — a build page is a build. This page is for the later day: find what you *see* in the headings below, run its ladder top to bottom, and stop at the first step that fixes it. Every ladder here was added the day this house actually needed it.

> [!NOTE]
> Two habits before any ladder. Uptime Kuma at `https://status.kuzco.org` tells you *what* is down, so start there rather than guessing. And the Maintenance page's rule holds: snapshot before any change that is more than a restart.

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
> go2rtc's log prints every stream URL with the camera password in clear — `url=rtsp://admin:PASSWORD@192.168.1.73:554/…`. Blank the password before that log goes anywhere: a forum post, a screenshot, a chat.

> [!NOTE]
> Reading the two logs: `cuInit(0) failed` with a working step 1 is the next entry; any other `cuda` or `hwaccel` line is the driver (step 2); `Connection refused` on `127.0.0.1:8554` is go2rtc (step 6). In the go2rtc log, `i/o timeout` means that camera is unreachable — its cable, PoE port or the switch — and `401` means its password changed.

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

### The Mac cannot reach home while the phone can
1. Menu bar → Tailscale: confirm it shows connected; if not, click **Connect**.
2. Read the signed-in account at the top of that menu. If it is the passkey admin, sign out and sign in with the Apple ID — the passkey is a browser-only login, and a client signed in as a removed user dies alone while every other device works.
3. In the Mac app's settings, confirm **Use Tailscale DNS settings** is on.

## Not a fault
Gauges that look wrong by design — check the list before debugging:

- **Proxmox shows the TrueNAS VM at 100% memory, or a hair over.** ZFS caches with every byte it is given, and with ballooning off Proxmox only sees the host side. The real picture is TrueNAS's **Dashboard → Memory** widget: Free, ZFS Cache, Services.
- **A pre-created proxy host answers 502.** "Not built yet," not "broken" — the Reverse Proxy page creates all eight hosts before their services exist.
- **Homepage's Nginx Proxy Manager tile opens port 81.** On purpose: 80 is the proxy's public side, 81 is its admin UI.
- **A Matter lock's Manage access dialog lists more users than you created.** Re-running a setup script stacks credentials; the Matter Locks page's broom script clears the guest slots.

> [!NOTE]
> When a new failure teaches something, it goes here under its symptom — the build pages stay a build.
