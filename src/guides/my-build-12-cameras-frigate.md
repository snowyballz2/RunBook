---
title: Cameras, Doorbell & Frigate
subtitle: Frigate NVR with detection on the 1080 Ti — the Reolink doorbell, four EmpireTech turrets, and two indoor cameras
collection: My Build
order: 12
accent: spruce
---

Frigate is the camera recorder (an NVR — network video recorder) that turns your cameras — the EmpireTech perimeter turrets, the two indoor cameras, and the Reolink doorbell — into searchable, object-aware footage on hardware you own. On this build it runs as its own container, hardware-decodes the camera streams, and runs object detection on the **EVGA GTX 1080 Ti** whose driver was set up on the host earlier and is shared from there into containers — no cloud, no subscription, no Coral. This page builds the container, points detection at the 1080 Ti via ONNX/CUDA, adds the black 4:3 Reolink doorbell and the WiFi RLC-510WA over go2rtc, wires in the five EmpireTech PoE cameras — the four perimeter turrets and the full-colour indoor — and lands recordings on the dedicated footage drive.

## Create the Frigate container

### Run the install script
Frigate runs as a privileged **LXC (Linux Container)** here. The community-scripts helper builds one in a single pass. In the Proxmox web interface, click the node, then **Shell**, and run:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/frigate.sh)"
```

On the **Community-Scripts Options** menu (**Default Install**, **Advanced Install**, **User Defaults** — an **App Defaults** entry joins once these pages start saving defaults) pick **Advanced Install** — it is a long walk of dialogs, and these are the build's answers, in the order they appear:

- **TELEMETRY & DIAGNOSTICS** — appears **before** the menu, and only on the host's first community-script run; **decline** — nothing in this build phones home.
- **Container type** — **Privileged**, as offered for Frigate; the GPU lend below depends on it.
- **Set Root Password** — set one, and record it in the field below (a **Verify Root Password** box repeats it). Leaving it blank means automatic login with **no password at all**, which a privileged container holding every camera feed does not get on this build.
- **Container ID** — accept the offered next-free number. This is the `<frigate-ctid>` the GPU step edits by ID.
- **Hostname** — keep `frigate`.
- **Disk / CPU / RAM** — keep the offers: **20 GB, 8 cores, 4096 MiB**.
- **Network bridge** — `vmbr0`.
- **IPv4** — **Static (manual entry)**: address `192.168.1.52/24`, gateway `192.168.1.1`. The address lives in the protected `.2–.99` static zone, where the router could not reserve it — never DHCP.
- **IPv6** — **Fully Disabled**; this LAN runs IPv4 and nothing in the container uses v6.
- **MTU, DNS search domain, DNS server, MAC address, VLAN** — leave every one blank; blank inherits the host's settings, which are right.
- **Tags** — keep the offered tag.
- **SSH KEY SOURCE** — "Provision SSH keys for root:" — **none / No keys**. It may offer keys detected on the host or a paste box; skip them all, since root SSH stays off in the next dialog.
- **SSH ACCESS** — "Enable root SSH access?" — **No**, the dialog's own default; the container's **Console** in Proxmox covers every shell this page needs.
- **FUSE** — **No** (it exists for rclone/mergerfs-style mounts; nothing here uses them).
- **TUN/TAP** — **No**; Tailscale runs on the Proxmox host, not in this container.
- **NESTING SUPPORT** — **Yes**, the offered default. The script's own warning: Debian 13's systemd can start degraded without it, with services failing on error 243.
- **GPU PASSTHROUGH** — **Yes**, the offered default for Frigate. This detects the 1080 Ti and writes the NVIDIA device lines into the container's config **itself** — it is why the *Lend the GPU* step below verifies rather than edits. The in-container driver install there still applies.
- **KEYCTL SUPPORT** — **No**, the default. It exists for Docker and systemd-networkd workloads; this container runs neither.
- **APT CACHER PROXY, HTTP/HTTPS PROXY, HOST CA INHERITANCE** — **No / blank**, all three; this LAN has no apt cache, no proxy, and no private CA.
- **CONTAINER TIMEZONE** — leave it as offered; empty inherits the host's, which is right.
- **CONTAINER PROTECTION** — **Yes**, against the dialog's default of No. It only blocks *deleting* the container — snapshots, backups, and reboots are untouched, and at the rebuild-style upgrade this page describes you untick it once, on purpose. What it buys: the hand-built `config.yml` below cannot be lost to a stray Destroy click.
- **DEVICE NODE CREATION** — **No**, the default. Frigate creates no device nodes — the `/dev/nvidia*` nodes it needs are bound in from the host by the GPU passthrough above, a different mechanism — and the script itself flags mknod experimental.
- **MOUNT FILESYSTEMS** — leave **empty**. The footage disk arrives on this page later as a **host-side mount point**, not as something the container mounts for itself.
- **POST-INSTALL HOOK (HOST)** — leave **empty**.
- **VERBOSE MODE** — **No**. Review the **CONFIRM SETTINGS** summary and press **Create LXC**.
- **Which storage pool?** — two radiolists (container, then template), shown only when more than one pool qualifies; this host's stock local/local-lvm split auto-selects silently. If asked: **local-lvm** for the container, **local** for the template.
- **Save advanced settings as default?** — **Yes**. It writes tonight's answers to `/usr/local/community-scripts/defaults/frigate.vars` on the host — the root password is **not** among them — so the rebuild-style upgrade this page describes later replays them as presets instead of re-asking everything. If an answer ever changes, edit or delete that file.
- **"An update for the Proxmox LXC stack is available"** — **Ignore** (numbered **2**, or **3** in the four-option variant). Option 1 runs a blanket `apt upgrade` on the **host** from inside an install script — and this host's pinned 6.14 kernel (the NVIDIA situation from the GPU/HBA page) makes host upgrades a deliberate, eyes-open job for the Maintenance page, never a script's side effect. What it is offering is a minor `pve-container` point release; nothing this install needs.

Then let it work — it compiles Frigate from source, so expect a long run. Read the script before piping it into a root shell, the same download-read-run habit used for every helper in this build.

> [!INPUT] frigate-console-user | Frigate console username | | root
> Every Proxmox container console logs in as `root` — saved here so you never have to remember that.

> [!SECRET] frigate-root | Frigate container root password
> Set at the install script's **Set Root Password** prompt. Pairs with the `root` username above at the container's **Console** in Proxmox; SSH stays off.

> [!TIP]
> The console's `login:` prompt **echoes what you type**; only the `Password:` prompt hides it. Type the password at the wrong prompt and it sits in cleartext in the scrollback — if that happens, rotate it on the spot: `passwd` at the root prompt, then update the field above.

> [!TIP]
> This is the fussiest script in the build — it pulls large AI components and occasionally stumbles partway. If it errors, just re-run it; a second attempt is normal.

> [!WARNING]
> The script builds a **privileged** container, which has weaker isolation from the host than an unprivileged one, and Frigate's own docs note that running in an LXC is community territory rather than officially supported. This path is popular and works well on this hardware, but the officially supported route is Docker Compose inside a VM (virtual machine). The LXC is chosen here so the container can share the host's GPU directly — the whole reason detection runs on the 1080 Ti instead of an Intel iGPU.

### Open the web UI
The script prints the container's address when it finishes — browse to **`http://192.168.1.52:5000`**. Expect the **Config Editor (Safe Mode)**, not a dashboard: Frigate 0.17 requires the `mqtt` and `cameras` fields, the generated config has neither, and validation fails with *"mqtt - Field required… cameras - Field required."* That is the install working, not broken — 0.17 also ships no sample camera, so there is no test clip to look for. Escape safe mode with Frigate's own documented minimal blocks. The config is **YAML** — an indentation-based text format where the leading spaces are meaningful — and this page treats it one way throughout: **every config step gives the complete file as it should exist at that moment.** Select everything in the editor, delete it, paste the block, swap any password tokens it names, **Save & Restart**. No merging, no hunting for changed lines. Here, the whole file becomes:

```yaml
ffmpeg:
  hwaccel_args: auto
detectors:
  detector01:
    type: openvino
    device: AUTO
model:
  width: 300
  height: 300
  input_tensor: nhwc
  input_pixel_format: bgr
  path: /openvino-model/ssdlite_mobilenet_v2.xml
  labelmap_path: /openvino-model/coco_91cl_bkgr.txt
version: 0.17-0
mqtt:
  enabled: false
cameras:
  placeholder:
    enabled: false
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:554/rtsp
          roles:
            - detect
```

No tokens to swap in this one — the top half is the script's own generated config kept as-is, with the two missing required blocks added beneath.

The `placeholder` camera exists only to satisfy validation and stays disabled — the doorbell replaces it later on this page, and the MQTT section at the end swaps the `mqtt` block for the real broker. The red *Field required* errors disappear and, after the restart, the actual UI appears on 5000. If the editor complains about what you pasted, the indentation got mangled — delete the pasted lines and paste again. Day-to-day browsing happens at **`https://192.168.1.52:8971`** instead (expect a self-signed certificate warning — the container mints its own); the next step recovers the login that guards it.

### Recover the admin password and make it yours
With **no `auth:` block** in the config — which is what the script generated — Frigate's authentication defaults **on**, so `https://192.168.1.52:8971` is already demanding a login nobody typed. Frigate minted an **`admin`** user with a random password on startup and printed it **once** to its log. Read it in the container's **Console**:

```bash
grep -i password /dev/shm/logs/frigate/current
```

Log in at `https://192.168.1.52:8971` as **`admin`** with that password, open **Settings → Users**, and replace it with a password of your own. Record it below.

> [!INPUT] frigate-admin-user | Frigate UI username | | admin
> Frigate names its first user `admin`; it is not configurable at creation.

> [!SECRET] frigate-admin | Frigate admin password (https://192.168.1.52:8971)
> The password you set in **Settings → Users** — not the throwaway one from the log.

> [!TIP]
> **No password line?** Frigate prints it once, at admin creation on the very first boot — the safe-mode escape's restarts can leave the current log without it. First widen the search to rotated files: `grep -ri password /dev/shm/logs/`. Still nothing? Have Frigate mint a fresh one — in the config editor on **port 5000** (the one that needs no login, which is the point while you are locked out of 8971), paste at the end:
>
> ```yaml
> auth:
>   reset_admin_password: true
> ```
>
> **Save & Restart**, grep again, log in — then **delete those two lines and Save & Restart once more** (in the same 5000 editor, or 8971's now that you can log in; both edit the same file), or the password resets on every boot.

### Fence the open port
Port **5000** never gets a login — it is Frigate's internal unauthenticated port, and the login on 8971 protects nothing while it stays LAN-open: the same config editor you just used to reset the admin password is sitting there for anyone on the network, cameras included, and disabling auth outright is one edit away. Frigate's official Docker deployment never exposes 5000 beyond the container's private network; this LXC does, so build the fence Docker would have provided. Proxmox's per-guest firewall is the tool, and the order below stages everything before the master switch flips, so nothing breaks partway.

All the typing lands in one paste. In the **Proxmox host Shell** (node `pve` → **Shell** — not the container's console), write the container's entire ruleset, switches included (`102` is this container's ID, the number beside its name; safe to run even if you began clicking rules in — it replaces them with exactly these):

```bash
cat > /etc/pve/firewall/102.fw <<'EOF'
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT

[RULES]
IN ACCEPT -p tcp -dport 8971
IN ACCEPT -source 192.168.1.51 -p tcp -dport 5000
IN ACCEPT -source 192.168.1.57 -p tcp -dport 5000
IN ACCEPT -source 192.168.1.51 -p tcp -dport 8554,8555
IN ACCEPT -source 192.168.1.51 -p udp -dport 8555
IN ACCEPT -p icmp
EOF
```

Line by line: `8971` stays open to the LAN — the authenticated UI, for you. `5000` opens only to Home Assistant (`.51`, the integration below) and Uptime Kuma (`.57`, health checks later in the build). go2rtc's restream and WebRTC (`8554`, `8555`, plus WebRTC's UDP half) go only to Home Assistant, since browsers ride 8971's proxy. `icmp` keeps the container answering pings. The `[OPTIONS]` block is the guest's own switches: firewall on, inbound drop-by-default, outbound open.

The file sits inert until the master switch flips. The rest is clicks:

1. **CT 102 → Firewall** — the six rules now show in the list. That is the file being read, and your check that the paste took.
2. Select container **102** in the left tree and open **Network** in its menu (between Resources and DNS). The panel lists one row, **`net0`** — the container's network card. Double-click it, tick **Firewall**, **OK**.
3. **Node `pve` → Firewall → Add** — Direction `in`, Action `ACCEPT`, Protocol `icmp`, everything else blank — and **tick Enable** before clicking Add: the dialog adds rules *disabled* by default, and an unticked rule exists but does nothing. This keeps the host answering pings under the datacenter policy. (The container's six rules have no such problem — file-written rules arrive enabled.)
4. **Datacenter** — the very top of the left-hand tree, above the `pve` node — **→ Firewall → Options**, double-click the **Firewall** row and set it to **Yes**. This is the master switch. Proxmox auto-allows the web UI (8006) and SSH from the local network even under DROP, so this cannot lock you out; TrueNAS and Home Assistant are untouched because their own guest firewalls stay off.
5. Prove it: `https://192.168.1.52:8971` still loads; `http://192.168.1.52:5000` from your Mac now **times out**. That timeout is the fence working — the unauthenticated editor now answers only to Home Assistant, Kuma, and the console.

> [!WARNING]
> Never create a port-forward to any of this regardless — camera footage stays on the network, and remote access comes through Tailscale.

> [!NOTE]
> Script versions vary: some instead write an explicit `auth: enabled: false` into the generated config, which switches the login off entirely — 8971 included, every camera open to the LAN. If your config shows that line, flip it to `true` in the config editor, **Save & Restart** (`systemctl restart frigate` in the container's **Console** does the same), then read the log as above.

### Confirm its address and start at boot
The static address was set in the script's Advanced walk, so there is nothing to reserve at the router. In Proxmox, select the container and open **Options**:

- **Start at boot** → **Yes** — a power cut must not silently end recordings
- **Start/Shutdown order** → **3** — the MQTT broker this page connects to later lives in the Home Assistant VM (order=2), and Frigate must come up after it
- **Protection** → **Yes**, if the install dialog's **CONTAINER PROTECTION** was answered No

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52
> Device-set static from the script's Advanced mode — in the `.2–.99` static zone, so it never moves.

## Detect on the 1080 Ti

### Lend the GPU into the container
The 1080 Ti is **shared** into this LXC from the host's NVIDIA driver — it is never VFIO (Virtual Function I/O)'d to a VM. Answering **Yes** at the install script's **GPU PASSTHROUGH** dialog already bound the card in: the script found every `/dev/nvidia*` node the host driver exposes and wrote a `devN:` line for each into the container's config. Verify rather than re-do it. On the host (click the Proxmox node, then **Shell**):

```bash
grep ^dev /etc/pve/lxc/102.conf
```

(`102` is this container's ID, shown next to its name in the sidebar.) Expect several `devN: /dev/nvidia…,gid=44` lines — the script binds every NVIDIA node it finds, a superset of the three the GPU Sharing & HBA Passthrough page's lending recipe names, which is fine. Only if the list comes back **empty** — the dialog answered No, or a container built before it existed — fall back to that recipe: edit the same file, add the three lines below, and restart the container.

```ini
dev0: /dev/nvidia0,gid=44
dev1: /dev/nvidiactl,gid=44
dev2: /dev/nvidia-uvm,gid=44
```

The script also attempts the **in-container userspace driver** itself — its output shows `NVIDIA GPU passthrough detected`, and on this build a `Version-pinned install failed - trying unpinned` fallback, which lands whatever version its source offers rather than the host's. One command in the container's **Console** settles whether it matched:

```bash
nvidia-smi
```

If it prints the GTX 1080 Ti, the script's driver matches the host's kernel module and the driver step is **done** — skip ahead to fetching the model. Two failure shapes share one fix: **`-bash: nvidia-smi: command not found`** means the script's attempt installed nothing at all (the observed outcome on this build — the unpinned fallback failed too, quietly), and **`Failed to initialize NVML: Driver/library version mismatch`** means it landed the wrong version. Either way, install the **same version the host's `nvidia-smi` reports**, recorded on the GPU/HBA page:

> [!INPUT] nvidia-driver-version | Host NVIDIA driver version | 550.163.01

Trust the field, not memory. First see whether the script's attempt arrived through `apt`:

```bash
apt list --installed 2>/dev/null | grep -i nvidia
```

Purge anything it lists, so the two installs do not fight — and expect it **not** to be empty even after a `command not found`: on this build the fallback had sideloaded six library packages at `610.57.04` (marked `[installed,local]`) against the host's `550.163.01` kernel module, a whole generation apart, without ever putting a working `nvidia-smi` on the PATH. That night's purge, for reference:

```bash
apt purge -y libnvidia-encode1 libnvidia-gpucomp libnvidia-ml1 libnvidia-pkcs11-openssl3 libnvidia-ptxjitcompiler1 nvidia-smi
```

Match the package names to what *your* list shows — the script's set can drift. Then, in the **container's console**, download NVIDIA's installer for the exact host version and run it userspace-only. The first command uses `wget` — the standard command-line downloader ("web get"), which saves the file at that URL into the current folder (`apt install -y wget` first if the container lacks it); the second runs the ~300 MB installer it fetched. With the host on `550.163.01`:

```bash
wget https://us.download.nvidia.com/XFree86/Linux-x86_64/550.163.01/NVIDIA-Linux-x86_64-550.163.01.run
sh NVIDIA-Linux-x86_64-550.163.01.run --no-kernel-module
```

The installer walks a few text dialogs — accept the license, **No** to the 32-bit compatibility libraries, accept the rest as offered. Two blue **WARNING** dialogs appear, and both are expected. The first — it "will not install any kernel modules", matching modules must be "installed separately" — is `--no-kernel-module` doing its job: the kernel half lives on the host at exactly this version, from the GPU/HBA page. The second — it "was forced to guess the X library path" — is about X, the Linux desktop display system, which this headless container does not have and never needs; Frigate reaches the card through CUDA, not a screen. **OK** through both, and answer **No** (the offered default) to running `nvidia-xconfig` at the end — same theme, it writes a desktop X config for a desktop that does not exist.

If a host upgrade ever bumps the driver, swap the new version into both lines — the URL follows that pattern for any version. The kernel module lives on the host, so only the libraries install inside; the host-side "never a `.run`" rule is about kernel modules and does not apply in an LXC.

### Confirm the GPU made it into the container
Confirm the card is visible from inside the container. Open the container's **Console** and run:

```bash
nvidia-smi
```

You should see the GTX 1080 Ti listed with a driver version. If the command is missing or the card is absent, the share did not take — recheck the `dev0:` lines in the container's config on the host and that the in-container userspace driver matches the host's version exactly.

> [!WARNING]
> The card is shared across containers, not handed to one guest — Frigate detection now, the Ollama LLM (large language model) and faster-whisper STT (speech-to-text) voice stack later. Keep `nvidia-persistenced` enabled on the host and the host/in-container driver versions matched. VFIO is reserved for the HBA (host bus adapter) feeding the TrueNAS VM; the GPU stays shared. The moment the GPU is VFIO-bound, every container loses detection at once.

### Fetch the detection model
Frigate does not bundle YOLO models — the file the config below points at has to be produced once, by you. This is the one step that runs on **your desk computer**, because it needs Docker and nothing in the server stack has it: install **Docker Desktop** (docker.com, free for this) on the Mac or the Windows PC. Its first-run flow: **Accept** the service agreement (the free tier covers personal use), choose **Use recommended settings** when asked (it wants your computer's login password for its helper — the OS asking, not Docker's account), **Skip** the Docker sign-in (no account needed), skip any survey, and if macOS asks whether Docker may *find devices on local networks*, **Don't Allow** — this job only reaches the internet. Then open a terminal — the Mac's Terminal, or on Windows the **WSL** shell Docker Desktop sets up, since the command below is bash syntax. Then run this — one command, ending at the `EOF` line. It is Frigate's own published recipe with one word corrected: their command asks for `onnx-simplifier`, a package since renamed **`onnxsim`**, and on an Apple Silicon Mac (no prebuilt wheel, so the installer builds from source and checks the metadata) the old name fails with *"Package metadata name `onnxsim` does not match given name `onnx-simplifier`."* The corrected name works everywhere; expect step 7 to spend a few minutes compiling on Apple Silicon:

```bash
docker build . --build-arg MODEL_SIZE=t --build-arg IMG_SIZE=320 --output . -f- <<'EOF'
FROM python:3.11 AS build
RUN apt-get update && apt-get install --no-install-recommends -y cmake libgl1 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.10.4 /uv /bin/
WORKDIR /yolov9
ADD https://github.com/WongKinYiu/yolov9.git .
RUN uv pip install --system -r requirements.txt
RUN uv pip install --system onnx==1.18.0 onnxruntime onnxsim==0.4.* onnxscript
ARG MODEL_SIZE
ARG IMG_SIZE
ADD https://github.com/WongKinYiu/yolov9/releases/download/v0.1/yolov9-${MODEL_SIZE}-converted.pt yolov9-${MODEL_SIZE}.pt
RUN sed -i "s/ckpt = torch.load(attempt_download(w), map_location='cpu')/ckpt = torch.load(attempt_download(w), map_location='cpu', weights_only=False)/g" models/experimental.py
RUN python3 export.py --weights ./yolov9-${MODEL_SIZE}.pt --imgsz ${IMG_SIZE} --simplify --include onnx
FROM scratch
ARG MODEL_SIZE
ARG IMG_SIZE
COPY --from=build /yolov9/yolov9-${MODEL_SIZE}.onnx /yolov9-${MODEL_SIZE}-${IMG_SIZE}.onnx
EOF
```

It leaves **`yolov9-t-320.onnx`** in the folder you ran it from. Move it to the server in two hops. From that same terminal, copy it to the Proxmox host:

```bash
scp yolov9-t-320.onnx root@192.168.1.50:/tmp/
```

First run it asks about the host's authenticity — type `yes` — then wants the **Proxmox root password** from the field on the Install Proxmox page.

Then, in the **Proxmox host shell**, push it into the container under the name the config expects:

```bash
pct exec 102 -- mkdir -p /config/model_cache
pct push 102 /tmp/yolov9-t-320.onnx /config/model_cache/yolov9-t.onnx
```

Without this file, detection fails to start with a missing-model error.

### Point detection at ONNX on CUDA
This build does **not** use the Intel iGPU + OpenVINO path that Frigate defaults to. Detection runs on the 1080 Ti via the **ONNX (Open Neural Network Exchange) detector on the CUDA (NVIDIA's GPU compute platform) execution provider** — this install's Frigate build ships the ONNX runtime, which picks up CUDA automatically once the card is visible, so pointing Frigate at ONNX is enough to find the card. The `detectors:` and `model:` blocks below replace the script's OpenVINO versions, and the decode preset in the next step touches the same file — so both land in **one complete-file paste there**, one Save & Restart for the pair.

> [!NOTE]
> The 1080 Ti is Pascal — compute capability 6.1 — which clears every requirement: compute capability 5.0 or higher, NVIDIA driver 545 or newer, and CUDA 12.x. Use a **YOLOv9** model (the small `yolov9-t` is a good starting point); avoid RF-DETR, which runs very slowly on Pascal cards. One rule that never relaxes: **detector types cannot be mixed** — an `onnx` detector here means no `openvino` or `edgetpu` block alongside it. And keep the `labelmap_path` line: a YOLOv9 export emits the **80-class** COCO list, so without it Frigate falls back to its 90-class default and mislabels every class past the first few — your tracked `dog` comes through as `cat`.

### Set the decode preset
Frigate also hardware-decodes every camera stream so the CPU is not burning cycles unpacking video — `hwaccel_args: preset-nvidia` selects NVDEC on the card, replacing the generated `auto`. In the config editor at `https://192.168.1.52:8971` (or `nano /config/config.yml` in the container's console), **select all, delete, paste the complete file** — the ONNX detector, the YOLOv9 model, and the decode preset together. No tokens to swap:

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
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
  labelmap_path: /labelmap/coco-80.txt
version: 0.17-0
mqtt:
  enabled: false
cameras:
  placeholder:
    enabled: false
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:554/rtsp
          roles:
            - detect
```

One **Save & Restart** applies the detector and the decode together. Then prove the card is actually working — in the container's **Console**:

```bash
nvidia-smi
```

The Processes table still reads *"No running processes found"* — correct at this point, not a failure: with only the disabled `placeholder` camera there is nothing to decode and nothing to detect on. The proof that the swap worked lives in **Frigate's UI** instead: the footer now names the **GTX 1080 Ti** (Frigate querying the card from inside the container) and reports **System is healthy** (the new config validated). The processes appear the moment the first real camera lands in the next section — run `nvidia-smi` again after the doorbell, and *that* is when ffmpeg and the detector show with real GPU memory.

## Add the Reolink doorbell

The doorbell is the camera most people actually want, and the pick here is the **Reolink Video Doorbell WiFi in black** — the **4:3 wide-view** model that frames the visitor and the whole doorstep (the white variant is the taller 3:4 head-to-toe one). It runs off the existing wired doorbell transformer, no battery. It does not behave like a plain RTSP (Real-Time Streaming Protocol) camera, so it gets its own walkthrough.

### Understand why a doorbell is different
On Reolink doorbells, plain RTSP video is **less reliable** — it drops and stutters — while video carried over **http-flv (video over HTTP)** is steady. But the two-way talk audio only rides on RTSP. So the trick is to pull *video* over http-flv for stability and add a *secondary RTSP stream just for the audio*, then let Frigate's bundled **go2rtc** restreamer fuse them into one feed it can record, detect on, and talk back through.

*Bundled* means you never install or configure go2rtc separately — the install script deployed it alongside Frigate as its own service, and the `go2rtc:` block in the config **is** its entire setup, read each time its service starts. It is the half that talks to cameras; Frigate consumes its local restreams at `127.0.0.1:8554` — which is why camera URLs live under `go2rtc:` while every `cameras:` entry points at localhost.

### Prepare the doorbell in the Reolink app
In the doorbell's advanced network settings, work through the **Port Settings** — each toggle is a protocol the camera serves, and the build needs a specific set:

- **HTTP — on, port 80.** Carries the http-flv video streams the config pulls; Frigate's docs name this the one hard requirement. It is also why the config's URLs say `http://` — http-flv over port 80 *is* the stable video transport on these doorbells, not an oversight to correct.
- **RTSP — on, port 554.** The audio companion stream and the two-way talk path.
- **HTTPS — optional, port 443.** Protects only the camera's own settings pages in your browser; no stream uses it.
- **ONVIF — off.** Nothing in this build speaks it.
- **RTMP — leave on for now.** The flv machinery references it internally and Frigate's docs make no promise it survives disabled — after everything streams, try switching it off, and turn it back if the feed dies.
- **Basic Service (port 9000) — on.** Reolink's own client protocol: the phone app on the LAN, and the Home Assistant Reolink integration later in the build.

Still in the network settings, give it its **permanent static address**, so the config below never goes stale:

- **IP** → `192.168.1.70`
- **Mask** → `255.255.255.0`
- **Gateway** → `192.168.1.1` — for now; the hardening section at the end of this page blanks it

The video tuning lives on a different page — Reolink files it under **Settings → Display → Stream**, not network — where the **Clear** and **Fluent** streams each get a tab. On **both** tabs:

- **Rate control** → **Constant** — the control's name varies by firmware (**Bitrate Mode**, **Frame Rate Mode** on this doorbell, or the old **"On, fluency first"** toggle — all the same knob); steady-rate video is what Frigate prefers
- **Resolution / FPS / Max Bitrate** → **defaults** — Clear's defaults are what gets recorded, and Frigate resizes Fluent down to the detector's 320×320 regardless
- **Interframe Space** → **1×** if the model offers it — this WiFi doorbell does **not**, and that is fine: the interval is fixed in firmware, costing a touch of live-view startup lag, not detection or recording quality

For the login fields below, use the doorbell's **admin** account: the User-level accounts Reolink lets you add cannot drive **two-way talk**, and the talk-back path in the config authenticates with these same credentials.

> [!INPUT] doorbell-ip | Reolink doorbell IP | 192.168.1.70

> [!INPUT] doorbell-user | Doorbell username | | admin

> [!SECRET] doorbell-password | Doorbell password
> The login set in the Reolink app — it fills the `USER` / `PASS` slots of the config below.

> [!WARNING]
> Take the exact stream details from the Reolink app — do not guess them. In particular confirm **HTTP is enabled**, or the http-flv video path will not connect at all.

### Add the doorbell to the config
Back in Frigate's config editor: **select all, delete, paste the complete file below.**

- **What it carries** → everything so far (detector, model, decode) plus the doorbell's `go2rtc:` streams and camera entry — and the `placeholder:` camera is gone, its job done
- **Tokens** → **`DOORBELL-PASS`** ×3, all in the `go2rtc:` stream URLs; the username `admin` is baked in
- **Leave alone** → the `127.0.0.1` addresses in the `cameras:` half — Frigate talking to its own restreamer, real, not placeholders

> [!WARNING]
> **In this LXC install, go2rtc is its own service, and the editor's Save & Restart restarts only Frigate.** Docker restarts them together; this build does not. Leave go2rtc running an old config and Frigate's ffmpeg gets **404 Not Found** from `127.0.0.1:8554` — a crash loop against a restreamer that has never heard of the stream. So after **every paste that changes the `go2rtc:` block** (this one, the RLC, the turrets), follow Save & Restart with this in **container 102's Console** — Proxmox → **102 (frigate)** → **Console**, the `root` login — not the host's Shell, which has no `frigate` service. The retention and MQTT pastes later skip this; they leave `go2rtc:` untouched:
>
> ```bash
> systemctl restart go2rtc frigate
> ```

> [!WARNING]
> These are URLs, so a password containing `@ : / ? # & % +` or a space **breaks them** — `&` splits the query, `#` ends it early, `@` confuses the rtsp login. If the doorbell password has any of those, change it (Reolink UI, the admin account) to a long **letters-and-digits-only** one and update the field above before filling in the config.


```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
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
  labelmap_path: /labelmap/coco-80.txt
version: 0.17-0
mqtt:
  enabled: false
go2rtc:
  streams:
    doorbell:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=DOORBELL-PASS#video=copy#audio=copy#audio=opus"
      - "rtsp://admin:DOORBELL-PASS@192.168.1.70/Preview_01_sub"
    doorbell_sub:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=admin&password=DOORBELL-PASS"
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
```

> [!NOTE]
> Reading the odd parts: `channel0_main.bcs` is the full-resolution stream (recorded) and `channel0_ext.bcs` is the low-res sub stream (analyzed) — splitting them spares both the doorbell and the detector. The trailing `#video=copy#audio=copy#audio=opus` is deliberate: it passes the video through untouched, keeps the original audio for recording, *and* adds a second Opus audio track the browser live view needs. On the camera, `output_args: record: preset-record-generic-audio-copy` is what actually copies that original audio into the saved files — without it the recordings drop sound. The bare `rtsp://…/Preview_01_sub` line is the talk-back path, and it must **not** carry an `ffmpeg:` prefix — go2rtc has to handle that stream directly for two-way audio to work. The `live: streams:` block binds the live view (and its talk button) to that full `doorbell` stream rather than the detect substream.

> [!TIP]
> Talk-back needs the page served over **HTTPS** — browsers only allow microphone access on a secure connection (use Frigate's authenticated port `8971`). The live view's gear panel reports the capability **per stream**: the doorbell's stream should read two-way *available* (its RTSP leg is the talk path), while the turrets read *unavailable* until their backchannel entries are added during the talk-down work on the Automations page — expected, not broken; their speakers wait on config, not hardware. The reverse proxy set up later in this build provides the real certificate for that, and the doorbell will drive the speaker announcements set up later in the automations work.

> [!TIP]
> Not interested in talking back? Drop the secondary `rtsp://…/Preview_01_sub` line entirely and keep just the http-flv video. That is the simplest, most reliable doorbell setup — you still get full recording and person detection, without the most fragile part of the config. (One honest limit: `package` is not a class in this build's COCO-80 labelmap, so package *detection* needs a Frigate+ custom model — the recording still shows the box on the step, but no automation can fire on it.)

> [!WARNING]
> Reolink doorbells have limited streaming capacity and dislike many simultaneous connections. Detecting on the sub stream, as above, keeps the load light — but every extra consumer is another connection, and adding Reolink's own Home Assistant integration is a common one. Running everything at once can cause dropouts, so add one thing at a time and watch the logs.

> [!NOTE]
> **What working looks like for this camera:** the live tile plays the full 2560×1920 main stream over the doorbell's WiFi, so expect it a little juttery — that is the link, not the config. The log shows short bursts of `doorbell: Unable to read frames from ffmpeg process` every few minutes: the WiFi dropping and the watchdog reconnecting, normal for this device. Detection rides the light sub stream, and recordings — once the *Footage and retention* section turns them on, after the footage drive exists — will look **better** than this live tile: the same bits, played back buffered from disk, so arrival jitter disappears and only genuine WiFi packet loss survives as brief glitches. Two more verifications while you are here: `nvidia-smi` in the container's Console now shows **~180 MiB used and real wattage** — the detector resident on the card — though its **Processes table stays empty in an LXC** (the container cannot enumerate PIDs across namespaces; trust the memory and power numbers). And the wired EmpireTechs below will not share any of this jitter.

## Add the RLC-510WA

> [!NOTE]
> **Camera not placed yet? Skip this whole section and keep going** — nothing after it depends on the RLC. Every later complete-file paste includes the `rlc510:` entries; if the camera is still unplaced when you reach one, add `enabled: false` under `rlc510:` (same indent as its `ffmpeg:`) and flip it to `true` when the camera is up. A defined-but-disabled camera costs nothing — Frigate starts no processes for it, and go2rtc only dials on demand. The same line works for any EmpireTech turret not yet on the wall when its paste arrives.

### Add the second indoor camera
The **Reolink RLC-510WA** (5MP WiFi) missed its return window and earns its keep instead: it becomes the **second indoor camera**, covering the big room from the opposite side so the far corner the Color4K-T can't identify into isn't blind. It stays on **WiFi with its 12 V adapter** — no PoE run, no switch port — and is added the same restream way as the doorbell, so its single connection is shared between recording and detection, with detection on the sub stream to keep the WiFi link light. Prep it in the Reolink app first, the same way the doorbell was:

- **Static IP** → `192.168.1.71`, gateway `192.168.1.1` — until the hardening step blanks it
- **Rate control** → **"On, fluency first"** (constant)
- **Interframe Space** → **1×** — an I-frame interval matching the frame rate, what keeps Frigate's recording segments clean
- **Stream paths** → take the exact ones from the app while you are there

Same pattern: **select all, delete, paste the complete file below** — everything from the doorbell step plus the `rlc510` pair.

- **Tokens** → re-swap **`DOORBELL-PASS`** ×3 (the paste resets them); fill **`RLC-PASS`** ×2

This paste changes the `go2rtc:` block, so after **Save & Restart**, bounce the restreamer too — in **container 102's Console** (Proxmox → 102 → Console, the `root` login):

```bash
systemctl restart go2rtc frigate
```

> [!INPUT] camera-ip | Reolink RLC-510WA IP | 192.168.1.71

> [!INPUT] camera-user | RLC-510WA username

> [!SECRET] camera-password | RLC-510WA password

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
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
  labelmap_path: /labelmap/coco-80.txt
version: 0.17-0
mqtt:
  enabled: false
go2rtc:
  streams:
    doorbell:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=DOORBELL-PASS#video=copy#audio=copy#audio=opus"
      - "rtsp://admin:DOORBELL-PASS@192.168.1.70/Preview_01_sub"
    doorbell_sub:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=admin&password=DOORBELL-PASS"
    rlc510:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_sub"
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
> `h264Preview_01_main` / `_sub` is the usual RLC spelling, but confirm it from the Reolink app rather than trusting the example — these paths are **H.264**, which is exactly why this model is the trouble-free Reolink (the H.265-locked higher-megapixel models are where the RTSP pain lives). Detecting on the sub stream is correct anyway — frames get resized down to the model's small 320×320 input, so a high-resolution detect stream loses the extra detail for nothing; Reolink locks the substream's resolution and frame rate in firmware, and its low-res sub is genuinely fine for an indoor room at close range. Frigate tracks `person` by default; add an `objects: track:` list if you want `dog` and friends on this camera too.

> [!WARNING]
> WiFi cameras drop more than wired ones — Frigate's docs are blunt that wireless streams are less reliable. Indoors, close to the router, the RLC-510WA has an easier life than it would outside, but if it stutters, that is the link, not Frigate. It is the one deliberate WiFi exception in the fleet; the five EmpireTechs specced below all ride the wired GS308EPP.

## The PoE camera lineup

The doorbell and the RLC-510WA got the build going; the wired five are the **four EmpireTech `IPC-T54PRO-AS` WizColor turrets** (dual-light, two-way talk, **3.6mm** lenses — the mounting section below is why) at the perimeter corners — **`shed_turret`** `.72`, **`carport_turret`** `.73`, **`patio_turret`** `.74`, **`chimney_turret`** `.75` — and the **`IPC-Color4K-T-S2`** (8MP full-colour, **3.6mm**) as **`kitchen_turret`** at `192.168.1.76`. All five ride PoE on the **GS308EPP**. Dahua-family hardware is why the config below is plain RTSP with configurable substreams and an honoured manual shutter — no http-flv gymnastics, no connection limits.

### Add each one to the config
A Dahua-family camera takes **plain RTSP** — none of the doorbell's http-flv work. Each camera's own web UI has you set an admin password on first login — use **one login for all five EmpireTechs** and record it once; it fills every `USER`/`PASS` slot below:

> [!INPUT] empiretech-user | EmpireTech cameras admin username | | admin

> [!SECRET] empiretech-password | EmpireTech cameras admin password (all five)

Wire each camera to the **GS308EPP**, then assign its permanent static in its own web UI — the names are the real corners:

- **`shed_turret`** → `192.168.1.72`
- **`carport_turret`** → `192.168.1.73`
- **`patio_turret`** → `192.168.1.74`
- **`chimney_turret`** → `192.168.1.75`
- **`kitchen_turret`** (the indoor Color4K) → `192.168.1.76`
- **Gateway, all five** → `192.168.1.1` — until the hardening step blanks it

Once all five are addressed: **select all, delete, paste the complete file below.**

- **Tokens** → re-swap **`DOORBELL-PASS`** ×3 and **`RLC-PASS`** ×2; fill **`TURRET-PASS`** ×10 — the one shared EmpireTech admin password
- **`chimney_turret`** → ships **`enabled: false`** in this file and the two after it (not mounted yet); delete that line or flip it to `true` in whichever paste lands after it goes up

This paste changes the `go2rtc:` block, so after **Save & Restart**, bounce the restreamer too — in **container 102's Console** (Proxmox → 102 → Console, the `root` login):

```bash
systemctl restart go2rtc frigate
```

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
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
  labelmap_path: /labelmap/coco-80.txt
version: 0.17-0
mqtt:
  enabled: false
go2rtc:
  streams:
    doorbell:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=DOORBELL-PASS#video=copy#audio=copy#audio=opus"
      - "rtsp://admin:DOORBELL-PASS@192.168.1.70/Preview_01_sub"
    doorbell_sub:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=admin&password=DOORBELL-PASS"
    rlc510:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_sub"
    shed_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.72:554/cam/realmonitor?channel=1&subtype=0"
    shed_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.72:554/cam/realmonitor?channel=1&subtype=1"
    carport_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.73:554/cam/realmonitor?channel=1&subtype=0"
    carport_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.73:554/cam/realmonitor?channel=1&subtype=1"
    patio_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.74:554/cam/realmonitor?channel=1&subtype=0"
    patio_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.74:554/cam/realmonitor?channel=1&subtype=1"
    chimney_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.75:554/cam/realmonitor?channel=1&subtype=0"
    chimney_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.75:554/cam/realmonitor?channel=1&subtype=1"
    kitchen_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.76:554/cam/realmonitor?channel=1&subtype=0"
    kitchen_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.76:554/cam/realmonitor?channel=1&subtype=1"
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
  shed_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/shed_turret
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/shed_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  carport_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/carport_turret
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/carport_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  patio_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/patio_turret
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/patio_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  chimney_turret:
    enabled: false
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/chimney_turret
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/chimney_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  kitchen_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/kitchen_turret
          input_args: preset-rtsp-restream
          roles:
            - record
        - path: rtsp://127.0.0.1:8554/kitchen_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
```

> [!TIP]
> That file holds **one** `go2rtc: streams:` map — the doorbell pair, the `rlc510` pair, and a main+sub pair per EmpireTech camera, fourteen entries all told — and **one** `cameras:` map with seven entries. That is the complete-file pattern doing its job: the structure cannot drift, because each paste replaces it whole.

### Tune each turret in its own web UI
Not optional polish — the substream **is** what the detector watches, and the manual shutter is half the reason this build runs Dahua-family hardware. Browse to each camera (`http://` + its IP, the `admin` login), work the panes below, and press **Apply** on each before leaving it.

**Camera → Encode — Main Stream** (what gets recorded):

- **Compression** → **H.265** — same picture from roughly a third fewer bits, halving what continuous recording eats; this household is HEVC-native end to end (the kitchen proved it live in Safari)
- **Encoding Strategy** → **General** — the smart modes emit variable keyframes NVRs hate
- **Resolution** → **2688×1520** (as shipped)
- **Frame Rate (FPS)** → **15** — at a fixed bitrate, fps trades per-frame sharpness for smoothness: 15 gives every frame twice the bits of 30, and a security camera's product is the frame you zoom, not smooth motion. (Prefer 30 someday? Raise the bitrate in step, or each frame goes soft)
- **Bit Rate Type** → **CBR**
- **Bit Rate** → **2560**
- **I Frame Interval** → **30** — one keyframe per two seconds; the rule is 2× fps
- **SVC** → **1 (off)** — layered streaming ffmpeg does not want
- **Smooth Stream** → **50** — the default bias, leave it
- **Watermark** → either; Dahua's invisible tamper stamp, ignored downstream

**Camera → Encode — Sub Stream** (what the detector watches):

- **Sub Stream** → **Sub Stream 1**, toggle enabled — `subtype=1` in the config's URLs is this stream
- **Compression** → **H.264** — decoded around the clock by every client, and too small for H.265 to save anything real
- **Resolution** → **704×480 (D1)** — the biggest offered, and plenty; the detector resizes to 320×320
- **Frame Rate (FPS)** → **5** — five clean fps beat thirty muddy ones
- **Bit Rate** → **256** (CBR)
- **I Frame Interval** → **10** — same 2×-fps rule; the valid ranges rescale when you change fps

The **kitchen_turret differs on two fields only**, both scaling with its 8MP sensor:

- **Resolution** → its native **3840×2160**, as shipped — that resolution is why this camera exists
- **Bit Rate** → **~5120** — twice the pixels want twice the bits (2560 is a 4MP number); its own **Reference Bit Rate** line brackets the sane range, so sit near the middle of what it shows

Everything else on its Encode pane, main and sub, takes the identical values.

> [!NOTE]
> The **Reference Bit Rate** line is the camera telling you the sane range for the current shape — information, not a setting. Two dials for later, neither a reason to touch codecs: a rainy IR night that turns mushy wants that camera's main bit rate nudged **2560 → 4096**, and any future non-Apple browser that refuses a live view wants that camera's main **Compression → H.264** — one dropdown; Frigate copies whatever arrives.

**Camera → Image → Customized Scene → Profile: Night → Exposure** — the four outdoor turrets only:

- **Mode** → **Manual** — auto trades motion blur for brightness at night; a smeared person defeats detection and identification, and this is the control Reolink fakes and Dahua honours
- **Shutter** → cap near **1/120 s** — if the field speaks milliseconds, that is **≈ 8.3 ms**
- **Gain** → keep the default **0–50** range — the scale runs to 100, so that ceiling *is* "held down": amplification to half scale, IR carries the rest. A grainy night image later → lower that camera's max toward 30; too dark → the fix is IR reach, never gain 100
- **Anti-flicker** → **60Hz**, actively set in **both profiles** — the **Day profile defaults to Outdoor on these turrets**, so it is a real edit there too, not a verify. 60Hz kills the banding 60Hz-mains lighting causes (the indoor camera's scrolling bands earlier in this build were exactly this) and costs nothing in sunlight; **Outdoor** bets no artificial light ever enters the frame, and porch lights lose that bet
- **Only the Night profile gets edited** — the Day/Night handoff runs just Day and Night; the rest of the dropdown (General, Front Light, Strong Backlight, Low Illuminance, Custom…) are dormant presets, and Day stays auto because daylight makes fast shutters on its own
- The **kitchen_turret keeps Auto exposure** — no IR to backstop a fast shutter (full-colour by design), so a forced 1/120 s in a dark kitchen yields black frames; its oversized sensor is the tool doing that job

**Camera → Image → Illuminator:**

- **Outdoor turrets**, under the **Night** profile: **Fill Light** → **IR Mode** — infrared, not warm white, on any angle meant to read a licence plate; colour mode washes plates out. **Mode** stays **Auto** (it governs IR intensity) and the remaining field stays default. Know the consequence: these sensors hold **colour on ambient light alone** (porch and street spill), and only go mono when IR actually kicks in — that mono moment is the plate trade working. A backyard angle with no plates may run the warm light or **Smart** mode instead for colour nights, at the cost of a visible glow — preference, not correctness. (The doorbell is mono at night regardless — small sensor, IR-only hardware)
- **kitchen_turret** → **Mode: Off** — a camera that floodlights the kitchen at 3 a.m. is a nuisance

**Camera → Audio** — recorded and detected **by deliberate choice** on this build (bark, scream, speak and yell become events the automations page acts on; ambient outdoor audio is captured around the clock, a privacy and legal line crossed knowingly on this property):

- **Enable (Main Stream)** → **ON** — the mic feeding recordings and detection
- **Enable (Sub Stream)** → **off**
- **Audio Encoding** → **AAC** if the dropdown offers it, else keep **G.711A**
- **Sampling Rate** → **16000** — the dropdown runs to 64000, but 16 kHz is the ceiling anything here consumes: Frigate's detection models are 16 kHz native (higher input just gets downsampled), and human speech fits entirely inside it; 8000 is telephone-band, higher rates only fatten files
- **Noise Filter / volumes** → as found
- The turret **speakers** need nothing here — a talk-down automation rides go2rtc's talk-back path and is built on the Automations page

**Everything else holds its default:**

- **Encode → Overlay** → the one worthwhile optional: **Channel Title** = the camera's key, **time overlay** on — identification burned into the pixels of any exported clip
- **Encode → ROI** → **off** — region-of-interest *encoding* (bitrate favoritism inside the frame), not detection zones, which are Frigate's job later
- **Audio → Alarm Tone** → untouched — camera-side siren sounds for analytics this build keeps off; a future siren automation triggers the speaker by API, not this tab

The same clicks repeat on all five cameras — **Apply** saves each pane, and **Time Plan Settings** at the bottom of the Image page is where the Day/Night profile handoff is scheduled if the default switching ever needs adjusting.

## Mount the cameras

The four turrets go in **inside building corners**, routed straight into the wall cavity. Turrets make this easy — here is the whole method.

### Aiming: the eyeball does the work
A turret is a ball-in-socket — it tilts and rotates inside its housing, so mounted flat on a wall it **already aims down and out**. You do **not** need an angled bracket or a wall arm to point it down; downward is its natural direction. (Brackets only solve the opposite problem — a soffit-mounted turret that can't tilt back *up* to the horizon — which is not your case.)

### Lens: 3.6mm fits an inside corner
Each camera sits in a concave 90° corner, so the two walls block everything but a **90° wedge** looking out. The **3.6mm** lens (95° horizontal on the T54PRO-AS, per EmpireTech's spec) matches that opening with only a couple of degrees of overspill at each edge — nearly every pixel lands on the useful area. A wider 2.8mm would overspill onto the two flanking walls and, worse, bounce the IR and warm light back into the lens at night. Step up to **6mm** only on a corner whose view is unusually deep and you want the extra reach down the middle.

### Cavity mount: skip the junction box
Routing into the wall cavity means the cable and its waterproof connector tuck **inside the wall**, so you can skip the junction box entirely — it exists for solid-masonry runs with nowhere to hide the connector. Per camera:

1. **Drill about a 1-inch hole** behind the base, big enough to pass the camera's moulded waterproof RJ45 pigtail into the cavity. Position it so the base covers the hole.
2. **Deal with the unused pigtails before anything goes in the wall.** Running PoE leaves the 12 V barrel, alarm in/out, and audio leads doing nothing. Tape each unused end closed — quality electrical tape is fine in a dry cavity; self-amalgamating tape is the upgrade — with a dab of **dielectric grease** inside any connector shell first. (Dahua's own guides actually sanction cutting unused leads and taping the stubs; taping without cutting preserves the options and is the default here.) An open connector is a wick: moisture corrodes the pins and can travel the conductors back into the camera body. Coil the capped leads, tuck them to the side of the cavity rather than against the drywall's back face where condensation forms, and zip-tie the bundle so nothing hangs on the camera's cable gland.
3. **Seal the wall, not the camera** — the verified picture, from Dahua's own install guide and installer practice: the turret body is the waterproof (IP67) unit, its pedestal is purely mechanical (Dahua's procedure is template → expansion bolts → screws, with no gasket and no caulk called for — the missing base gasket is by design), and the thing that actually needs sealing is the **hole in your wall**. Pack the gap around the cable with **duct seal putty** — the gray electrician's putty from any hardware store's electrical aisle (~$5 a brick, does all five cameras); it never hardens, so a future cable re-run means pulling putty out, not cutting sealant. Give the cable a small **drip loop** inside the cavity so anything tracking the jacket drips off before the connector, and assemble the **waterproof connector kit from the camera's bag** onto the RJ45 (rubber ring into the port, cable through the collet body and locking cover, twist to lock).
4. **Optional insurance on wind-driven walls:** a bead of exterior-grade sealant across the **top and sides only** of the base, keeping water from tracking behind it — the **bottom edge stays open as the drain**. On **Hardie/fiber-cement**, sealant choice matters. **GE Supreme Silicone Window & Door (clear)** is verified right for this: its data sheet lists **cement board** among recommended substrates, it is **neutral cure** (not the acetoxy/vinegar-smelling kind, which adheres poorly to cement board), and it meets **ASTM C-920 Class 50** — double the *Class 25* minimum James Hardie specifies. Polyurethane/hybrid sealants (Quad, Dynaflex Ultra, OSI) are the paintable alternative, since the GE is **not paintable**. Whatever you use: surfaces must be clean and dry, and **never prep with soap and water** — silicone will not stick to soap residue (isopropyl alcohol is the right cleaner). Mind the weather window too: that GE is rain-ready in 30 minutes only with a thin bead above 65 °F and 50% humidity — otherwise it wants **8 dry hours**. While drilling Hardie: carbide bit, gentle through the face (it chips), and pilot-drill the screw holes — it cracks near edges under self-tappers. Do **not** caulk the camera's own housing seams, lens ring, or base-to-body joint: the IP67 sealing is internal, and trapping moisture inside is how cameras fog.
4. The RJ45 connection now lives in the dry cavity — protected, no weatherproofing tape needed on that joint.

> [!DANGER]
> **Know what is already in the cavity before the bit goes in.** Exterior walls carry mains wiring, and a drill bit, a screw, or a fish tape dragged across existing cable does not have to sever it to matter — a nick in the insulation or a pinched conductor arcs *intermittently*, sometimes for weeks, at any hour and under any load. That is precisely the fault an **AFCI breaker** exists to catch, so a circuit that starts tripping after wall work should be treated as a damaged cable until proven otherwise, not as a nuisance to reset. Scan with a stud finder in AC-detect mode first, kill the breakers feeding that wall while drilling, and keep low-voltage runs from resting against Romex on the way through. If a circuit does start tripping afterwards, stop resetting it and get an electrician to open the wall — most modern AFCIs blink a diagnostic code after a trip that tells them whether it saw an arc, a ground fault, or an overload.

> [!NOTE]
> The one exception is a corner that turns out to be **solid brick or stucco with no cavity** behind it — there you would want EmpireTech's **`PFA130-E`** junction box (about $20) to hold the connector, since you cannot fish into the wall. For framed walls with a cavity, buy no boxes.

> [!WARNING]
> Keep each camera's view clear of the **flanking walls, gutters, and fascia**. A turret's lens sits flush, so a bright surface right in front bounces IR — and the T54PRO-AS's warm light — back into the lens and washes the image out. Aiming into the open wedge (the reason for the 3.6mm lens) is exactly what avoids it. The night-time signature of a bright source too close to the lens axis is a **milky wash with a rainbow flare streak** — and the first diagnostic is to notice *when* it appears. If it tracks an external fixture (this build's patio turret flares only while the rear patio light is on), it is that fixture's light grazing the lens: live with it, shade the fixture, or tilt a few degrees. If it is there every night, suspect a film on the front glass (installation fingerprints, pollen, dew — wipe with a dry microfiber) or the camera's own illuminator bouncing off a flanking surface (lower the Night profile's **Fill Light** brightness from auto to a modest manual level). Worth chasing when it sits over walkways — haze eats the contrast the detector feeds on.

## Harden each camera

A cheap IP camera is the least-trusted device on your network — closed firmware, a habit of phoning home to a vendor cloud, and exactly the sort of thing that turns up in breach lists. But nothing in this build needs a camera to reach the internet: Frigate pulls its stream **locally**, and you view it remotely by tunnelling *in* over Tailscale (the Remote Access page). So cut every camera off from the internet while leaving it fully reachable on the LAN. This is **device-level isolation** — no VLAN, no managed switch, no extra hardware.

### Cut the camera's route to the internet
Do this **after** the camera is configured and streaming to Frigate — initial setup in the vendor app often needs internet to activate the device, so lock it down last.

Every camera already runs the static address you assigned during setup; the hardening move is a **dead-end gateway**. A device only needs its gateway to reach addresses *outside* its own subnet — i.e. the internet. Point it somewhere nothing lives and the camera can still talk to anything on `192.168.1.x` (so Frigate keeps pulling its stream, unchanged), but it **cannot route a packet to the internet**: it can't phone home, leak footage to a cloud, or be reached by anyone outside. This build's designated dead end is **`192.168.1.98`** — inside the protected static zone, assigned to nothing, and it stays that way. Do not use a blank field or `0.0.0.0` instead: Dahua's manual requires a same-segment gateway and its firmware is known to misbehave with both — the dead-end address is the reliable spelling of "no gateway."

**The five turrets** — in each camera's web UI (`http://192.168.1.72` through `.76`), the **Network Settings** menu → **TCP/IP** (this fleet's firmware puts the menus in the top bar — Live, Network Settings, System — not behind a "Setting" tree). Every field on the pane, in order:

- **Host Name** → leave it
- **ARP/Ping** → leave the default — a LAN-only address-setting aid
- **NIC** → **Wired(Default)**, as shipped
- **Mode** → **Static** — already set at setup
- **MAC Address** → display-only
- **IP Version** → **IPv4**
- **IP Address / Subnet Mask** → already `.72`–`.76` and `255.255.255.0`; leave them
- **Default Gateway** → **`192.168.1.98`**
- **Preferred DNS / Alternate DNS** → **`192.168.1.98`** / blank — with a dead gateway it could never reach a resolver anyway
- **Apply**

**The Reolink pair** — in each camera's web UI (`http://192.168.1.70` and `.71`, the admin login), **Device Settings → Network → General**. The iOS app cannot do this part — its static form (Device Settings → Device Info → Network Information) hides DNS entirely — so use the web UI:

- **Connection Type** → **Static**
- **IP Address / Subnet Mask** → keep `.70` / `.71` and `255.255.255.0`
- **Gateway** → **`192.168.1.98`**
- **DNS** → if DNS rows appear in Static mode on your firmware, **`192.168.1.98`** as well

### Shut the vendor cloud off at the source
The dead-end gateway already stops the traffic; this step turns off the services that would keep *trying* — and the two vendors keep them in different places. The turrets have no app at all: their cloud path is a service in the web UI, shipped **on**.

**The five turrets** — same web UI, everything under the **Network Settings** menu unless noted:

- **Platform Access → P2P** → **untick Enable** — it ships enabled, behind Dahua's own consent text admitting it sends the device's IP, MAC, and serial number out. Off kills the DMSS-app/cloud path; the web UI, RTSP, and LAN access carry on. The pane's **Status** reads **Offline** from now on — that is the setting working, not a fault
- **Platform Access → ONVIF** → **leave ON** — this toggle is ONVIF *login verification*, not ONVIF itself; it just requires credentials, which Frigate supplies
- **Platform Access → RTMP** → **verify off**, its shipped state — a push feature that sends an H.264 stream *out* to a streaming server (Enable, address, port 1935); nothing here receives one. Not to be confused with the doorbell's RTMP toggle, which stays **on** for its flv video path — different vendor, different job
- **UPnP** → the pane has two switches at the top, and both get switched **off**:
  - the one labeled **"Enable"** → **off** — that is the port-mapping half; off means the camera can never punch its own hole in a router
  - the one labeled **"Enable Device Discovery"** → **off** — SSDP presence broadcasting, which ships on
  - the five-row **mapping table** below them (HTTP/TCP/UDP/RTSP/HTTPS, each with its own Enable) → **ignore it** — it is the list of ports the camera *would* request, and it goes inert once the master "Enable" above is off. A **"Mapping Failed"** status on the rows just means the router has been refusing the requests — which is what you want, now made permanent at the camera
- **Bonjour** → **off** — on by default; LAN mDNS advertising that nothing in this build uses
- **Multicast** → **off in both columns** — the pane has a **Main Stream** and a **Sub Stream** column, each with its own **Enable** toggle, and on this build's firmware both ship **on**. Flip both off (and if the **Sub Stream** dropdown offers a second entry, select it and check its Enable too). This pane offers the streams to a `224.x` multicast *group* for many-viewers setups; nothing here subscribes — Frigate pulls its own direct unicast RTSP connection
- **Auto Registration** → **off** — it announces the camera to a central management server; nothing here runs one
- **DDNS / PPPoE / Email** → verify all three panes **off / unconfigured**, their shipped state
- **SNMP** → no single on/off exists — the **Version** row's three checkboxes (**V1 / V2 / V3(Recommended)**) are the switch: all three **unticked** means SNMP is off, which is how it ships; leave them, and the communities and trap fields below them stay blank
- **Basic Services** (bottom of the sidebar) → the service-switch pane, one answer per row:
  - **SSH** → **off** — the port field beside it is inert while off
  - **Multicast/Broadcast Search** → **off** — only costs vendor tools' LAN auto-discovery; everything here goes by IP
  - **CGI** → **off** — nothing in this build speaks it
  - **ONVIF** → **leave ON** — the actual ONVIF service; login-gated by the verification toggle on Platform Access, and cheap to keep for the talk-down work planned on the Automations page
  - **Genetec** → **off**
  - **Mobile Push Notifications** → **off** — the P2P app path's other half. The **Clear Subscription Info** button beside it wipes phone tokens from a past DMSS pairing; these cameras never met the app, so there is nothing to clear
  - **Private Protocol** → **leave ON**, with **Private Protocol Authentication Mode** → **Security Mode (Recommended)** — Dahua's own device protocol (port 37777): login-gated, trapped on the LAN by the dead gateway, and the likeliest transport for the talk-down work later
  - **LLDP** → **off** — link-layer neighbor broadcasting nothing here listens to
  - **Online Log Backup** → **off** — log upload to the vendor's service; the dead gateway would block it anyway
  - **TLSv1.1** → **off** — legacy-TLS compatibility for the (disabled) HTTPS service; off is the secure side
- **Maintenance Center → Update** → two halves on one page. Under **Online Update**: **Auto Check for Updates → off** — it ships **on** on this fleet's firmware, so flip it (the **Manual Check** button beside it is inert with the dead-end gateway; nothing reaches Dahua's servers either way). Under **File Update**: the real path — manual `.bin` files from EmpireTech's own download page, on your schedule
- **Maintenance Center → Log Info → Remote Log** → **Enable → off**, its shipped state — a syslog push of the camera's logs to a server; the prefilled `192.168.0.108` address is Dahua's placeholder, not a live destination
- **Maintenance Center → Maintenance** → three blocks on the page:
  - **Restart System → Auto Restart → off** — a scheduled weekly reboot is a weekly gap in the recordings for nothing while a camera is healthy; it is the tool to come back for if one ever turns flaky
  - **Delete Old Files → Auto Delete → off** — it prunes camera-side SD storage, which these turrets do not use; retention is Frigate's job on the footage disk
  - **Emergency Maintenance → Enable → off** — the least trustworthy switch on the device: Dahua's after-sales access channel, whose own description says **the system re-enables it by itself** if the device "has any trouble performing functions, such as updating." Switch it off — and this self-flipping habit is exactly why the dead-end gateway, not any toggle, is the wall
- The **Security** menu, tab by tab — mostly leave-as-is, with one trap:
  - **Security Status** → a read-only posture dashboard; glance, nothing to set
  - **System Service** → two tabs on this firmware — and neither is the service-switch pane (that one is **Network Settings → Basic Services**, above):
    - **802.1x** → **Enable → off**, as shipped — port-level network authentication this build's switch does not run; the prefilled PEAP/username/password fields are inert while it is off
    - **HTTPS** → **arrives enabled on this fleet — switch Enable → off**: nothing consumes it (the web UI rides `http://`, Frigate pulls plain RTSP), and a listener that serves no one goes dark. **Auto Redirect** stays off; if the UI drops you after Apply, you were browsing the `https://` address — reload at `http://`
  - **Attack Defense** → leave the defaults: **Account Lockout** already guards logins, **Anti-DoS** and **Firewall** off. (The Firewall's allowlist mode — camera-side "only these IPs may connect" — is real extra hardening, but it is belt-on-suspenders after the fence and the dead gateway, and it is also how you lock yourself out when an IP changes. Skip.)
  - **CA Certificate** → the cert store for HTTPS/802.1x, both unused — nothing to do
  - **A/V Encryption** → **both toggles stay off, deliberately** — enabling **RTSP over TLS** breaks every plain `rtsp://` line in Frigate's config. A stay-off pane, not a hardening opportunity
  - **Security Warning** → **Enable → off**, as shipped — its detections feed only the local log and an alarm-out port nothing is wired to; Kuma and Frigate are this build's alerting
  - **Security Authentication** → one tab, **Digest Algorithm for Authentication**, two rows — **User** and **ONVIF User**: keep both on **MD5**, as shipped. SHA256 looks like the upgrade, but this digest must be spoken by both sides of every login challenge, and Frigate's stream pullers (ffmpeg, go2rtc) are built for MD5 digest — flipping it is how every RTSP stream dies silently while the web UI keeps working. Another stay-put pane
- The rest of Maintenance Center (diagnosis, system info, local logs, Import/Export, Default, Font Pack, the advanced pane) and the **Storage** menu are local-only — out of this walk's scope
- And the **System** menu deserves one pass while you are in the UI — three sections:
  - **General → Basic** → **Video Standard → NTSC** (right for this 60 Hz house — it pairs with the anti-flicker work); **Device Name** → optionally rename the serial string to the camera's key (`shed_turret`, and so on) so panes identify themselves in screenshots
  - **General → Time Sync Allowlist** → **Enable → off**, its shipped state — it gates which IPs may *push* time to the camera, and this build's cameras *pull* NTP instead
  - **Account → Password Reset → Enable → off**, blanking the **Email Address** field with it — the reset flow routes a security code through Dahua's cloud to that address, the exact dependency this section severs, and it parks your personal email inside the least-trusted device on the network. Recovery on this build is Vaultwarden; worst case, the hardware reset button
  - **Account → Anonymous Login** → **off**, its shipped state — verify
  - **Account → Group** tab → not logins but permission *templates*: the factory **admin** and **user** roles. A group with no member accounts is inert, so two rows here is the shipped state — leave both
  - **Account → ONVIF User** tab → Dahua keeps a *separate* account list for ONVIF clients, seeded with one admin at initialization — verify it lists exactly that one account and nothing more; delete any extra
  - **Account → Password Expires in** → **Never**, its shipped state — forced rotation on cameras breeds sticky-note passwords
  - **Peripheral** (Serial Port / External Light / Wiper) → leave untouched — RS-485 and accessory config for hardware these turrets do not have

**The Reolink pair** — one preparation first: in the **iOS app**, if a camera was added by QR/UID scan, add it again **by IP** (**⊕ → Manual Input → the camera's IP**, the admin login) so the app keeps working on the LAN after the next toggle kills the relay path. Prove the new tile opens live view, then delete the old UID entry — and if the app refuses the duplicate ("device already added"), remove the old entry first and re-add by IP. Removing costs nothing: the app's device list is just the phone's address book — every setting lives on the camera, and there is no cloud account bound. Then:

- **Enable UID** (Reolink's P2P relay) → **off — web UI only**: **Network → Advanced → Enable UID**, switch off — its caption is honest about what it is: "Allow Reolink App/Client to access the device via WAN using UID." It ships enabled on every Reolink camera, and the iOS app has no switch for it on cameras. Off means no Reolink-relay access from anywhere outside — remote viewing on this build is Frigate over Tailscale once the Remote Access page is done — while LAN app, web UI, and streams carry on
- **UPnP** → **off**: **Network → Advanced → UPnP** — web UI again; the app has no such toggle
- **Push Notifications** → **off**: the web UI's **Surveillance → Push** — no single switch there; the **Enable/Disable** icons are brushes for the week-by-hour schedule grid, which arrives fully painted. Select **Disable**, clear the whole grid (the clear-all icon at its right edge, or drag across it), and **Save** — an empty schedule never pushes, whatever the type checkboxes say. (App equivalent: **Device Settings → Push Notifications**.) Reolink's push routes device → Reolink's servers → Apple → phone; Frigate and Home Assistant notifications replace it, local and far smarter
- **Auto Update** → **off**: app → **Device Settings → Device Info → Update Device → Auto Update** — firmware stays pinned until you choose otherwise (manual `.pak` files from reolink.com, applied via the web UI)
- **Auto Reboot** → **off**: web UI **System → Maintenance** — it arrives **on**, set to every Sunday at 02:00, and a weekly reboot is a weekly recording gap plus a weekly false blip on the Kuma pings, for nothing (the turrets' Auto Restart verdict, same reasoning). The **Firmware Update** row above it is the manual update path; the red **Restore** button below is a factory reset — never that
- **Illegal Login Lockout** → **leave on**: web UI **System → User Management** — a burst of failed logins locks the account for a few minutes; Reolink's counterpart of the turrets' Account Lockout
- **Email Alerts / FTP upload** → leave **unconfigured**, their shipped state
- **Reolink Cloud** → nothing to switch: it only exists once a camera is bound to a Reolink account, and this build never signs one in — LAN add-by-IP, the web UI, RTSP, and NTP are all account-free
- **Server Settings** → **Network → Advanced → Server Settings → Set Up** — the five-row port dialog, and one row needs action:
  - **ONVIF → tick it**, port `8000` — it **ships unticked** on this firmware (confirmed on the doorbell), and it is what the Reolink integration's doorbell-press events ride on the Automations page; without it a ring falls back to slow polling. The dialog's dependency note (ONVIF needs RTSP) is already satisfied
  - **RTSP** `554` and **HTTP** `80` → ticked, as found — the stream paths Frigate lives on
  - **RTMP** `1935` → ticked, as found — the flv machinery references it
  - **HTTPS** `443` → as found
  - **Basic Service** `9000` → leave — Reolink's own LAN protocol, the doorbell's counterpart of Dahua's Private Protocol; the app needs it
  - **Saving this dialog logs you out of the web UI** — its own warning says so; expected, log back in. A firmware update is the usual culprit if a stream that worked later goes dark — recheck this dialog first

> [!NOTE]
> Where the passwords live, for the record: the camera's admin login is stored (hashed) **on the device** and checked locally — the vendor's cloud never receives it. What Dahua's P2P service collected, by its own consent text, was device *metadata* (IP, MAC, serial), and both halves of that path are now severed. The password's only copies are local: the camera itself, the credential fields on this page, and Frigate's config where the RTSP lines log in.

> [!NOTE]
> The pane names above are verified against Dahua's current Web 5.0 operation manual and Reolink's current support articles — but camera firmware drifts, and a given build may shuffle a pane (the newest Dahua builds, for instance, move updating into a left-rail "Maintenance Center"). Where your camera's screen disagrees with a path here, trust the screen — and flag it so this page gets corrected against the real firmware.

### Give it a local clock
The one thing a camera legitimately wants from outside is the time. With a dead-end gateway it can never reach an internet **NTP (Network Time Protocol)** server, so serve time on the LAN — and the right machine already keeps a disciplined clock: the **Proxmox host** runs **chrony** as its own time-keeper. One appended line turns it into a LAN time server. In the host **Shell**:

```bash
echo 'allow 192.168.1.0/24' >> /etc/chrony/chrony.conf
systemctl restart chrony
```

The datacenter firewall from the fence step is live, so the host also needs the port opened — in the Proxmox UI, select the **node → Firewall → Add**:

- **Direction** → **in**, **Action** → **ACCEPT**
- **Protocol** → **udp**, **Dest. port** → **123**
- **Source** → `192.168.1.0/24`
- **Enable** → **ticked** — GUI-added rules ship disabled
- **Comment** → `NTP for cameras`

Then point every camera at the host:

- **Turrets** → **System → General → Date & Time** tab: switch the radio from **Manual Settings** to **NTP**, **Server** → **`192.168.1.50`**, **Port** → `123`, keep the sync interval, confirm the **Time Zone** (UTC-05:00 Eastern), and set **DST**: **Enable → on**, **Type → Week** (US DST floats — never the Date type), **Start → Mar / 2nd week / Sun / 02:00**, **End → Nov / 1st week / Sun / 02:00**. DST off is the classic exactly-one-hour-slow clock: NTP is working, the camera is just rendering hard standard time — Dahua's manual documents a LAN time source as first-class
- **Reolink pair** → web UI **Network → Advanced → NTP Settings → Set Up** — the dialog is two fields: **NTP Server** → **`192.168.1.50`**, typed over the prefilled `pool.ntp.org`; **NTP Port** → `123`; then **Save**. The proof is at **System → Date & Time**: the clock holding correct means the camera is syncing off the host

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

**Mount it at boot — by the label just stamped.** The `mkfs` command above wrote the `frigate-footage` label onto the disk, and a label mounts as reliably as a UUID (both resolve through `/dev/disk/by-*`) — but the label makes the `/etc/fstab` entry the same fixed text on any machine: nothing to read off the screen, nothing to edit by hand. One chained command creates the mount point, appends the entry, mounts it, and proves it:

```bash
mkdir -p /mnt/frigate-footage && echo 'LABEL=frigate-footage /mnt/frigate-footage ext4 defaults 0 2' >> /etc/fstab && mount -a && df -h /mnt/frigate-footage
```

The final `df` line should show the 4 TB disk (about 3.6T usable) on `/mnt/frigate-footage` — that is the fstab entry parsing and mounting in one pass.

**Hand it to the container** as a mount point at `/media/frigate` — and expect your own wizard choice to push back: the container was built with **Protection: Yes**, and adding a mount point is a disk change, so a bare `pct set` answers `can't update CT 102 drive 'mp0' — protection mode enabled`. This is the deliberate untick-once moment, scripted — drop protection, add the mount, raise it again, reboot (`102` is this build's Frigate container ID):

```bash
pct set 102 -protection 0 && pct set 102 -mp0 /mnt/frigate-footage,mp=/media/frigate && pct set 102 -protection 1 && pct reboot 102
```

Prove the container sees it:

```bash
pct exec 102 -- df -h /media/frigate
```

Recordings now land on the dedicated disk, and the container's own 20 GB disk stays flat. With the disk in place, switch back to **Frigate's config editor** and set retention explicitly — out of the box continuous recording is off (the default keeps clips of tracked objects for 10 days, but records nothing the rest of the time). Recording and audio turn on together here, on purpose — and from this step forward every config change offers **two ways in**, because re-entering fifteen passwords per paste stops scaling once the running file holds real values.

**Edit in place** — the running config keeps every password already filled:

1. Paste these two blocks at the **end** of the file — recording, and audio detection (bark, scream, speak and yell become events). One paste gotcha: the editor auto-indents the first pasted line to wherever the cursor sat, which quietly swallows `record:` into the last camera and draws squiggles — both `record:` and `audio:` must sit at **column 0**, flush against the left margin:

```yaml
record:
  enabled: true
  continuous:
    days: 7
audio:
  enabled: true
```

2. In the `ffmpeg:` block at the very top, add the output lines so it reads exactly — global output args apply to every camera that does not declare its own, and the doorbell's copy variant deliberately overrides this:

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
  output_args:
    record: preset-record-generic-audio-aac
```

3. In **every camera's** first input — the one whose roles say `- record` — add `- audio` beneath it, seven places, doorbell included:

```yaml
          roles:
            - record
            - audio
```

4. Housekeeping, if your file predates the cleanup: the `rlc510` stanza is the file's oldest text and needs bringing up to the family pattern. Delete its own `detect:` and `record:` stanzas (the global `record:` block makes them redundant), then check the **`go2rtc: streams:`** map at the top — if the `rlc510` / `rlc510_sub` pair is missing, add it (same indent as the other stream names, `RLC-PASS` swapped for the camera's admin password):

```yaml
    rlc510:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_sub"
```

   And make the camera stanza itself read like its siblings — restream inputs, the audio role, an explicit track list, and dark until the hardware is mounted (a defined-but-disabled camera costs nothing; go2rtc only dials on demand):

```yaml
  rlc510:
    enabled: false
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/rlc510
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/rlc510_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
```

**Save & Restart** — and mind the restreamer rule: if step 4 added the `rlc510` pair to the `go2rtc:` block, that block changed, so restart both from the container's **Console** (`systemctl restart go2rtc frigate`); if your file already had the pair, plain Save & Restart is enough — go2rtc untouched, no bounce.

A few minutes later, prove recording is real — from the **host** Shell:

```bash
ls /mnt/frigate-footage/recordings/*/*/
```

Expect **one directory per enabled camera** — five today; `chimney_turret` and `rlc510` are absent by design until their hardware is mounted. Do not be alarmed by the folder names: Frigate names its date and hour folders in **UTC**, so a late evening lands under tomorrow's date and a small hour number — the disk speaks UTC, and the Frigate UI translates back to local time when you browse.

> [!DETAILS] Widening `track:` beyond person
> Each camera's `objects: track:` list is a filter, not the detector's limits — the model already sees all 80 COCO classes on every frame, and the list only chooses which become events, clips, and automation triggers. Adding classes costs no extra GPU work, just noise and storage when they appear. The additions that earn their place here, added at the same indent as `- person`:
>
> - `- dog` and `- cat` on the yard turrets (`shed_turret`, `patio_turret`) — animal events that pair with the `bark` audio event
> - `- car` on `carport_turret` — arrival and departure become events the Automations page can trigger on (the household's own parked car shows as a permanently-tracked stationary object — expected; events fire on movement, not continuously)
> - `kitchen_turret` and the doorbell stay `person`-only — indoors and street-facing, extra classes mostly manufacture noise
>
> Any COCO-80 label works (`bird`, `bicycle`, `truck`…) — but only those 80: the model was trained on the COCO dataset, and a label it never learned (`package` is the one people want) can be written under `track:` yet will never fire, because the network cannot emit it. Package detection is what **Frigate+** sells — paid models fine-tuned on real surveillance footage that add `package`, `face`, and `license_plate`; until then, the doorbell's `person` event and Visitor press are the delivery signals. Every new class is a new false-positive surface: add what you would act on, and prune with per-object thresholds later if one gets chatty. Either path assumes each camera's mic **Enable** from the tuning step; a mic still off just nags the logs until toggled.

**Or paste the complete file** — the right move on a rebuild, or when drift is suspected; swap the same password tokens as before:

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
  output_args:
    record: preset-record-generic-audio-aac
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
  labelmap_path: /labelmap/coco-80.txt
version: 0.17-0
mqtt:
  enabled: false
record:
  enabled: true
  continuous:
    days: 7
audio:
  enabled: true
go2rtc:
  streams:
    doorbell:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=DOORBELL-PASS#video=copy#audio=copy#audio=opus"
      - "rtsp://admin:DOORBELL-PASS@192.168.1.70/Preview_01_sub"
    doorbell_sub:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=admin&password=DOORBELL-PASS"
    rlc510:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_sub"
    shed_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.72:554/cam/realmonitor?channel=1&subtype=0"
    shed_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.72:554/cam/realmonitor?channel=1&subtype=1"
    carport_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.73:554/cam/realmonitor?channel=1&subtype=0"
    carport_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.73:554/cam/realmonitor?channel=1&subtype=1"
    patio_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.74:554/cam/realmonitor?channel=1&subtype=0"
    patio_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.74:554/cam/realmonitor?channel=1&subtype=1"
    chimney_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.75:554/cam/realmonitor?channel=1&subtype=0"
    chimney_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.75:554/cam/realmonitor?channel=1&subtype=1"
    kitchen_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.76:554/cam/realmonitor?channel=1&subtype=0"
    kitchen_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.76:554/cam/realmonitor?channel=1&subtype=1"
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
            - audio
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
  rlc510:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/rlc510
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/rlc510_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
  shed_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/shed_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/shed_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  carport_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/carport_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/carport_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  patio_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/patio_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/patio_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  chimney_turret:
    enabled: false
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/chimney_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/chimney_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  kitchen_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/kitchen_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/kitchen_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
```

**Save & Restart** to apply. A lighter middle ground is a `motion:` block with a `days:` value instead of `continuous:`, keeping only the stretches where something moved.

> [!WARNING]
> The recordings tree under `/media/frigate` (`YYYY-MM-DD/HH/<camera>/MM.SS.mp4`, in UTC) is managed **entirely by Frigate** — retention is config-driven, so never browse in and delete clips by hand to reclaim space. Doing so corrupts Frigate's own bookkeeping. Change the `days:` values instead and let Frigate prune.

> [!WARNING]
> Continuous recording eats disk fast — sizing the footage drive for it is the whole reason that disk sits apart from the mirror, on a board SATA port the host can still see (the HBA and its two mirror disks belong to the TrueNAS VM and vanish from the host). Frigate has a safety valve — when under an hour of space remains it deletes the oldest hour — but watch actual usage for a few days and size `days:` from that. The footage drive gets no redundancy and no offsite, by choice.

## Wire it into the build

### Connect to Home Assistant over MQTT
Frigate and Home Assistant talk over **MQTT (MQ Telemetry Transport)**. This build runs a single **Mosquitto** broker that Zigbee2MQTT also uses; Frigate logs in with its own dedicated MQTT credentials — the `mqtt-user` login you created in the broker's Logins list on the Home Assistant & Zigbee2MQTT page. Point Frigate at the broker — the last config change, two ways in.

**Edit in place** — find the `mqtt:` block and replace its two lines with the five below. One token to fill: **`MQTT-PASS`** becomes the `mqtt-user` login's password — the one set in the Mosquitto broker's **Logins** list on the Home Assistant & Zigbee2MQTT page (recoverable any time at **HA → Settings → Apps → Mosquitto broker → Configuration → Logins**). Record it in the `frigate-mqtt-password` box in this page's credentials section below, so the checklist stands on its own. **Save & Restart**, no restreamer bounce:

```yaml
mqtt:
  enabled: true
  host: 192.168.1.51
  user: mqtt-user
  password: MQTT-PASS
```

**Or paste the complete file** — rebuilds and drift; the camera password tokens as before, plus **`MQTT-PASS`**:

```yaml
ffmpeg:
  hwaccel_args: preset-nvidia
  output_args:
    record: preset-record-generic-audio-aac
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
  labelmap_path: /labelmap/coco-80.txt
version: 0.17-0
mqtt:
  enabled: true
  host: 192.168.1.51
  user: mqtt-user
  password: MQTT-PASS
record:
  enabled: true
  continuous:
    days: 7
audio:
  enabled: true
go2rtc:
  streams:
    doorbell:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=DOORBELL-PASS#video=copy#audio=copy#audio=opus"
      - "rtsp://admin:DOORBELL-PASS@192.168.1.70/Preview_01_sub"
    doorbell_sub:
      - "ffmpeg:http://192.168.1.70/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=admin&password=DOORBELL-PASS"
    rlc510:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_main"
    rlc510_sub:
      - "rtsp://admin:RLC-PASS@192.168.1.71:554/h264Preview_01_sub"
    shed_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.72:554/cam/realmonitor?channel=1&subtype=0"
    shed_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.72:554/cam/realmonitor?channel=1&subtype=1"
    carport_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.73:554/cam/realmonitor?channel=1&subtype=0"
    carport_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.73:554/cam/realmonitor?channel=1&subtype=1"
    patio_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.74:554/cam/realmonitor?channel=1&subtype=0"
    patio_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.74:554/cam/realmonitor?channel=1&subtype=1"
    chimney_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.75:554/cam/realmonitor?channel=1&subtype=0"
    chimney_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.75:554/cam/realmonitor?channel=1&subtype=1"
    kitchen_turret:
      - "rtsp://admin:TURRET-PASS@192.168.1.76:554/cam/realmonitor?channel=1&subtype=0"
    kitchen_turret_sub:
      - "rtsp://admin:TURRET-PASS@192.168.1.76:554/cam/realmonitor?channel=1&subtype=1"
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
            - audio
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
  rlc510:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/rlc510
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/rlc510_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
  shed_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/shed_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/shed_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  carport_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/carport_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/carport_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  patio_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/patio_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/patio_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  chimney_turret:
    enabled: false
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/chimney_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/chimney_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
  kitchen_turret:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/kitchen_turret
          input_args: preset-rtsp-restream
          roles:
            - record
            - audio
        - path: rtsp://127.0.0.1:8554/kitchen_turret_sub
          input_args: preset-rtsp-restream
          roles:
            - detect
    objects:
      track:
        - person
```

**Save & Restart.** This is the finished config — the one the backup warning at the end of this page tells you to copy somewhere safe.

Then install the Frigate integration in the Home Assistant OS VM through **HACS (the Home Assistant Community Store)**, which itself has to be installed once first. You get a live entity per camera, occupancy and motion binary sensors per camera and zone, object-count and performance sensors, the notification image endpoints the phone alerts depend on, and the recordings browsable in Home Assistant's media browser — the raw material for the automations later in this build. Division of labor worth stating: Frigate's own UI at `https://192.168.1.52:8971` remains where you *watch* — live grid, review timeline, exports. The integration is not a viewer; it is how the cameras join the house — triggers for automations, snapshots in pushes, and camera tiles reachable in the companion app over Tailscale without a separate Frigate login.

> [!DETAILS] Install HACS first, then the Frigate integration
> The Frigate integration is not in Home Assistant's built-in list — it ships through HACS, a community catalog installed once. And the App store cannot even *find* the installer until its repository is added — the store only searches repositories it already knows, which is the step everyone hits:
>
> 1. **Settings → Apps → App store** → the **⋮ menu (top right) → Repositories** → paste `https://github.com/hacs/addons` → **Add**, close the dialog
> 2. The **Get HACS** card now exists — search for it, **Install**, then **Start** it once: it downloads HACS into the config folder and stops; its **Log** tab should end in success
> 3. **Restart Home Assistant** — Settings → System → the power menu → Restart
> 4. **Settings → Devices & services → Add integration → HACS** — tick the acknowledgement boxes, then sign in to **GitHub** with the device code it shows, entered at `github.com/login/device` (a GitHub account is required). A **`could_not_register`** error here means HA's own call to GitHub failed before a code existed — usually a transient hiccup: retry once; if it persists, the real cause is in **Settings → System → Logs** (search `hacs`), and AdGuard's Query Log confirms `github.com` resolves. Success ends on the standard **Name and assign** dialog — no Area; **Skip and finish**. (The GitHub link is low-stakes: HACS requests **no scopes** — a public-read token for rate limits only, revocable at GitHub → Settings → Applications. And while on the Integrations screen: **Ignore** the discovered **UPnP — Verizon Router** card — nothing in this build should drive router port-mappings)
> 5. The **HACS** panel joins the sidebar — open it, search **Frigate**, **Download**, and **restart Home Assistant again**
> 6. **Settings → Devices & services → Add integration → Frigate** — the dialog's four fields:
>    - **URL** → **`http://192.168.1.52:5000`** — the internal port; HA's `.51` is one of the two addresses the firewall fence admits there
>    - **Validate SSL** → leave as offered — inert on a plain-`http://` URL; there is no certificate to validate
>    - **Username / Password** → **blank** — 5000 is the unauthenticated port by design; the fence, not a login, guards it
>    - **Submit**, then the usual Name-and-assign wrap-up

> [!INPUT] mqtt-user | MQTT username | | mqtt-user
> The dedicated user Frigate logs in as, created in the Mosquitto app's Logins on the Home Assistant & Zigbee2MQTT page — `mqtt-user` matches the example; edit if named differently.

> [!SECRET] frigate-mqtt-password | MQTT password
> The `mqtt-user` login's password from the Mosquitto broker's Logins list — the value that replaces `MQTT-PASS` in the config.

> [!WARNING]
> **Boot order matters.** The broker lives in the Home Assistant OS VM, which boots slower than this LXC. After a power cut the container can come up before the broker exists, so its MQTT connection never establishes and its Home Assistant entities stay dead until a restart. You set the Home Assistant VM to **order=2** on the Home Assistant & Zigbee2MQTT page; now give this Frigate container **order=3** — in Proxmox, select the container → **Options → Start/Shutdown order** — so the broker's VM (the lower number) always starts first, with a **startup delay** on the container as belt-and-suspenders insurance. Footage still records locally either way; only the automation side goes quiet.

### Restart and watch it work
Apply any config change by restarting Frigate in the container's console:

```bash
systemctl restart frigate
```

Reload the web UI — the enabled cameras' live views should appear, and walking through a frame should produce a tracked person within a few seconds. Three ways to *see* the tracking, from most direct:

- **Debug view** — on a camera's own view, the **gear icon → Debug**, tick **Bounding boxes**: a live box labeled `person` with a confidence score follows you around the frame — the detector's raw output. Know the two box kinds: **red boxes are motion** (the cheap pixel-change stage — the camera's own OSD clock draws one forever until masked), **labeled boxes are tracked objects**. Motion boxes without ever a labeled box on a plainly visible person means detection is not running — first suspect the **person-silhouette icon** in the camera view's top icon row, a runtime Detect switch that overrides the config until flipped back (HA exposes it as `switch.<camera>_detect`); if that is on, check **Settings → System metrics** for the **onnx** detector and its inference speed
- **The first motion mask** — every camera whose burned-in clock draws a permanent red box deserves one: **Settings → Masks and Zones** → pick the camera → add a **Motion Mask** → draw a rectangle over the timestamp → Save. Keep the OSD itself (a clock on recordings is evidence); the mask removes Frigate's attention, not the overlay
- **History** — the walk becomes a review item with a thumbnail; every tracked object does
- **The occupancy entity** — once the HA integration below is in: **Developer tools → States**, filter the camera; `binary_sensor.<camera>_person_occupancy` reads **on** while you stand in frame and drops to **off** when you leave — the whole camera → detector → MQTT → integration chain proven in one toggle

> [!TIP]
> If a camera stays black, watch the logs while it starts: `journalctl -u frigate -f` in the console. A wrong RTSP path or password shows up there immediately. If detection feels sluggish or the CPU is pinned, the 1080 Ti probably is not doing the work — re-check that `nvidia-smi` sees the card inside the container and that the logs name the ONNX/CUDA detector, not a CPU fallback.

> [!NOTE]
> This install does not update in place, so **back up `/config/config.yml`** after every change. That single file is the hand-built heart of the setup — the ONNX detector, the go2rtc doorbell and camera blocks, the MQTT credentials — and rebuilding it from memory is the painful part of any upgrade. Copy it to the TrueNAS `backups` share (or, later in the build, a Nextcloud folder) so a new container is a five-minute restore. At upgrade time, the script's own path is to build a fresh container and copy `/config` across — take a snapshot first.
