---
title: Cameras, Doorbell & Frigate
subtitle: Frigate NVR with detection on the 1080 Ti — the Reolink doorbell plus four EmpireTech turrets and a full-colour indoor camera
collection: My Build
order: 12
accent: spruce
---

Frigate is the camera recorder (an NVR — network video recorder) that turns the two Reolink cameras into searchable, object-aware footage on hardware you own. On this build it runs as its own container, hardware-decodes the camera streams, and runs object detection on the **EVGA GTX 1080 Ti** whose driver was set up on the host earlier and is shared from there into containers — no cloud, no subscription, no Coral. This page builds the container, points detection at the 1080 Ti via ONNX/CUDA, adds the black 4:3 Reolink doorbell and the RLC-510WA over go2rtc, specs the four EmpireTech turrets and the full-colour indoor camera that make up the wired perimeter, and lands recordings on the dedicated footage drive.

## Create the Frigate container

### Run the install script
Frigate runs as a privileged **LXC (Linux Container)** here. The community-scripts helper builds one in a single pass. In the Proxmox web interface, click the node, then **Shell**, and run:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/frigate.sh)"
```

Accept the defaults — **8 cores, 4 GB RAM, a 20 GB disk** on Debian 12 — and let it work. It compiles Frigate from source, so expect a long run. Read the script before piping it into a root shell, the same download-read-run habit used for every helper in this build.

> [!TIP]
> This is the fussiest script in the build — it pulls large AI components and occasionally stumbles partway. If it errors, just re-run it; a second attempt is normal.

> [!WARNING]
> The script builds a **privileged** container, which has weaker isolation from the host than an unprivileged one, and Frigate's own docs note that running in an LXC is community territory rather than officially supported. This path is popular and works well on this hardware, but the officially supported route is Docker Compose inside a VM (virtual machine). The LXC is chosen here so the container can share the host's GPU directly — the whole reason detection runs on the 1080 Ti instead of an Intel iGPU.

### Open the web UI
The script prints the container's address when it finishes — browse to it on port **5000**. You should see Frigate running with a single `test` camera looping a sample clip, proof the install works before any real camera exists. Once that first look confirms the install, do your day-to-day browsing on Frigate's **authenticated UI at `https://<frigate-ip>:8971`** instead (expect a self-signed certificate warning) — port 5000 stays for the Home Assistant integration later on this page.

> [!WARNING]
> Port 5000 serves the UI with **no login** — the generated config ships with authentication disabled, and in Frigate's port scheme 5000 is the internal unauthenticated port. That is tolerable on the home LAN behind the router, but never create a port-forward to it. Camera footage stays on the network; remote access comes through Tailscale instead.

### Pin its address and start at boot
Give the container a fixed IP via the router's DHCP (Dynamic Host Configuration Protocol) reservation page, the same habit used for every guest, so Home Assistant and bookmarks never lose it. Then, in Proxmox, select the container, open **Options**, and enable **Start at boot** so a power cut does not silently end recordings.

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> Pin it with a DHCP reservation so it never moves.

## Detect on the 1080 Ti

### Lend the GPU into the container
The 1080 Ti is **shared** into this LXC from the host's NVIDIA driver — it is never VFIO (Virtual Function I/O)'d to a VM. The GPU Sharing & HBA Passthrough page set up the host driver and left a lending recipe to apply when each borrowing container exists; the Frigate container now does, so lend the card in. On the host (click the Proxmox node, then **Shell**), edit `/etc/pve/lxc/<frigate-ctid>.conf` (`<frigate-ctid>` is this container's ID, shown next to its name in the sidebar) and add the three NVIDIA device lines:

```ini
dev0: /dev/nvidia0,gid=44
dev1: /dev/nvidiactl,gid=44
dev2: /dev/nvidia-uvm,gid=44
```

Restart the container. Then, inside it, install the **in-container NVIDIA userspace driver at the same version** the host's `nvidia-smi` reports — a version mismatch is the classic cause of "the GPU vanished." The container's Debian release ships a different driver version than the host's, so skip `apt` for this one: download NVIDIA's installer for the exact host version and run it userspace-only — `sh NVIDIA-Linux-x86_64-<version>.run --no-kernel-module`. The kernel module lives on the host, so only the libraries install inside; the host-side "never a `.run`" rule is about kernel modules and does not apply in an LXC.

### Confirm the GPU made it into the container
Confirm the card is visible from inside the container. Open the container's **Console** and run:

```bash
nvidia-smi
```

You should see the GTX 1080 Ti listed with a driver version. If the command is missing or the card is absent, the share did not take — recheck the `dev0:` lines in the container's config on the host and that the in-container userspace driver matches the host's version exactly.

> [!WARNING]
> The card is shared across containers, not handed to one guest — Frigate detection now, the Ollama LLM (large language model) and faster-whisper STT (speech-to-text) voice stack later. Keep `nvidia-persistenced` enabled on the host and the host/in-container driver versions matched. VFIO is reserved for the HBA (host bus adapter) feeding the TrueNAS VM; the GPU stays shared. The moment the GPU is VFIO-bound, every container loses detection at once.

### Fetch the detection model
Frigate does not bundle YOLO models — the file the config below points at has to be placed there once, by you. Download a pre-converted **YOLOv9-tiny ONNX export** (Frigate's object-detector documentation links current conversions) and put it inside the container at `/config/model_cache/yolov9-t.onnx`, creating the `model_cache` directory first if it does not exist. Without this file, detection fails to start with a missing-model error.

### Point detection at ONNX on CUDA
This build does **not** use the Intel iGPU + OpenVINO path that Frigate defaults to. Detection runs on the 1080 Ti via the **ONNX (Open Neural Network Exchange) detector on the CUDA (NVIDIA's GPU compute platform) execution provider** — this install's Frigate build ships the ONNX runtime, which picks up CUDA automatically once the card is visible, so pointing Frigate at ONNX is enough to find the card. Edit `/config/config.yml` (easiest in the web UI's built-in config editor, which validates as you type; `nano /config/config.yml` in the console works too) and set:

```yaml
detectors:
  onnx:
    type: onnx

model:
  model_type: yolo-generic
  width: 320
  height: 320
  input_tensor: nchw
  input_dtype: float
  path: /config/model_cache/yolov9-t.onnx
```

> [!NOTE]
> The 1080 Ti is Pascal — compute capability 6.1 — which clears every requirement: compute capability 5.0 or higher, NVIDIA driver 545 or newer, and CUDA 12.x. Use a **YOLOv9** model (the small `yolov9-t` is a good starting point); avoid RF-DETR, which runs very slowly on Pascal cards. One rule that never relaxes: **detector types cannot be mixed** — an `onnx` detector here means no `openvino` or `edgetpu` block alongside it.

### Set the decode preset
Frigate also hardware-decodes every camera stream so the CPU is not burning cycles unpacking video. With the 1080 Ti shared in, decode the streams on the NVIDIA card too:

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
```

`preset-nvidia` selects NVDEC hardware decoding on the card. Restart Frigate after any config change (covered below) and watch the logs to confirm decode lands on the GPU rather than falling back to software.

## Add the Reolink doorbell

The doorbell is the camera most people actually want, and the pick here is the **Reolink Video Doorbell WiFi in black** — the 4:3 model that gives a tall head-to-toe view of a visitor and a package on the step. It runs off the existing wired doorbell transformer, no battery. It does not behave like a plain RTSP (Real-Time Streaming Protocol) camera, so it gets its own walkthrough.

### Understand why a doorbell is different
On Reolink doorbells, plain RTSP video is **less reliable** — it drops and stutters — while video carried over **http-flv (video over HTTP)** is steady. But the two-way talk audio only rides on RTSP. So the trick is to pull *video* over http-flv for stability and add a *secondary RTSP stream just for the audio*, then let Frigate's bundled **go2rtc** restreamer fuse them into one feed it can record, detect on, and talk back through.

### Prepare the doorbell in the Reolink app
In the doorbell's advanced network settings, **enable HTTP and RTSP** and set a username and password. Set the bitrate to **"On, fluency first"** (constant bitrate, which Frigate prefers) and the **Interframe Space to 1×** (an I-frame interval matching the frame rate). Pin the doorbell's IP with a DHCP reservation while you are there so the config below never goes stale.

> [!INPUT] doorbell-ip | Reolink doorbell IP | 192.168.1.70

> [!INPUT] doorbell-user | Doorbell username

> [!SECRET] doorbell-password | Doorbell password
> The login set in the Reolink app — it fills the `USER` / `PASS` slots of the config below.

> [!WARNING]
> Take the exact stream details from the Reolink app — do not guess them. In particular confirm **HTTP is enabled**, or the http-flv video path will not connect at all.

### Add the doorbell to the config
There is exactly **one** `go2rtc:` block and **one** `cameras:` block in the whole `/config/config.yml` — every stream and every camera lives as a sibling entry under those two keys. YAML allows only one mapping per top-level key, so the second camera you add later (the RLC-510WA) gets folded into these same two blocks rather than starting fresh ones. Add the doorbell first: fold its streams into the generated file's existing `go2rtc: streams:`, and the `doorbell:` camera into the existing `cameras:` — and while you are there, delete the `test:` sample camera (and its sample stream) that the install shipped with, so the file holds only real cameras. Swap in the doorbell's IP, username, and password:

```yaml
go2rtc:
  streams:
    doorbell:
      - "ffmpeg:http://DOORBELL-IP/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=USER&password=PASS#video=copy#audio=copy#audio=opus"
      - "rtsp://USER:PASS@DOORBELL-IP/Preview_01_sub"
    doorbell_sub:
      - "ffmpeg:http://DOORBELL-IP/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=USER&password=PASS"

cameras:
  doorbell:
    ffmpeg:
      output_args:
        record: preset-record-generic-audio-copy
      inputs:
        - path: rtsp://127.0.0.1:8554/doorbell
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/doorbell_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    live:
      streams:
        Doorbell: doorbell
    objects:
      track:
        - person
        - package
```

> [!NOTE]
> Reading the odd parts: `channel0_main.bcs` is the full-resolution stream (recorded) and `channel0_ext.bcs` is the low-res sub stream (analyzed) — splitting them spares both the doorbell and the detector. The trailing `#video=copy#audio=copy#audio=opus` is deliberate: it passes the video through untouched, keeps the original audio for recording, *and* adds a second Opus audio track the browser live view needs. On the camera, `output_args: record: preset-record-generic-audio-copy` is what actually copies that original audio into the saved files — without it the recordings drop sound. The bare `rtsp://…/Preview_01_sub` line is the talk-back path, and it must **not** carry an `ffmpeg:` prefix — go2rtc has to handle that stream directly for two-way audio to work. The `live: streams:` block binds the live view (and its talk button) to that full `doorbell` stream rather than the detect substream.

> [!TIP]
> Talk-back needs the page served over **HTTPS** — browsers only allow microphone access on a secure connection (use Frigate's authenticated port `8971`). The reverse proxy set up later in this build provides the real certificate for that, and the doorbell will drive the speaker announcements set up later in the automations work.

> [!TIP]
> Not interested in talking back? Drop the secondary `rtsp://…/Preview_01_sub` line entirely and keep just the http-flv video. That is the simplest, most reliable doorbell setup — you still get full recording and person/package detection, without the most fragile part of the config.

> [!WARNING]
> Reolink doorbells have limited streaming capacity and dislike many simultaneous connections. Detecting on the sub stream, as above, keeps the load light — but every extra consumer is another connection, and adding Reolink's own Home Assistant integration is a common one. Running everything at once can cause dropouts, so add one thing at a time and watch the logs.

## Add the RLC-510WA

### Add the second camera
The **Reolink RLC-510WA** (5MP WiFi) is added the same restream way, so its single connection is shared between recording and detection, with detection on the sub stream to keep the WiFi link light. Pin its IP with a DHCP reservation first, then take the exact stream paths from the Reolink app.

These entries join the blocks you already have — they do **not** start a second `go2rtc:` or a second `cameras:`. Add the two `rlc510` streams as siblings under your existing `go2rtc: streams:` (right alongside `doorbell` and `doorbell_sub`), and add the `rlc510:` camera as a sibling under your existing `cameras:` (right alongside `doorbell:`). A duplicate top-level `go2rtc:` or `cameras:` is invalid YAML — the later one wins and the doorbell silently disappears. The snippet below shows the new entries with their parent keys for placement only; merge them in, do not paste a fresh copy of `go2rtc:`/`cameras:`.

> [!INPUT] camera-ip | Reolink RLC-510WA IP | 192.168.1.71

> [!INPUT] camera-user | RLC-510WA username

> [!SECRET] camera-password | RLC-510WA password

```yaml
# add these two streams under your EXISTING go2rtc: streams: map
go2rtc:
  streams:
    rlc510:
      - "rtsp://CAMERA-USER:CAMERA-PASS@CAMERA-IP:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://CAMERA-USER:CAMERA-PASS@CAMERA-IP:554/h264Preview_01_sub"

# add this camera under your EXISTING cameras: map (sibling of doorbell:)
cameras:
  rlc510:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/rlc510
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/rlc510_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    detect:
      enabled: true
    record:
      enabled: true
```

> [!NOTE]
> If you would rather see the whole picture at once, the finished file has a single `go2rtc: streams:` with four entries (`doorbell`, `doorbell_sub`, `rlc510`, `rlc510_sub`) and a single `cameras:` with two entries (`doorbell:`, `rlc510:`). The `detectors:`, `model:`, `ffmpeg:`, `record:`, and `mqtt:` blocks from the other sections each appear once at the top level too.

> [!NOTE]
> `h264Preview_01_main` / `_sub` is the usual RLC spelling, but confirm it from the Reolink app rather than trusting the example. Detecting on the sub stream is correct anyway — frames get resized down to the model's small input, so a high-resolution detect stream loses the extra detail for nothing. Aim the detect stream at roughly 720p and **5 fps** (the recommended rate; 10 fps is the maximum worth using for most setups) — anything higher just burns effort on frames the model downscales away. Frigate tracks `person` by default; add an `objects: track:` list to watch for `car`, `dog`, and friends.

> [!WARNING]
> WiFi cameras drop more than wired ones — Frigate's docs are blunt that wireless streams are less reliable. If the RLC-510WA stutters, that is the link, not Frigate. The **Netgear GS308EPP** managed PoE (Power over Ethernet) switch is the home for the wired EmpireTech perimeter specced below; a camera on it joins Frigate the plain-RTSP way, no http-flv gymnastics needed.

## The PoE camera lineup

The doorbell and the WiFi RLC-510WA got the build going; the wired perimeter is **EmpireTech (Dahua-family) turrets**, settled on after weighing every alternative. Here is the locked lineup.

### What to buy
- **Four `IPC-T54PRO-AS` (WizColor dual-light) — the perimeter.** A Dahua-made 4MP turret on a large **1/1.8″** sensor with an **f/1.0** lens, **dual light** (IR to 60 m, *or* a warm LED for full-colour night), and **two-way talk**. **$199.99** each, direct from empiretech01.com. Get the **3.6mm** lens — the mounting section explains why it fits your corners. It supersedes the older IR-only `IPC-T54IR-AS-S3`: same price, but the PRO is the newer WizColor generation and adds the warm light and speaker for nothing extra.
- **One or two `IPC-Color4K-T-S2` — indoor.** An **8MP 1/1.2″** full-colour turret, the biggest sensor in this class, so it holds clean colour in a dark room where an IR camera would glare off walls and glass. **$279.99** each, **3.6mm** lens — it also sits in an inside 90° corner, so it takes the same wedge-fit lens as the outdoor turrets (3.6mm fills the 90° corner and reaches further for facial ID; 2.8mm would just waste width on the flanking walls). One camera recognises across a large room and identifies out to about 25 ft; a big open-plan space is better served by **two** in opposite corners. The white finish sells out fast — back-order it rather than settle.
- **The Reolink doorbell stays** — already wired and already in Frigate above.

> [!NOTE]
> **Why EmpireTech (Dahua), not Reolink or Hikvision.** Frigate lives on an RTSP stream, and Dahua-family cameras give the clean kind: a plain `/cam/realmonitor` URL, no http-flv wrappers, no connection-limit juggling, and **fully configurable substreams** so detection gets a right-sized frame. They also expose a **real manual shutter** and *honour* it — the one thing that keeps a moving person sharp at night — where Reolink fakes that control and auto-blurs. And they behave when firewalled off the internet (the hardening below), which Reolink actively fights. Hikvision's hardware is just as good, but the legitimate English-firmware version costs *more* than the EmpireTech, splits you across two config styles, and the cheap listings are grey-market with no security patches — so it was considered and dropped.

> [!TIP]
> **On a tight budget, the sanctioned swap is Amcrest, not Reolink.** The **`IP5M-T1179EW`** (**$79.99**, and the one camera Micro Center actually stocks) is a Dahua rebrand — it keeps the clean RTSP, the configurable substream, and the honoured manual shutter, just on a smaller **1/2.7″** sensor. Use it on a lit or secondary angle where you don't need the PRO's night reach. It drops into the same config and the same hardening as the EmpireTechs — one playbook — where a Reolink would fracture both.

> [!WARNING]
> Buy EmpireTech **direct from empiretech01.com** (or its own Amazon storefront). Newegg and marketplace resellers list the identical cameras at a steep markup. These prices are a mid-2026 snapshot — check the store for the day's number — and EmpireTech runs limited stock, so order the four together.

### Add each one to the config
A Dahua-family camera takes **plain RTSP** — none of the doorbell's http-flv work. Wire it to the **GS308EPP**, give it a DHCP reservation, and fold its two streams into the same `go2rtc: streams:` and its camera into the same `cameras:` block you built above:

```yaml
# main = record, sub = detect — fold into your EXISTING blocks
go2rtc:
  streams:
    front_turret:
      - "rtsp://USER:PASS@CAM-IP:554/cam/realmonitor?channel=1&subtype=0"
    front_turret_sub:
      - "rtsp://USER:PASS@CAM-IP:554/cam/realmonitor?channel=1&subtype=1"
```

> [!TIP]
> In each turret's own web UI, set the **substream** to roughly 720p at **5 fps** for a clean detect frame, and at night set a **manual shutter** — cap it near 1/120 s and hold the gain down — so a moving person doesn't smear (the control Reolink never gave you). On the `T54PRO-AS`, leave the warm light **off / IR mode** for any angle where you want to read a licence plate; the colour mode washes plates out.

## Mount the cameras

The four turrets go in **inside building corners**, routed straight into the wall cavity. Turrets make this easy — here is the whole method.

### Aiming: the eyeball does the work
A turret is a ball-in-socket — it tilts and rotates inside its housing, so mounted flat on a wall it **already aims down and out**. You do **not** need an angled bracket or a wall arm to point it down; downward is its natural direction. (Brackets only solve the opposite problem — a soffit-mounted turret that can't tilt back *up* to the horizon — which is not your case.)

### Lens: 3.6mm fits an inside corner
Each camera sits in a concave 90° corner, so the two walls block everything but a **90° wedge** looking out. The **3.6mm** lens (about 87°) fits that opening almost exactly — every pixel lands on the useful area, and the walls stay just out of frame. A wider 2.8mm would overspill onto the two flanking walls and, worse, bounce the IR and warm light back into the lens at night. Step up to **6mm** only on a corner whose view is unusually deep and you want the extra reach down the middle.

### Cavity mount: skip the junction box
Routing into the wall cavity means the cable and its waterproof connector tuck **inside the wall**, so you can skip the junction box entirely — it exists for solid-masonry runs with nowhere to hide the connector. Per camera:

1. **Drill about a 1-inch hole** behind the base, big enough to pass the camera's moulded waterproof RJ45 pigtail into the cavity. Position it so the base covers the hole.
2. **Caulk the base to the wall, leaving a gap at the bottom** so any wind-driven water drains out instead of pooling in the wall.
3. The RJ45 connection now lives in the dry cavity — protected, no weatherproofing tape needed (a dab of dielectric grease is belt-and-braces).

> [!NOTE]
> The one exception is a corner that turns out to be **solid brick or stucco with no cavity** behind it — there you would want EmpireTech's **`PFA130-E`** junction box (about $20) to hold the connector, since you cannot fish into the wall. For framed walls with a cavity, buy no boxes.

> [!WARNING]
> Keep each camera's view clear of the **flanking walls, gutters, and fascia**. A turret's lens sits flush, so a bright surface right in front bounces IR — and the T54PRO-AS's warm light — back into the lens and washes the image out. Aiming into the open wedge (the reason for the 3.6mm lens) is exactly what avoids it.

## Harden each camera

A cheap IP camera is the least-trusted device on your network — closed firmware, a habit of phoning home to a vendor cloud, and exactly the sort of thing that turns up in breach lists. But nothing in this build needs a camera to reach the internet: Frigate pulls its stream **locally**, and you view it remotely by tunnelling *in* over Tailscale (the Remote Access page). So cut every camera off from the internet while leaving it fully reachable on the LAN. This is **device-level isolation** — no VLAN, no managed switch, no extra hardware.

### Cut the camera's route to the internet
Do this **after** the camera is configured and streaming to Frigate — initial setup in the vendor app often needs internet to activate the device, so lock it down last.

Give each camera a **static IP with a blank (or dead) gateway**. A device only needs its gateway to reach addresses *outside* its own subnet — i.e. the internet. Leave it blank and the camera can still talk to anything on `192.168.1.x` (so Frigate keeps pulling its stream, unchanged), but it physically **cannot route a packet to the internet**: it can't phone home, leak footage to a cloud, or be reached by anyone outside. Set it in the camera's own network settings, matching the address you reserved earlier:

- **IP** — the address you pinned (e.g. `192.168.1.71`)
- **Subnet mask** — `255.255.255.0`
- **Gateway** — leave **blank**; if the firmware insists on a value, enter an unused address on the subnet (even the camera's own IP) so packets route nowhere
- **DNS** — blank or your router; it can't reach an external resolver anyway, which is the point

### Shut the vendor cloud off at the source
In the camera's own app, turn **off** everything that reaches out: **cloud / P2P / remote access**, **UPnP** (so it can't punch its own hole in the router), and any "push to phone" service. You're replacing all of it with Frigate and Home Assistant notifications — local, and far smarter.

### Give it a local clock
The one thing a camera legitimately wants from outside is the time. With no gateway it can't reach an internet **NTP (Network Time Protocol)** server, so point its **NTP** setting at your **router** or **Home Assistant** — either serves time on the LAN — so recording timestamps stay correct.

> [!TIP]
> If a camera's firmware flat-out refuses to work without a real gateway (a few do), give it the gateway back and **block it at the router instead**: the Fios router's **Access Control** can deny that one device internet access. Same outcome, enforced upstream.

> [!NOTE]
> Know what this does and doesn't do. It stops the camera reaching the **internet** — which is how cameras actually get compromised (cloud bugs, phone-home, remote exploitation) — but not a hijacked camera talking sideways to other devices on the flat LAN. Blocking that *lateral movement* needs true **VLAN** segmentation, and the Verizon Fios router can't do VLANs. If you ever want that extra wall it's an optional add-on — a **Firewalla** or an **OPNsense** box alongside the Fios router (a one-time purchase, no subscription), never a requirement of this build. Internet-isolated cameras plus local-only footage already cover the threat that actually matters at home.

## Footage and retention

### Record to the dedicated footage drive
Detection runs in the NVMe (Non-Volatile Memory Express)-cached container, but recordings are bulk, write-heavy data that belongs on a spinning disk. They go to the **third Seagate IronWolf ST4000VN006 4 TB** — the lone footage drive on a motherboard SATA (Serial ATA) port, deliberately kept off the two-disk TrueNAS ZFS (Zettabyte File System) mirror. Frigate writes everything under `/media/frigate` inside the container — `recordings`, `clips` (snapshots), and `exports` — so the job is to put the footage disk under that exact path. All of this happens on the host: click the Proxmox node, then **Shell**.

**Identify the third IronWolf by serial.** It is the only ST4000VN006 the host can still see — the two mirror disks sit behind the VFIO'd HBA and never appear here:

```bash
lsblk -o NAME,SIZE,MODEL,SERIAL
```

Note its device name (for example `/dev/sda`) and double-check the serial before the next step.

**Format it ext4** — this erases the disk:

```bash
mkfs.ext4 -L frigate-footage /dev/sdX
```

**Mount it by UUID via `/etc/fstab`** so it comes back on every boot. Make the mount point with `mkdir -p /mnt/frigate-footage`, read the disk's UUID (universally unique identifier) with `blkid /dev/sdX`, and add this line to `/etc/fstab`, swapping in the UUID `blkid` printed:

```ini
UUID=<uuid-from-blkid> /mnt/frigate-footage ext4 defaults 0 2
```

Run `mount -a` to mount it now and prove the entry parses.

**Hand it to the container** as a mount point at `/media/frigate`:

```bash
pct set <frigate-ctid> -mp0 /mnt/frigate-footage,mp=/media/frigate
```

Restart the container — recordings now land on the dedicated disk, and the container's own 20 GB disk stays flat. With the disk in place, set retention explicitly — out of the box continuous recording is off (the default keeps clips of tracked objects for 10 days, but records nothing the rest of the time):

```yaml
record:
  enabled: true
  continuous:
    days: 7
```

Restart Frigate to apply. A lighter middle ground is a `motion:` block with a `days:` value instead of `continuous:`, keeping only the stretches where something moved.

> [!WARNING]
> The recordings tree under `/media/frigate` (`YYYY-MM-DD/HH/<camera>/MM.SS.mp4`, in UTC) is managed **entirely by Frigate** — retention is config-driven, so never browse in and delete clips by hand to reclaim space. Doing so corrupts Frigate's own bookkeeping. Change the `days:` values instead and let Frigate prune.

> [!WARNING]
> Continuous recording eats disk fast — sizing the footage drive for it is the whole reason that disk sits apart from the mirror, on a board SATA port the host can still see (the HBA and its two mirror disks belong to the TrueNAS VM and vanish from the host). Frigate has a safety valve — when under an hour of space remains it deletes the oldest hour — but watch actual usage for a few days and size `days:` from that. The footage drive gets no redundancy and no offsite, by choice.

## Wire it into the build

### Connect to Home Assistant over MQTT
Frigate and Home Assistant talk over **MQTT (Message Queuing Telemetry Transport)**. This build runs a single **Mosquitto** broker that Zigbee2MQTT also uses; Frigate logs in with its own dedicated MQTT credentials — the `mqtt-user` login you created in the broker's Logins list on the Home Assistant & Zigbee2MQTT page. Point Frigate at the broker and restart:

```yaml
mqtt:
  enabled: true
  host: HA-VM-IP
  user: mqtt-user
  password: your-mqtt-password
```

Then install the Frigate integration in the Home Assistant OS VM through **HACS (the Home Assistant Community Store)**, which itself has to be installed once first. You get a live entity per camera, occupancy and motion binary sensors per camera and zone, object-count and performance sensors, and the recordings browsable in Home Assistant's media browser — the raw material for the automations later in this build.

> [!DETAILS] Install HACS first, then the Frigate integration
> The Frigate integration is not in Home Assistant's built-in list — it ships through HACS, a community catalog that must be installed once before any community integration can be downloaded. Follow the official install steps at [hacs.xyz](https://hacs.xyz/docs/use/) — they walk you through adding HACS as an Add-on and signing in with a GitHub account — then **restart Home Assistant**. Now open **HACS**, search for **Frigate**, download it, and **restart Home Assistant again**. Only then add the Frigate integration under **Settings → Devices & services**; it asks for Frigate's address (`http://frigate-ip:5000`).

> [!INPUT] mqtt-user | MQTT username | | mqtt-user
> The dedicated user Frigate logs in as, created in the Mosquitto add-on's Logins on the Home Assistant & Zigbee2MQTT page — `mqtt-user` matches the example; edit if named differently.

> [!SECRET] mqtt-password | MQTT password

> [!WARNING]
> **Boot order matters.** The broker lives in the Home Assistant OS VM, which boots slower than this LXC. After a power cut the container can come up before the broker exists, so its MQTT connection never establishes and its Home Assistant entities stay dead until a restart. You already set this on the Home Assistant & Zigbee2MQTT page — confirm in Proxmox that the Home Assistant OS VM's **Start/Shutdown order** number is lower than this container's (or give the container a startup delay), so the VM starts before the container. Footage still records locally either way; only the automation side goes quiet.

### Restart and watch it work
Apply any config change by restarting Frigate in the container's console:

```bash
systemctl restart frigate
```

Reload the web UI — the doorbell and RLC-510WA live views should appear, and walking through a frame should produce a tracked person within a few seconds.

> [!TIP]
> If a camera stays black, watch the logs while it starts: `journalctl -u frigate -f` in the console. A wrong RTSP path or password shows up there immediately. If detection feels sluggish or the CPU is pinned, the 1080 Ti probably is not doing the work — re-check that `nvidia-smi` sees the card inside the container and that the logs name the ONNX/CUDA detector, not a CPU fallback.

> [!NOTE]
> This install does not update in place, so **back up `/config/config.yml`** after every change. That single file is the hand-built heart of the setup — the ONNX detector, the go2rtc doorbell and camera blocks, the MQTT credentials — and rebuilding it from memory is the painful part of any upgrade. Copy it to the TrueNAS `backups` share (or, later in the build, a Nextcloud folder) so a new container is a five-minute restore. At upgrade time, the script's own path is to build a fresh container and copy `/config` across — take a snapshot first.
