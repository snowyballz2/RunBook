---
title: Voice — Siri & Local Assist
subtitle: My Build — "Hey Siri" through the HomeKit Bridge, and a fully-local Assist stack on the shared 1080 Ti
collection: My Build
order: 23
accent: rose
---

Voice is the convenience layer over everything the earlier pages built — the leak sensors, the locks, the Lutron lights and shades, the scripts and scenes. There are two honest ways to talk to this house, and this build runs both. The **Apple path** uses the iPhones, iPads, Apple Watches, and the HomePod mini already in the house as the microphone, with Siri saying the words and your scripts and scenes as the targets — no extra software, no subscription, and it rides the Tailscale link from the remote-access work so it answers home or away. The **local path** is Home Assistant's own **Assist**: a Voice Preview Edition puck on the counter, speech-to-text and a conversation model running on the **EVGA GTX 1080 Ti** that was shared into the host earlier, and nothing spoken ever leaving the LAN (local area network). This page builds both.

> [!NOTE]
> One distinction makes the whole page click: an **automation** *watches* (it fires itself on a trigger) while a **script** *runs* on command. Anything you want to say out loud, point voice at a **script** or a **scene** — or run an automation's actions on demand with the explicit `automation.trigger` action covered below. What never works is flipping an automation's on/off switch and expecting it to *run*: that switch (which is all HomeKit exposure gives you) only arms or disarms the watcher, the way switching on a smoke detector is not the same as setting it off.

## The Apple path: "Hey Siri"

### Connect the companion app to home
Install the **Home Assistant** app from the App Store on each iPhone and sign in with the server's pinned address — the same `ha-ip` from the Home Assistant page, on port `8123`. Because the remote-access work put the Proxmox host on Tailscale as a **subnet router**, the Home Assistant OS **VM (virtual machine)**'s one LAN address answers whether you are home or out — no Tailscale runs inside the VM itself. Under **Settings → Companion app → (your server)**, point both the **Internal URL** and the **External URL** at that single Tailscale-reachable address so there is no separate away-URL to maintain.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51
> The address the companion app, Shortcuts, and the HomeKit Bridge all reach. Pinned on the Home Assistant page.

### Make a script for what you want to say
A script is the clean target for a spoken command. In Home Assistant go to **Settings → Automations & scenes → Scripts → Add script**, give it a friendly, sayable name like "Movie night" or "Goodnight", add the actions (dim the Lutron Caséta lights, lower the shades, lock the three Aqara U400 doors, set the ecobee thermostats back), and save. The locks and the ecobee are already in Home Assistant from the earlier pages; if the Caséta lights and shades are not yet, add the **Lutron Caséta** integration first under **Settings → Devices & services → Add integration** — it talks to the Caséta bridge on your LAN.

> [!DETAILS] Already built the automation? Two honest options
> If the thing you want to say out loud is the *actions* of an automation you already wrote, you have two clean choices. Either lift those actions into a script and have the automation call the script too (one set of actions, two ways to fire it) — or skip the script and point Siri straight at the automation with the `automation.trigger` action below, which runs its actions on demand regardless of the normal trigger. The script route is tidier when a human says it often; `automation.trigger` is fine for a one-off.

### Build the Siri Shortcut
Open Apple's **Shortcuts** app, create a new shortcut, and add the Home Assistant **Call Service** action — it performs any Home Assistant action. Pick **`script.turn_on`** and choose your script, or **`automation.trigger`** and choose your automation. Then name the shortcut exactly what you intend to say. Because Call Service can call *any* action, a single Shortcut can reach every script, scene, and automation in the house.

> [!DETAILS] The other building blocks Shortcuts gains
> Installing the Home Assistant app adds more than Call Service to the Shortcuts app: **Fire Event** (drop an event on Home Assistant's bus for an automation to catch), **Render Template** (pull a live value out of Home Assistant — "what's the house temperature?"), **Get Camera Image**, **Update Sensors**, and **Send Location**. Call Service is the workhorse, but these are how you build richer spoken interactions later.

### Say "Hey Siri"
That is the whole trick: **"Hey Siri, Movie night."** The Shortcut fires, Call Service reaches the server over Tailscale, and the house responds. The same spoken name works from iPhone, iPad, and Apple Watch — and on the Watch, the Home Assistant app lists your scripts and scenes to tap straight from the wrist, no sentence needed; sort them into folders once the list grows. The watch face can also carry a **complication** showing a live sensor value — the indoor temperature, whether a door is unlocked — built from a small **Jinja2** template under **Settings → Companion app → Apple Watch** inside the app.

> [!TIP]
> For the handful of things you fire constantly, skip Siri entirely. Add a Home Assistant **widget** to the home or lock screen for one-tap scripts, and map a favorite Shortcut to the iPhone's **Action button** (or **Back Tap** on older phones without one). Physical-feeling "I'm leaving" and "Goodnight" without saying a word.

## Talk to the room: the HomeKit Bridge

Everything above uses your *phone* as the microphone. The moment you want to talk to the *room* — "Hey Siri, movie night" said to the **HomePod mini** on the shelf — that speaker needs your scripts and scenes to exist as native **Apple Home** accessories. That is the one job of Home Assistant's **HomeKit Bridge**: a free, fully-local integration that publishes chosen entities into Apple Home.

### Add and pair the bridge
In Home Assistant go to **Settings → Devices & services → Add Integration → HomeKit Bridge**, and in setup include the **scripts and scenes** you want Siri to reach (the filter lets you pick domains or individual entities). Home Assistant shows a **pairing card with a QR code and PIN**; open Apple's **Home** app, choose **Add Accessory**, and scan it. Your scripts and scenes now appear as switches you can tap or speak to.

> [!NOTE]
> Expose **scripts and scenes**, not raw automations. An automation *can* be published, but it lands in Apple Home as a switch that only enables or disables it — it will not *run* it. Scripts and scenes, flipped "on" by Siri, do the thing. Same watch-versus-run distinction as the top of the page.

> [!WARNING]
> Pairing must happen with the iPhone on the **same local network** as the server — do it at home, not over Tailscale. After pairing, day-to-day control works fine from anywhere.

### The HomePod mini does double duty
The HomePod mini that is already the **Thread border router** for the Aqara U400 locks now earns a second job. "Hey Siri" spoken to the room triggers the scenes and scripts you just exposed — voice with no phone in hand — and the speaker is also the Apple **home hub** that lets HomeKit answer when you are away. Nothing about the phone setup changes; you have just added ears to the house.

> [!DETAILS] The honest limits of the Apple side
> Three things to know. A single bridge tops out at **150 accessories** — generous for scripts and scenes, but real if you ever expose every light and sensor (run a second bridge if needed). **HomeKit Secure Video is not supported**, so this is not the path for the Reolink doorbell and the RLC-510WA — keep watching those through Frigate in Home Assistant. And HomeKit's own away-from-home control is what needs the home-hub HomePod; the phone-and-Shortcuts path never did, because it rides your own Tailscale link instead of Apple's.

## The local path: Assist on the shared GPU

If buying further into Apple Home for voice sits wrong with a build this self-hosted, the other fork owes nothing to Apple, Google, or Amazon. Home Assistant's built-in assistant — **Assist** — is **100% local**, keeps working during an internet outage, and unlike the Siri path can reach *every* entity and automation in the house, not just the scripts and scenes you chose to expose. The trade is real hardware and more setup. On this build that hardware already exists: the shared 1080 Ti.

> [!TIP]
> Try Assist for free, right now, before buying a thing. Open the companion app or the dashboard and tap the **Assist icon** (top right, the chat bubble). Type or speak a command and watch it act — the same engine the puck below speaks to.

### Understand the local pipeline
A voice command takes four hops, and the reason Assist is so flexible is that **each hop is a separate, swappable stage** rather than one black box. A **wake word** engine (**microWakeWord** on the Voice Preview Edition puck, or **openWakeWord** elsewhere) listens for its name; **STT (speech-to-text)** turns the spoken sentence into text; Home Assistant's **intent engine** matches that text to a device, area, or automation; and **TTS (text-to-speech)** speaks the reply. The stages talk over the **Wyoming protocol** — a small networked standard — so any stage can run on any machine on the LAN. On this build: wake word on the puck, STT on a GPU-backed container, TTS on the Home Assistant VM.

> [!NOTE]
> "Intent engine" is Home Assistant's name for the part that decides what you *meant*. "Turn off the kitchen" becomes the same action whether typed or spoken — which is why putting every device in an **Area** on the Home Assistant page pays off again here. No areas, no "turn off the kitchen."

### Get the hardware: Voice Preview Edition
The local path needs a dedicated **microphone-and-speaker satellite** in each room you want to talk to — and that has to be its own device. **Neither the HomePods nor the Google/Nest speakers can be the Assist microphone:** the HomePod's mic is locked to Siri and the Nest's to Google Assistant, and neither will hand its microphone to Home Assistant. (The Nest can still *play* announcements as a Cast target — that step comes later on this page — it just cannot *listen* for Assist.) So the local voice path is not something the speakers already in the house can do; it needs a puck of its own.

The clean answer is Home Assistant's own **Voice Preview Edition** — a small **$59** puck with a **dual far-field microphone array** and an XMOS audio chip that cuts through room noise, a speaker, a physical **mute switch**, a volume dial, and a 3.5 mm output to wire into a louder speaker. Crucially it runs **wake-word detection on the device itself**, so the server is only invoked once it hears its name rather than streaming audio constantly. Out of the box it answers to **"Okay Nabu," "Hey Jarvis,"** and **"Hey Mycroft."** Plug it in, point it at the Home Assistant instance, and pin its address with a DHCP (Dynamic Host Configuration Protocol) reservation like every other guest. Get one per room you want hands-free voice in.

> [!DETAILS] Pairing a bigger speaker (optional)
> The built-in speaker is fine for replies and timers — add an external one only if you want louder replies in a big room or music from the puck itself. Because that 3.5 mm jack is a true line-out with its own DAC, a decent speaker sounds genuinely good through it; the one rule is it must be a **powered (active)** speaker with a **3.5 mm or RCA aux input** — the jack has no amplifier, so a bare *passive* bookshelf speaker will not work. Use the **wired aux, not Bluetooth** (no pairing or latency), and pick one that stays on rather than auto-sleeping, or the first word of a reply gets clipped while it wakes. Good picks: a **Creative Pebble V3** (~$40) on a counter or desk; an **Edifier R1280T** powered bookshelf pair (~$120, ships with an RCA-to-3.5 mm cable) for a living room. On this build music mostly rides the HomePod mini and announcements the Nest speakers, so this is a per-room nicety, not a requirement.

> [!DETAILS] If you want something other than the Voice PE
> The Voice PE is the recommended satellite — it is the reference hardware the Assist pipeline is tuned against, and as of 2026 there is no successor announced, so it is a safe buy. Two alternatives only win in narrow cases: the **ESP32-S3-BOX-3** adds a touchscreen and is cheaper across many rooms, but it is more DIY (ESPHome flashing) and its mics are more near-field; a **ReSpeaker four-mic array on a Raspberry Pi** (run as a Wyoming satellite) gives the best far-field pickup in a large or echoey room, at the cost of building it yourself. For everywhere else, the Voice PE is the least-effort, best-supported choice.

> [!WARNING]
> The name is honest: this is officially a **"preview"** product. It works and the company sells it, and it is the most in-keeping hardware for a build this self-hosted — but expect rougher edges than a finished Echo or HomePod, and expect things to keep changing under it.

### Run faster-whisper and Ollama on the 1080 Ti
This is where the shared GPU earns its keep. The official Home Assistant **Whisper add-on is CPU-only**, and Whisper on a CPU takes 3–8 seconds per command — long enough to feel broken. To get natural phrasing at a usable speed, run **faster-whisper** in its own **LXC (Linux Container)** that borrows the 1080 Ti, exactly the way Frigate borrows it. The full conversational prize — plain-English questions, the model reasoning about what you meant — comes from a **local LLM (large language model)** behind the intent engine: run **Ollama** in a second LXC on the same GPU host. The Home Assistant VM reaches both over the LAN — **Wyoming** for STT and TTS, the plain **Ollama HTTP API (application programming interface)** for the conversation model. With both on the 1080 Ti the conversational round-trip lands in roughly **2–3 seconds** — versus the 3–8 the CPU takes — and still never leaves the house.

These are the two containers the GPU/HBA Passthrough page deferred to this page — neither exists yet, so build them now.

**Build the Ollama LXC.** The community-scripts helper is the cleanest path, the same download-read-run habit used for the Frigate container. In the Proxmox web interface, click the node, then **Shell**, and run:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/ollama.sh)"
```

Read the script before piping it into a root shell. Accept its defaults; it installs Ollama and exposes its HTTP API on port `11434`.

**Build the faster-whisper LXC.** If a community helper exists for it, use it the same way; otherwise create a plain **Debian 12** container through the Proxmox wizard (a few cores, 2–4 GB RAM, a small disk) and install faster-whisper's Wyoming server inside it by hand — `wyoming-faster-whisper` is a **pip** package, not an apt one. Either way you end with a Debian-based LXC that will run STT against the card, listening on port `10300`.

> [!DETAILS] The hand-rolled install, start to finish
> Inside the Debian LXC's console, put the Wyoming server in its own Python virtual environment:
>
> ```bash
> apt install -y python3-venv
> python3 -m venv /opt/wyoming
> /opt/wyoming/bin/pip install wyoming-faster-whisper
> ```
>
> Then give it a small systemd unit so it listens on `10300` and survives reboots. Create `/etc/systemd/system/wyoming-faster-whisper.service`:
>
> ```ini
> [Unit]
> Description=Wyoming faster-whisper STT
> After=network-online.target
>
> [Service]
> ExecStart=/opt/wyoming/bin/wyoming-faster-whisper --uri tcp://0.0.0.0:10300 --model small-int8 --device cuda
> Restart=on-failure
>
> [Install]
> WantedBy=multi-user.target
> ```
>
> Enable it at boot with `systemctl enable --now wyoming-faster-whisper`. The `--device cuda` flag needs the card, so the service only starts cleanly once the lend-the-card step below is done.

**Lend each container the card.** Both LXCs borrow the 1080 Ti exactly as Frigate does — the host owns the driver, each container adds the three NVIDIA device lines to **its own** config file. On the host, edit `/etc/pve/lxc/<ctid>.conf` for each container (`<ctid>` is that container's ID) and add:

```ini
dev0: /dev/nvidia0,gid=44
dev1: /dev/nvidiactl,gid=44
dev2: /dev/nvidia-uvm,gid=44
```

Restart each container after editing its config. Then, inside each one, install the **in-container NVIDIA userspace driver at the same version** you noted from the host's `nvidia-smi` on the GPU/HBA Passthrough page — a version mismatch is the classic cause of "the GPU vanished." The container's Debian release ships a *different* driver version than the host's, so do not use `apt` for this one: download NVIDIA's installer for the **exact host version** and run it userspace-only —

```bash
# Inside the container — match <version> to the host's nvidia-smi exactly:
wget https://us.download.nvidia.com/XFree86/Linux-x86_64/<version>/NVIDIA-Linux-x86_64-<version>.run
sh NVIDIA-Linux-x86_64-<version>.run --no-kernel-module
```

The `--no-kernel-module` flag is what makes this safe: containers share the host's kernel (and its DKMS-managed module), so only the userspace libraries install here — the host-side "never a `.run`" rule is about kernel modules and does not apply inside an LXC. Give each container a fixed IP via a DHCP (Dynamic Host Configuration Protocol) reservation and enable **Start at boot**, the same habit as every other guest.

> [!NOTE]
> Home Assistant's native **Ollama** integration is what routes your spoken sentences through the model, and it needs **HA 2024.8 or later** — the release where local models gained the ability to actually *control* Home Assistant rather than only chat. The Home Assistant OS VM updates from inside itself — its own **Settings → System → Updates** screen — so keep it current; on an older core the model can talk but cannot turn anything on.

Confirm each container actually sees the card before going further. In each LXC's console:

```bash
nvidia-smi
```

You should see the GTX 1080 Ti listed with a driver version. If it is missing, the share did not take — recheck the `dev0:` lines in the container's config on the host and that the in-container userspace driver matches the host's version exactly.

> [!WARNING]
> The 1080 Ti is **shared**, not handed to one guest — Frigate detection, faster-whisper STT, and the Ollama LLM all borrow it at once. Keep `nvidia-persistenced` running on the host and the host and in-container driver versions matched. **VFIO (Virtual Function I/O)** is reserved for the **HBA (host bus adapter)** feeding the TrueNAS VM and nothing else; the moment the GPU is VFIO-bound, Frigate *and* voice lose the card together.

### Install Piper for the spoken voice
**Piper** is the text-to-speech engine — it turns Home Assistant's replies (and the leak-alert announcement the Automations page writes) into spoken words, surfacing as the **`tts.piper`** entity. On the Home Assistant OS VM it installs as an add-on, not as a container: go to **Settings → Add-ons → Add-on store**, find **Piper**, install it, and **start** it. The Piper add-on **auto-registers itself** as a Wyoming TTS service, so `tts.piper` appears on its own — you do **not** point a Wyoming Protocol integration at it.

> [!NOTE]
> This is the `tts.piper` entity the leak-alert spoken announcement on the Automations page points at. That rule cannot speak until Piper exists — so before you rely on it, confirm `tts.piper` shows up under **Settings → Devices & services → Entities** (or that it autocompletes in a `tts.speak` action). The Automations page deferred this step here; this is where it is delivered.

### Add the Google/Nest speakers as announce targets
Piper makes the *words*; a speaker has to *play* them. The leak-alert announcement (and any other spoken `tts.speak` action) needs a `media_player.*` target, and on this build that target is a **Google/Nest Cast speaker**. Add them in Home Assistant under **Settings → Devices & services → Add integration → Google Cast**; each speaker then surfaces as a `media_player.*` entity you can aim audio at. Close the loop while you are here: the Automations page's leak rule speaks through `media_player.kitchen_speaker` — check the new entity's actual id under **Entities** and either rename it to match or update the rule's target to the real name.

> [!NOTE]
> A **HomePod mini cannot be a `tts.speak` target** — Home Assistant cannot push audio to it, so it never appears as a usable `media_player.*` for spoken announcements. That is why the Cast speaker exists in this stack: it is what the Automations page's leak announcement speaks through. The HomePod stays the Apple-path microphone and Siri target; the Cast speaker is the local path's mouth.

### Pick the STT and wire in the model
Speech-to-text is the one real decision, and on this build the GPU settles it: run **Whisper** (via the faster-whisper container) for open-ended, natural phrasing at GPU speed. **Speech-to-Phrase** is the CPU-only fallback if the GPU is ever busy — command-style only, but instant; it recognizes a set of phrases auto-generated from your own devices and **Areas** ("turn on the living room lamp," "what's the temperature in the office"), which is one more reason the Area habit from the Home Assistant page pays off. In Home Assistant add **one** **Wyoming Protocol** integration, pointed at the faster-whisper container's address and Wyoming port (default `10300`), for STT — Piper's TTS is already covered by the add-on above, so there is no second Wyoming integration to add. Then add the **Ollama** integration pointed at the Ollama container's HTTP API and pick a **tool-capable** model (one that can call Home Assistant's functions — otherwise it can chat but cannot turn anything on). Build a pipeline under **Settings → Voice assistants** that stitches them together, and assign it to the puck.

```yaml
# configuration.yaml — let simple commands skip the LLM entirely
conversation:
  prefer_local_intents: true
```

> [!TIP]
> With **`prefer_local_intents`** set, Home Assistant tries its built-in intents *first*: "turn off the kitchen" matches instantly and never bothers the model, while only genuinely open-ended questions reach the LLM. Instant response on the 90% of commands that are simple, conversational smarts on the rest, and lighter load on the shared GPU.

> [!INPUT] ollama-ip | Ollama LXC IP
> The GPU-backed container running the conversation model. Home Assistant reaches it over the LAN on the Ollama HTTP API (default port `11434`).

> [!INPUT] whisper-ip | faster-whisper LXC IP
> The GPU-backed STT container. Home Assistant reaches it over Wyoming (default port `10300`).

> [!DETAILS] Where each stage runs, end to end
> Picture the finished layout. The **Voice Preview Edition** puck does wake-word detection locally and streams captured audio to Home Assistant. The **Home Assistant VM** orchestrates the pipeline and runs **Piper** for TTS. A **faster-whisper LXC** on the GPU host does STT and answers over Wyoming. An **Ollama LXC** on the same host runs the conversation model and answers over its HTTP API. Nothing reaches the internet — the only traffic is between machines on your own LAN. Same architectural habit as everywhere else in this build: small single-purpose pieces, each at a pinned address, wired together over the network.

## Wire it into the build

### Assist starts with the run of the whole house
Assist inherits the plumbing the earlier pages built rather than inventing new plumbing. The same **Areas** from the Home Assistant page are what let it address rooms; the same **scripts** the Apple path above built are just as good a target for Assist; and any **automation** can be triggered by name. Where Siri could only reach what you exposed through the HomeKit Bridge, Assist starts with the whole house.

> [!TIP]
> When a command "doesn't work," lean on the **Run actions** and **Traces** tools from the automations work. Nine times out of ten the trace shows the intent matched and the action fired exactly as written — the assistant heard you fine; the underlying automation just did what it actually says, not what you meant.

### Let each path do what it is good at
The two paths are not rivals — point each at its strength.

> [!WARNING]
> Three honest limits on the local side. The puck hardware is still **"preview"** — capable but unfinished. **Music and general knowledge are still better elsewhere** — the HomePod mini will out-answer a local LLM on trivia and out-play it on streaming. And the GPU is shared, so a very heavy Frigate detection moment and a long voice query compete for the same card. The graceful move: keep the HomePod mini for "play something" and the weather, and point local Assist at the house it controls so completely — the locks, the leak valve, the lights, the shades.

### Keep it boring
Voice is a convenience layer, so it inherits the upkeep already in place, nothing new. The companion app updates from the App Store; the **HomeKit Bridge** rides along with Home Assistant's own monthly updates; and the **faster-whisper** and **Ollama** LXCs update with the *one guest at a time, snapshot first* habit from the upkeep work. The Voice Preview Edition takes firmware updates from within Home Assistant. A spoken command that suddenly goes quiet is almost always a renamed entity or one that slipped out of its Area — the same quick look in **Settings → Areas, labels & zones** that fixed it before. Say the words; you built every link in the chain that hears them.
