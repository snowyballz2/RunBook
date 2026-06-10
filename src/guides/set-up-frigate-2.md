---
title: Set Up Frigate
subtitle: Local camera NVR with AI detection for your RTSP cameras
collection: Proxmox Home Server
order: 5
accent: spruce
---

## Create the Frigate container

### Open the Proxmox shell
Click your node, then **Shell**.

### Run the install script
```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/frigate.sh)"
```

> [!WARNING]
> Frigate is the fussiest script in this collection. It downloads large AI components and occasionally stumbles partway through. If it errors, re-run it and check the container logs. Needing a second attempt is normal.

### Pass a hardware-acceleration device into the container (recommended)
If your CPU has integrated graphics, give the container access so it can offload video decoding and AI detection. In Proxmox, select the Frigate LXC, then **Resources, Add, Device Passthrough**, add the render device, and reboot the container.

```
/dev/dri/renderD128
```

> [!TIP]
> Example — on a system with an Intel iGPU, this enables QuickSync decoding and the OpenVINO detector, so the work happens on the GPU instead of hammering the CPU. Without it, Frigate runs on the CPU and works much harder.

## Get your camera stream

### Find your camera's RTSP URL
Frigate works with cameras that provide an RTSP or ONVIF stream. Get the stream URL and any username and password from your camera's app or admin page.

> [!WARNING]
> Take the RTSP URL straight from your camera's app or manual, do not guess it. The address and credentials are specific to each camera and firmware.

> [!NOTE]
> Example — an Aqara G410 doorbell exposes a local RTSP stream you enable in the Aqara app, which then shows you the URL. Most ONVIF cameras and many doorbells work the same way.

## Configure Frigate

### Open the configuration editor
Browse to the Frigate web interface on port 5000, then open **Settings, Configuration editor**. The config lives at `/config/config.yml`.

```
http://192.168.1.53:5000
```

### Paste a starting config
Use this as a base. Replace the `path:` line with your camera's RTSP URL. The editor validates as you go.

```yaml
mqtt:
  enabled: false

ffmpeg:
  hwaccel_args: preset-intel-qsv-h264

detectors:
  ov:
    type: openvino
    device: GPU

model:
  width: 300
  height: 300
  input_tensor: nhwc
  input_pixel_format: bgr
  path: /openvino-model/ssdlite_mobilenet_v2.xml
  labelmap_path: /openvino-model/coco_91cl_bkgr.txt

cameras:
  front_camera:
    ffmpeg:
      inputs:
        - path: rtsp://USER:PASS@CAMERA-IP:PORT/STREAM   # from your camera's app
          roles:
            - detect
            - record
    objects:
      track:
        - person
        - car

record:
  enabled: true
  retain:
    days: 7
    mode: motion
```

Save and let Frigate restart. The Live view should show the camera, and the logs should confirm the detector and hardware acceleration.

> [!NOTE]
> Example — the `preset-intel-qsv-h264` and OpenVINO blocks above are for Intel hardware. If you use a different detector (a Google Coral, an Nvidia GPU, or plain CPU) or a different camera codec, adjust these per docs.frigate.video.

> [!NOTE]
> Event and alert retention keys change between Frigate versions. For anything beyond this basic record block, follow docs.frigate.video for the version you installed.

## Store recordings on a NAS (optional)

### Point Frigate's storage at a larger drive
By default Frigate records to the container's own disk. To keep footage on a larger drive, mount a network share into the container and point Frigate's media path at it.

> [!TIP]
> Example — if you run TrueNAS, mount one of its shares into the Frigate container for recordings. Camera video eats space fast, so match the `days` retention above to your drive size; motion-only recording stretches it much further.

## Optional: connect to Home Assistant

### Add the Frigate integration
If you run Home Assistant, Frigate can surface its cameras and detections there for automations, such as triggering a light when a person is detected. Add the integration from Home Assistant once Frigate is running.

## Verify

### Confirm it is working
Check the Live view, open the logs to confirm hardware acceleration and the detector, then watch the Events page as motion and objects are detected.

> [!TIP]
> If the camera connects but detection is slow or CPU is high, the hardware-acceleration passthrough likely is not active. Re-check the render device on the container and that the logs show the detector, not a CPU fallback.
