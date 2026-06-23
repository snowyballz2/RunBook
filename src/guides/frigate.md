---
title: Frigate
subtitle: AI camera recording (NVR) on your own hardware
collection: Proxmox Home Server
order: 9
accent: azure
---

## Before you start

### Check your camera situation
Frigate needs at least one camera that speaks **RTSP** — without one, there is nothing to record, and this guide can wait until a camera arrives. Cameras that output **H.264 video and AAC audio** offer the most compatibility, and wired beats wireless: Frigate's docs are blunt that WiFi cameras' streams are less reliable and cause connection loss or lost video.

> [!DETAILS] Choosing a camera, if you're still shopping
> Frigate's hardware docs recommend restream-friendly brands in this order: **Dahua, Hikvision, Amcrest**. What matters most is that the camera offers *two* streams — a full-resolution main stream and a smaller substream — because Frigate uses them for different jobs: the substream is the only stream Frigate decodes for object detection, while the main stream is what gets recorded at full quality. Almost any wired PoE camera from those brands does this.

### Know what the iGPU is about to do
Back in the *Prep & BIOS* guide you enabled the Intel iGPU partly for this moment. It has two jobs here: hardware-decoding every camera stream (instead of burning CPU), and running the object detection itself via OpenVINO — no extra AI hardware needed.

> [!NOTE]
> Frigate's stated minimum is any Intel CPU with AVX and AVX2 instructions. Running detection *on the iGPU* via OpenVINO needs a 6th-generation (Skylake) or newer Intel platform — anything you'd build this collection on qualifies.

## Create the Frigate container

### Run the install script
The community-scripts helper builds a Frigate container in one go. In the Proxmox web interface, click your node, then **Shell**, and run:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/frigate.sh)"
```

Accept the defaults — **8 cores, 4 GB RAM, a 20 GB disk** on Debian 12 — and let it work; it compiles Frigate 0.17.1 from source, so expect this to take a while. Same habit as always: read the script before piping it into a root shell (the download-read-run habit from the *Install Proxmox* guide).

> [!WARNING]
> Two honest caveats. First, this script builds a **privileged** container — weaker isolation from the host than the unprivileged containers the *Containers* guide prefers. Second, Frigate's own docs say running it in an LXC is unsupported territory: Proxmox recommends application containers like Frigate run inside a QEMU VM, and "Frigate does not officially support running inside of an LXC." This path is popular and works well, but if something breaks oddly, the officially supported route is the one in the expandable below.

> [!TIP]
> This is the fussiest script in the collection — it downloads large AI components and occasionally stumbles partway. If it errors, just re-run it; needing a second attempt is normal.

> [!DETAILS] The officially supported way — Docker Compose in a VM
> Frigate's docs are explicit: "Running through Docker with Docker Compose is the recommended install method." Create a Debian VM (the *Virtual machines* guide covers when a VM is the right tool), install Docker, and use the official compose file — trimmed here to the Intel-iGPU case:
>
> ```yaml
> services:
>   frigate:
>     container_name: frigate
>     restart: unless-stopped
>     stop_grace_period: 30s
>     image: ghcr.io/blakeblackshear/frigate:stable
>     shm_size: "512mb"
>     devices:
>       - /dev/dri/renderD128:/dev/dri/renderD128
>     volumes:
>       - /etc/localtime:/etc/localtime:ro
>       - /path/to/your/config:/config
>       - /path/to/your/storage:/media/frigate
>       - type: tmpfs
>         target: /tmp/cache
>         tmpfs:
>           size: 1000000000
>     ports:
>       - "8971:8971"
>       - "8554:8554"
>       - "8555:8555/tcp"
>       - "8555:8555/udp"
> ```
>
> The official example also sets `privileged: true` with a note that it "may not be necessary for all setups", and includes extra device lines for Corals and other hardware. The default 128 MB `shm_size` is fine for two cameras detecting at 720p; the docs give a per-camera formula for more. On this path the web UI lives on port **8971** — the authenticated one. If you go this way, the iGPU passthrough below happens at the VM level instead (PCIe passthrough of the iGPU to the VM), which is a deeper rabbit hole — one reason the LXC path stays the default here.

### Open the web UI
The script prints the container's address when it finishes — browse to it on port **5000** (lose it later? Your router's client list or the container's **Summary** tab in Proxmox both have it). You should see Frigate running with a single `test` camera looping a sample clip — proof the install works before any real camera exists.

> [!WARNING]
> This install serves the UI on port 5000 with **no login** — the generated config ships with authentication disabled, and in Frigate's own port scheme 5000 is the "internal unauthenticated" port whose access "should be limited." That is tolerable on a home LAN behind your router, but never create a port-forward to it. Your cameras' footage should stay on your network.

## Give it the iGPU

### Confirm the iGPU made it inside
The script passes the host's GPU devices into the container by default, so this is usually just a check. Open the container's **Console** and look for the render node:

```bash
ls -l /dev/dri
```

You want to see `renderD128`. If it's there, move on.

> [!DETAILS] Adding the passthrough by hand
> If `/dev/dri` is empty, Proxmox can pass the device through from the web UI (Proxmox 8.2 and later; the CLI has had it since 8.1). Logged in as **root@pam** — the menu item is greyed out otherwise — select the container, then **Resources → Add → Device Passthrough**, and set **Device Path** to `/dev/dri/renderD128`. For this privileged, root-run container the default access mode is fine; for an *unprivileged* container you would set **Access Mode in CT** to `0666`, or set **GID in CT** to `104` (the render group on Debian). Restart the container and check `/dev/dri` again.

### Set the decode preset
The installer writes `hwaccel_args: auto` into the config, which may already work. To pin it explicitly to the iGPU, edit `/config/config.yml` — easiest in the web UI's **built-in config editor**, which validates as you type; `nano /config/config.yml` in the container's console works too — and set:

```yaml
ffmpeg:
  hwaccel_args: preset-vaapi
```

> [!NOTE]
> Frigate's docs recommend `preset-vaapi` for 1st- through 12th-generation Intel iGPUs — it auto-selects the right profile for both H.264 and H.265 streams. On 13th-gen and newer (or an Intel Arc card), the recommended presets are `preset-intel-qsv-h264` or `preset-intel-qsv-h265`, one per codec — there is no plain `preset-intel-qsv`.

### Switch detection to the iGPU
The installer probes your CPU and, if it qualifies, already writes an OpenVINO detector into the config — check `/config/config.yml` before adding a duplicate. The docs' minimal config for detection on the iGPU is:

```yaml
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
```

The `model:` block is not optional: unlike the CPU and Coral detector types, OpenVINO has no built-in default model path, so without it detection fails to start. The model files themselves (Intel's SSDLite MobileNet V2) ship inside Frigate at that `/openvino-model/` path — the installer's generated config already includes this block, so the rule is simply: **keep it**.

> [!NOTE]
> This is the docs' mainline path now, not a compromise: an Intel HD 620 runs the default model in 15–25 ms and an Iris Xe in roughly 10 ms — Coral-class speeds with zero extra hardware. Even with no usable GPU, the docs note OpenVINO in CPU mode is often more efficient than the plain CPU detector. One rule: detector types can't be mixed — pick one.

> [!DETAILS] The classic alternative — a USB Coral
> The Google Coral USB accelerator was the standard Frigate answer for years, and the hardware docs now say plainly: "The Coral is no longer recommended for new Frigate installations," except for very low-power builds or hardware that can't run an alternative. If you already own one, it still works well — the script even installs the Coral runtime. The detector config is:
>
> ```yaml
> detectors:
>   coral:
>     type: edgetpu
>     device: usb
> ```
>
> You will also need to hand the USB device itself through to the container, which is its own fiddle — another reason the iGPU path is the default here.

## Add your first camera

### Describe your camera in the config
Replace the test camera in `/config/config.yml` with your real one — substream for detection, main stream for recording, MQTT off for now (Frigate runs fine standalone without it):

```yaml
mqtt:
  enabled: false

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

ffmpeg:
  hwaccel_args: preset-vaapi

cameras:
  driveway:
    ffmpeg:
      inputs:
        - path: rtsp://user:pass@192.168.1.42:554/main   # full-res main stream
          roles:
            - record
        - path: rtsp://user:pass@192.168.1.42:554/sub    # low-res substream
          roles:
            - detect
    detect:
      enabled: true
    record:
      enabled: true
```

Swap in your camera's IP, credentials, and real RTSP paths — take them from the camera's app or manual rather than guessing; every brand spells them differently.

> [!NOTE]
> Don't reach for a high-resolution detect stream: the frames get resized down to the detection model's small input anyway, so extra detail is simply lost. The docs' example detect stream is 1280x720 at 5 fps — 5 fps is the recommended rate, and 10 fps the recommended maximum for most users.
>
> Frigate tracks `person` by default. To watch for more, add an `objects:` block to a camera with a `track:` list — `car`, `dog`, `cat`, and friends.

> [!DETAILS] Sharing one camera connection with go2rtc
> Some cameras only allow one active connection, and even good ones appreciate fewer. Frigate bundles **go2rtc** for exactly this: one connection goes to the camera, and Frigate's `detect` and `record` consume the local restream instead. The docs' pattern:
>
> ```yaml
> go2rtc:
>   streams:
>     driveway:
>       - rtsp://user:pass@192.168.1.42:554/main
>       - "ffmpeg:driveway#audio=opus"
>
> cameras:
>   driveway:
>     ffmpeg:
>       output_args:
>         record: preset-record-generic-audio-copy
>       inputs:
>         - path: rtsp://127.0.0.1:8554/driveway
>           input_args: preset-rtsp-restream
>           roles:
>             - record
>             - detect
> ```
>
> go2rtc is also what powers Frigate's live view and restreaming on port 8554, so this pattern pays off beyond connection counting.

### Restart and watch it detect
Apply the config by restarting Frigate in the container's console:

```bash
systemctl restart frigate
```

Reload the web UI: your camera's live view should appear, and walking through the frame should produce a tracked person within a few seconds.

> [!TIP]
> If the camera stays black, watch the logs while it starts: `journalctl -u frigate -f` in the container's console. A wrong RTSP path or password shows up there immediately. And if detection feels sluggish or the CPU is pinned, the iGPU probably isn't doing the work — re-check the `/dev/dri` passthrough and confirm the logs name the OpenVINO detector, not a CPU fallback.

## Add a video doorbell

A doorbell is the camera most people actually want, and the local-first pick is the **Reolink Video Doorbell** (the WiFi model runs off your existing doorbell transformer — see the camera notes at the top). But it doesn't behave like a plain RTSP camera, so it gets its own walkthrough. The worked example below is that doorbell; the same pattern applies to other Reolink models.

### Understand why a doorbell is different
On Reolink doorbells, plain RTSP video is **less reliable** — it drops and stutters — while video carried over **http-flv** (video over HTTP) is steady. But the two-way talk audio only rides on RTSP. So the trick is to pull *video* over http-flv for stability and add a *secondary RTSP stream just for the audio*, then let Frigate's built-in **go2rtc** (the restreamer from the last section) fuse them into one feed it can record, detect on, and talk back through.

### Prepare the doorbell in the Reolink app
In the doorbell's advanced network settings, **enable HTTP and RTSP** and set a username and password. If the options exist, set the bitrate to **"On, fluency first"** (that's constant bitrate, which Frigate prefers) and the **Interframe Space to 1×** (an I-frame interval matching the frame rate). Pin the doorbell's IP with a DHCP reservation while you're at it (the *AdGuard Home* habit), so the config below never goes stale.

> [!INPUT] doorbell-ip | Doorbell IP

> [!INPUT] doorbell-user | Doorbell username

> [!SECRET] doorbell-password | Doorbell password
> The login you just set in the Reolink app — it goes into the `USER` / `PASS` slots of the config below.

> [!WARNING]
> Take the exact stream details from the Reolink app — don't guess them. In particular confirm **HTTP is enabled**, or the http-flv video path won't connect at all.

### Add the doorbell to your config
Add the doorbell's streams to a `go2rtc` block, then point a `doorbell` camera at the local restream. Swap in your `DOORBELL-IP`, `USER`, and `PASS`:

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
> Reading the odd parts: `channel0_main.bcs` is the full-resolution stream (recorded) and `channel0_ext.bcs` is the low-res sub stream (analyzed) — splitting them spares both the doorbell and your CPU. The trailing `#video=copy#audio=copy#audio=opus` is deliberate, not a typo: it passes the video through untouched, keeps the original audio for recording, *and* adds a second Opus audio track that the browser's live view needs. The bare `rtsp://…/Preview_01_sub` line is the two-way-audio path, and it must **not** carry an `ffmpeg:` prefix — go2rtc has to handle that stream directly for talk-back to work. The `live: streams:` block binds the live view (and its talk button) to that full `doorbell` stream rather than the detect substream.

### Talk back through it
To speak through the doorbell from the Frigate or Home Assistant live view, the page has to be served over **HTTPS** — browsers only allow microphone access on a secure connection (you may need Frigate's port `8971`). This is one more place the *Reverse Proxy* guide's real certificate earns its keep.

> [!TIP]
> Don't care about talking back? Drop the secondary `rtsp://…Preview_01_sub` line entirely and keep just the http-flv video. That's the simplest, most reliable doorbell setup — you still get full recording and person/package detection.

### Mind the stream count
Reolink doorbells have limited streaming capacity and dislike many simultaneous connections. Detecting on the sub stream, as above, keeps the load light. If you later add Reolink's own *Home Assistant* integration, that's another connection — running everything at once can cause dropouts, so add one thing at a time and watch the logs.

## Wire it into the build

### Set retention before the disk fills
Out of the box Frigate keeps video of tracked objects (alerts and detections) for **10 days**, and continuous recording is **off** — the continuous-retention default is 0 days. To keep a rolling window of everything, set it explicitly:

```yaml
record:
  enabled: true
  continuous:
    days: 7
```

Restart Frigate to apply (`systemctl restart frigate` — every config change needs one). A lighter middle ground: use `motion:` with a `days:` value instead of `continuous:` to keep only the stretches where something moved.

> [!WARNING]
> The container's default 20 GB disk will not survive continuous recording for long — even one camera fills it quickly. Frigate has a safety valve (when less than an hour of space remains, it deletes the oldest hour of recordings), but the real fix is more space: grow the container's disk, or point recordings at bulk storage. The official docs give no per-camera sizing figure, so watch your actual usage for a few days and size from that.

> [!DETAILS] Putting recordings on TrueNAS
> Everything Frigate records lives under `/media/frigate` inside the container — `recordings`, `clips` (snapshots), and `exports`. The recordings folder structure (`YYYY-MM-DD/HH/<camera>/MM.SS.mp4`, in UTC) is managed entirely by Frigate and isn't meant to be browsed or pruned by hand. If you built the *TrueNAS* guide, the usual Proxmox pattern is to mount a share from it on the Proxmox host and hand that to the container as a mount point at `/media/frigate` — then retention math happens against terabytes instead of a 20 GB virtual disk. Get the basic setup working on local disk first; move storage second.

### Connect Home Assistant
Two pieces, per Frigate's docs: a shared **MQTT broker** the two can talk over, and the **Frigate integration** installed in your *Home Assistant OS* VM. With the broker running (first expandable), point Frigate at it and restart:

```yaml
mqtt:
  enabled: true
  host: 192.168.1.51        # your Home Assistant VM's IP
  user: mqtt-user
  password: your-mqtt-password
```

> [!INPUT] mqtt-user | MQTT username | | mqtt-user
> The dedicated Home Assistant user Frigate logs in as (first expandable below) — `mqtt-user` matches the config example; edit if you named yours differently.

> [!SECRET] mqtt-password | MQTT password

> [!DETAILS] Setting up the broker side in Home Assistant
> The broker everyone uses is **Mosquitto**, run as a Home Assistant App (Apps being the new name for add-ons): in Home Assistant, **Settings → Apps → App Store**, install **Mosquitto broker**, and start it. Create a dedicated Home Assistant user (e.g. `mqtt-user`) for Frigate to log in as — Mosquitto accepts any HA user's credentials. Home Assistant's own **MQTT integration** is then offered automatically under **Settings → Devices & services**; accept it. Those are the host/user/password values Frigate's config above needs.

> [!DETAILS] What HACS is, and installing the integration
> The Frigate integration doesn't live in Home Assistant's built-in integration list — it's distributed through **HACS** (Home Assistant Community Store), a widely-used community add-on catalog that itself has to be installed once. Follow the official install steps at [hacs.xyz](https://hacs.xyz/docs/use/) (it walks you through adding it as an App and signing in with GitHub), restart Home Assistant, then open **HACS**, search for **Frigate**, download it, restart Home Assistant again, and add the Frigate integration under **Settings → Devices & services** — it asks for Frigate's address (`http://frigate-ip:5000`).

> [!NOTE]
> What you get: a live camera entity per camera, an *occupancy* binary sensor per camera per tracked object (on while a person is in frame — automation fuel), sensors for object counts and performance, switches to toggle detection, recordings, and snapshots, a motion binary sensor per camera and zone, and your recordings browsable in Home Assistant's media browser.

> [!DETAILS] About the "Frigate App" you'll see in Home Assistant
> Home Assistant also offers Frigate as an App — that route runs Frigate *inside* the HAOS VM instead of in its own container, and carries documented limits there (separate local storage for media isn't supported, and HAOS lacks drivers for some accelerators). Since yours already runs in its own container with the iGPU, skip the App entirely; the HACS integration is the only piece you need on the Home Assistant side.

### Pin its address and start it at boot
Give the Frigate container a fixed IP via your router's DHCP reservation page — the same habit the *AdGuard Home* guide established — so Home Assistant and your bookmarks never lose it. Then, in Proxmox, select the container, open **Options**, and enable **Start at boot**, so a power cut doesn't silently end your recordings.

> [!INPUT] frigate-ip | Frigate container IP

> [!NOTE]
> One quirk of this install to remember at upgrade time: the script builds Frigate 0.17.1 natively and does not update in place — its own update path says to create a new container and transfer your configuration. When a new Frigate version tempts you, take a snapshot first (the snapshot habit from the *Containers* guide), build the new container, and copy `/config` across.
