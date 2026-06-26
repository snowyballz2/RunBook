---
title: Cameras, Doorbell & Frigate
subtitle: My two Reolink cameras into Frigate, detection on the 1080 Ti
collection: My Build
order: 6
accent: azure
---

This is my execution checklist, not a tutorial — the *Frigate* guide has the full how-to for every step below. Here I only record the specifics: which cameras, which detector, where footage lands.

## The container and the detector

### Build the Frigate LXC
Run the community-scripts install per the *Frigate* guide — accept its defaults, expect the source build to take a while, re-run if it stumbles. Mine runs as a **privileged LXC**, started **after** the *Home Assistant OS* VM so the MQTT broker exists first (see Wire it in, below).

> [!INPUT] frigate-ip | Frigate container IP
> Pin it with a DHCP reservation (the *AdGuard Home* habit) so HA and my bookmarks never lose it.

### Detect on the 1080 Ti, not the iGPU
The general guide defaults to the Intel iGPU + OpenVINO; I do **not**. My build runs detection on the **EVGA GTX 1080 Ti** via the **NVIDIA GPU** path — follow the *Frigate* guide's "Detection on an NVIDIA GPU" section. The card is shared into the LXC from the **host driver** (per the *Frigate* GPU-sharing note and my *Prep & BIOS* / Proxmox setup), never VFIO'd to a VM.

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
> Pascal (compute 6.1) clears the ONNX/CUDA bar — driver 545+, CUDA 12.x. I use a **YOLOv9** model and avoid RF-DETR (slow on Pascal). One detector only: `onnx` here means no `openvino` block alongside it.

> [!WARNING]
> The 1080 Ti is **shared across LXCs**, not handed to a VM — Frigate detection now, Ollama + faster-whisper later (*Local Voice*). Keep `nvidia-persistenced` enabled on the host and the host/in-container driver versions matched. VFIO is reserved for the HBA → TrueNAS VM (*TrueNAS*); the GPU stays shared.

## The Reolink doorbell

### Wire and prep it
**Reolink Video Doorbell WiFi** (black — the 4:3 wide head-to-toe view), powered off the existing **doorbell transformer**, no battery. In the Reolink app: enable **HTTP and RTSP**, set bitrate to **"On, fluency first"**, **Interframe Space 1×**, and pin its IP with a DHCP reservation — all per the *Frigate* doorbell walkthrough.

> [!INPUT] doorbell-ip | Doorbell IP

> [!INPUT] doorbell-user | Doorbell username

> [!SECRET] doorbell-password | Doorbell password
> The login I set in the Reolink app — fills the `USER` / `PASS` slots below.

### Add it via go2rtc http-flv
Video over **http-flv** for stability, a secondary RTSP line for talk-back audio, fused by go2rtc — exactly the *Frigate* guide's pattern. Swap in my `DOORBELL-IP` / `USER` / `PASS`:

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

> [!TIP]
> Talk-back needs **HTTPS** (port `8971`), which my *Reverse Proxy* cert already provides. The doorbell drives the speaker-on-doorbell announcement in the *Automations* guide.

## The RLC-510WA

### Add the second camera
**Reolink RLC-510WA** (5MP WiFi) — same go2rtc-restream approach so the one connection is shared, detect on the sub stream to keep the WiFi link light. Pin its IP too.

> [!INPUT] camera-ip | RLC-510WA IP

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
```

> [!NOTE]
> Confirm the exact RTSP paths from the Reolink app rather than trusting the example — `h264Preview_01_main` / `_sub` is the usual RLC spelling. WiFi cameras drop more than wired; if streams stutter, that's the link, not Frigate.

## Footage, retention, and the spare switch

### Record to the third IronWolf
Detection runs on the NVMe-cached LXC, but recordings go to **bulk disk**: the **third Seagate IronWolf ST4000VN006 4TB** (the lone one — the other two are the *TrueNAS* ZFS mirror). Mount it to the host and hand it to the container at `/media/frigate`, per the *Frigate* "Putting recordings on storage" note, so retention math is against terabytes, not the 20 GB virtual disk.

```yaml
record:
  enabled: true
  continuous:
    days: 7
```

> [!WARNING]
> Continuous recording eats disk fast — sizing the third IronWolf for it is the whole reason that drive is separate from the mirror. Watch actual usage for a few days and adjust `days:`.

### The PoE switch is staged, not wired
The **Netgear GS308EPP** managed PoE+ switch is in the rack ready for **future PoE cameras** — nothing on it yet. When a wired camera arrives it goes on the GS308EPP and into Frigate the plain-RTSP way (wired beats WiFi), no go2rtc http-flv gymnastics needed.

## Wire it into the build

### MQTT to Home Assistant
Point Frigate at the Mosquitto broker inside my *Home Assistant OS* VM, then install the Frigate integration via HACS (*Frigate* guide). Restart Frigate after the config change.

```yaml
mqtt:
  enabled: true
  host: HA-VM-IP
  user: mqtt-user
  password: your-mqtt-password
```

> [!INPUT] mqtt-user | MQTT username | | mqtt-user
> The dedicated HA user Frigate logs in as.

> [!SECRET] mqtt-password | MQTT password

> [!WARNING]
> **Boot order matters.** The *Home Assistant OS* VM holds the broker and boots slower than this LXC, so set its **Start/Shutdown order** lower than Frigate's — otherwise after a power cut Frigate comes up before the broker and its HA entities stay dead until a restart. Footage still records either way; only the *Automations* side goes quiet.

> [!NOTE]
> Frigate here doesn't update in place — **back up `/config/config.yml`** (my hand-built detector + go2rtc + camera blocks) to a *Nextcloud* folder or the *TrueNAS* share after every change. Restoring it is five minutes; rebuilding it from memory is not.
