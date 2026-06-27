---
title: Cameras, Doorbell & Frigate
subtitle: Frigate NVR with detection on the 1080 Ti, plus the Reolink doorbell and RLC-510WA
collection: My Build
order: 11
accent: spruce
---

Frigate is the camera recorder (an NVR — network video recorder) that turns the two Reolink cameras into searchable, object-aware footage on hardware you own. On this build it runs as its own container, hardware-decodes the camera streams, and runs object detection on the **EVGA GTX 1080 Ti** that was shared into the host earlier — no cloud, no subscription, no Coral. This page builds the container, points detection at the 1080 Ti via ONNX/CUDA, adds the black 4:3 Reolink doorbell and the RLC-510WA over go2rtc, and lands recordings on the dedicated footage drive.

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
The script prints the container's address when it finishes — browse to it on port **5000**. You should see Frigate running with a single `test` camera looping a sample clip, proof the install works before any real camera exists.

> [!WARNING]
> Port 5000 serves the UI with **no login** — the generated config ships with authentication disabled, and in Frigate's port scheme 5000 is the internal unauthenticated port. That is tolerable on the home LAN behind the router, but never create a port-forward to it. Camera footage stays on the network; remote access comes through Tailscale instead.

### Pin its address and start at boot
Give the container a fixed IP via the router's DHCP (Dynamic Host Configuration Protocol) reservation page, the same habit used for every guest, so Home Assistant and bookmarks never lose it. Then, in Proxmox, select the container, open **Options**, and enable **Start at boot** so a power cut does not silently end recordings.

> [!INPUT] frigate-ip | Frigate container IP
> Pin it with a DHCP reservation so it never moves.

## Detect on the 1080 Ti

### Confirm the GPU made it into the container
The 1080 Ti is **shared** into this LXC from the host's NVIDIA driver — it was lent in with the `dev0:` device syntax after the GPU was shared in, and it is never VFIO (Virtual Function I/O)'d to a VM. Confirm the card is visible from inside the container. Open the container's **Console** and run:

```bash
nvidia-smi
```

You should see the GTX 1080 Ti listed with a driver version. If the command is missing or the card is absent, the share did not take — recheck the `dev0:` lines in the container's config on the host and that the in-container userspace driver matches the host's version exactly.

> [!WARNING]
> The card is shared across containers, not handed to one guest — Frigate detection now, the Ollama LLM (large language model) and faster-whisper STT (speech-to-text) voice stack later. Keep `nvidia-persistenced` enabled on the host and the host/in-container driver versions matched. VFIO is reserved for the HBA (host bus adapter) feeding the TrueNAS VM; the GPU stays shared. The moment the GPU is VFIO-bound, every container loses detection at once.

### Point detection at ONNX on CUDA
This build does **not** use the Intel iGPU + OpenVINO path that Frigate defaults to. Detection runs on the 1080 Ti via the **ONNX (Open Neural Network Exchange) detector on the CUDA (NVIDIA's GPU compute platform) execution provider**, which lives inside Frigate's `-tensorrt` image and is auto-detected — point Frigate at ONNX and CUDA and it finds the card. Edit `/config/config.yml` (easiest in the web UI's built-in config editor, which validates as you type; `nano /config/config.yml` in the console works too) and set:

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

> [!INPUT] doorbell-ip | Reolink doorbell IP

> [!INPUT] doorbell-user | Doorbell username

> [!SECRET] doorbell-password | Doorbell password
> The login set in the Reolink app — it fills the `USER` / `PASS` slots of the config below.

> [!WARNING]
> Take the exact stream details from the Reolink app — do not guess them. In particular confirm **HTTP is enabled**, or the http-flv video path will not connect at all.

### Add the doorbell to the config
Add the doorbell's streams to a `go2rtc` block, then point a `doorbell` camera at the local restream. Swap in the doorbell's IP, username, and password:

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
> Reading the odd parts: `channel0_main.bcs` is the full-resolution stream (recorded) and `channel0_ext.bcs` is the low-res sub stream (analyzed) — splitting them spares both the doorbell and the detector. The trailing `#video=copy#audio=copy#audio=opus` is deliberate: it passes the video through untouched, keeps the original audio for recording, *and* adds a second Opus audio track the browser live view needs. The bare `rtsp://…/Preview_01_sub` line is the talk-back path, and it must **not** carry an `ffmpeg:` prefix — go2rtc has to handle that stream directly for two-way audio to work.

> [!TIP]
> Talk-back needs the page served over **HTTPS** — browsers only allow microphone access on a secure connection (use Frigate's authenticated port `8971`). The reverse proxy's real certificate covers this, and the doorbell drives the speaker announcements set up in the automations work.

## Add the RLC-510WA

### Add the second camera
The **Reolink RLC-510WA** (5MP WiFi) is added the same restream way, so its single connection is shared between recording and detection, with detection on the sub stream to keep the WiFi link light. Pin its IP with a DHCP reservation first, then take the exact stream paths from the Reolink app.

> [!INPUT] camera-ip | Reolink RLC-510WA IP

> [!INPUT] camera-user | RLC-510WA username

> [!SECRET] camera-password | RLC-510WA password

```yaml
go2rtc:
  streams:
    rlc510:
      - "rtsp://CAMERA-USER:CAMERA-PASS@CAMERA-IP:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://CAMERA-USER:CAMERA-PASS@CAMERA-IP:554/h264Preview_01_sub"

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
> `h264Preview_01_main` / `_sub` is the usual RLC spelling, but confirm it from the Reolink app rather than trusting the example. Detecting on the sub stream is correct anyway — frames get resized down to the model's small input, so a high-resolution detect stream loses the extra detail for nothing. Frigate tracks `person` by default; add an `objects: track:` list to watch for `car`, `dog`, and friends.

> [!WARNING]
> WiFi cameras drop more than wired ones — Frigate's docs are blunt that wireless streams are less reliable. If the RLC-510WA stutters, that is the link, not Frigate. The **Netgear GS308EPP** managed PoE (Power over Ethernet) switch is staged in the rack for future wired cameras; a camera on it joins Frigate the plain-RTSP way, no http-flv gymnastics needed.

## Footage and retention

### Record to the dedicated footage drive
Detection runs in the NVMe (Non-Volatile Memory Express)-cached container, but recordings are bulk, write-heavy data that belongs on a spinning disk. They go to the **third Seagate IronWolf ST4000VN006 4 TB** — the lone footage drive on a motherboard SATA (Serial ATA) port, deliberately kept off the two-disk TrueNAS ZFS (Zettabyte File System) mirror. Frigate writes everything under `/media/frigate` inside the container, so mount that drive on the host and hand it to the container as a mount point at `/media/frigate`. Then set retention explicitly — out of the box continuous recording is off:

```yaml
record:
  enabled: true
  continuous:
    days: 7
```

Restart Frigate to apply. A lighter middle ground is a `motion:` block with a `days:` value instead of `continuous:`, keeping only the stretches where something moved.

> [!WARNING]
> Continuous recording eats disk fast — sizing the footage drive for it is the whole reason that disk sits apart from the mirror, on a board SATA port the host can still see (the HBA and its two mirror disks belong to the TrueNAS VM and vanish from the host). Frigate has a safety valve — when under an hour of space remains it deletes the oldest hour — but watch actual usage for a few days and size `days:` from that. The footage drive gets no redundancy and no offsite, by choice.

## Wire it into the build

### Connect to Home Assistant over MQTT
Frigate and Home Assistant talk over **MQTT (Message Queuing Telemetry Transport)**. This build runs a single **Mosquitto** broker that Zigbee2MQTT also uses; Frigate logs in with its own dedicated MQTT credentials. Point Frigate at the broker and restart:

```yaml
mqtt:
  enabled: true
  host: HA-VM-IP
  user: mqtt-user
  password: your-mqtt-password
```

Then install the Frigate integration in the Home Assistant OS VM through HACS (the Home Assistant Community Store), restart Home Assistant, and add it under **Settings → Devices & services** — it asks for Frigate's address (`http://frigate-ip:5000`). You get a live entity per camera, occupancy and motion binary sensors per camera and zone, object-count and performance sensors, and the recordings browsable in Home Assistant's media browser — the raw material for the automations later in this build.

> [!INPUT] mqtt-user | MQTT username | | mqtt-user
> The dedicated user Frigate logs in as — `mqtt-user` matches the example; edit if named differently.

> [!SECRET] mqtt-password | MQTT password

> [!WARNING]
> **Boot order matters.** The broker lives in the Home Assistant OS VM, which boots slower than this LXC. After a power cut the container can come up before the broker exists, so its MQTT connection never establishes and its Home Assistant entities stay dead until a restart. Fix it in Proxmox: give the Home Assistant OS VM a lower **Start/Shutdown order** number (or a startup delay) than the Frigate container — start the VM before the container. Footage still records locally either way; only the automation side goes quiet.

### Restart and watch it work
Apply any config change by restarting Frigate in the container's console:

```bash
systemctl restart frigate
```

Reload the web UI — the doorbell and RLC-510WA live views should appear, and walking through a frame should produce a tracked person within a few seconds.

> [!TIP]
> If a camera stays black, watch the logs while it starts: `journalctl -u frigate -f` in the console. A wrong RTSP path or password shows up there immediately. If detection feels sluggish or the CPU is pinned, the 1080 Ti probably is not doing the work — re-check that `nvidia-smi` sees the card inside the container and that the logs name the ONNX/CUDA detector, not a CPU fallback.

> [!NOTE]
> This install does not update in place, so **back up `/config/config.yml`** after every change. That single file is the hand-built heart of the setup — the ONNX detector, the go2rtc doorbell and camera blocks, the MQTT credentials — and rebuilding it from memory is the painful part of any upgrade. Copy it to a Nextcloud folder or the TrueNAS share so a new container is a five-minute restore. At upgrade time, the script's own path is to build a fresh container and copy `/config` across — take a snapshot first.
