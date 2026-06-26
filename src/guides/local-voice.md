---
title: Local Voice (Assist)
subtitle: Talk to the whole house with nothing leaving it
collection: Proxmox Home Server
order: 20
accent: emerald
---

The *Voice Control* guide took the Apple route: your phone and watch as the microphone, Siri as the words, your scripts and scenes as the targets — local processing, no subscription, and the easiest possible start if you already live in Apple's world. This guide takes the other fork. Everything here is **100% local** — nothing spoken ever reaches Google, Apple, or Amazon, it keeps working during an internet outage, and unlike the Siri path it can reach *every* Home Assistant entity and automation, not just the scripts and scenes you chose to expose. The trade is real hardware and more setup. The payoff is a voice assistant that owes nothing to anyone but you.

> [!TIP]
> You can try the local assistant — Home Assistant calls it **Assist** — for free, right now, before buying a single thing. Open the Home Assistant companion app or your dashboard and tap the **Assist icon** (top right, the little chat bubble). Type or speak a command and watch it act. That's the same engine the hardware below speaks to; the puck just adds ears and a voice to a pipeline that already exists.

### Understand the local pipeline
A voice command takes four hops, and the reason Assist is so flexible is that **each hop is a separate, swappable stage** rather than one black box. A **wake word** engine (microWakeWord) listens for its name; **speech-to-text** turns the spoken sentence into text; Home Assistant's **intent engine** matches that text to a device, area, or automation; and **text-to-speech** (**Piper**) speaks the reply. The stages talk to each other over the **Wyoming protocol** — a small networked standard — which is the whole trick: any stage can run on any machine on your LAN. Wake word on the puck, speech-to-text on a GPU box, Piper on the Home Assistant VM. Mix and match as your hardware allows.

> [!NOTE]
> "Intent engine" is just Home Assistant's name for the part that decides what you *meant*. "Turn off the kitchen" becomes the same action whether you typed it or spoke it — which is why the *Home Assistant OS* guide's nagging about putting every device in an **Area** pays off here too. No areas, no "turn off the kitchen."

### Get the hardware: Voice Preview Edition
You can assemble the pipeline from a spare microphone and speaker, but the clean answer is Home Assistant's own **Voice Preview Edition** — a small puck (~$69) with a microphone array, a speaker, and a physical **mute switch**, built to run the whole pipeline against your server. Out of the box it answers to the wake words **"Okay Nabu," "Hey Jarvis,"** and **"Hey Mycroft."** Plug it in, point it at your Home Assistant instance, and it joins the LAN like any other device.

> [!WARNING]
> The name is honest: this is still officially a **"preview"** product. It works, the company sells it, and it's the most in-keeping hardware for a build this self-hosted — but expect rougher edges than a finished Echo or HomePod, and expect things to keep changing under it. Buy it as the enthusiast's path it is, not as a polished appliance.

### Pick your speech-to-text — the one real decision
Everything else has a sensible default; this is the choice that shapes how the assistant *feels*, and it comes down to your hardware.

- **Speech-to-Phrase** — CPU-friendly and near-instant, fully local, but **command-style only**. It recognizes a set of phrases auto-generated from your own devices and areas ("turn on the living room lamp," "what's the temperature in the office"). It won't hold a conversation, but it answers the moment you finish speaking, on nothing more than the CPU you already have.
- **Whisper** — open-ended and natural; you can phrase things however you like. The cost is speed: on a CPU it takes roughly **3–8 seconds** per command, long enough to feel broken. Whisper really wants a **GPU**.

> [!NOTE]
> One sharp caveat about Whisper on this build: the official Home Assistant **Whisper add-on is CPU-only**. To get Whisper's natural phrasing at a usable speed you run a **faster-whisper** container that exposes Wyoming and uses a GPU — which is exactly what the next section sets up. Without a GPU in the picture, Speech-to-Phrase is the realistic, genuinely good choice. Don't fight a CPU into doing Whisper's job.

### Go conversational with a local LLM
The full prize — talk to the house in plain English, ask it questions, have it reason about what you meant — comes from putting a **local large language model** behind the intent engine as a **conversation agent**. Home Assistant has a native **Ollama** integration (HA **2024.8** and later, when local models gained the ability to control Home Assistant) for exactly this: point it at an Ollama server on your LAN and your spoken sentences route through the model.

Two requirements make or break it. The model must be **tool-capable** (able to call Home Assistant's functions) or it can chat but can't actually turn anything on. And it wants a **GPU**, or replies crawl. The natural home for both this and faster-whisper is the **shared GPU** from the *Frigate* guide — the same host-driver passthrough you already set up. Run **faster-whisper** and **Ollama** as their own LXCs that borrow the GPU; the Home Assistant VM reaches them over the LAN — **Wyoming** for speech-to-text and text-to-speech, the plain **Ollama HTTP API** for the conversation model. The result is conversational, lands in about **2–3 seconds**, and still never leaves the house.

```yaml
# configuration.yaml — let simple commands skip the LLM entirely
conversation:
  prefer_local_intents: true
```

> [!TIP]
> Set **`prefer_local_intents`** and Home Assistant tries its built-in intents *first*: "turn off the kitchen" matches instantly and never bothers the model, while only the genuinely open-ended questions get handed to the LLM. You get instant response on the 90% of commands that are simple, and conversational smarts on the rest — best of both, and lighter on the GPU.

> [!DETAILS] Where each stage runs, end to end
> Picture the finished layout. The **Voice Preview Edition** puck does wake-word detection locally and streams the captured audio to Home Assistant. The **Home Assistant VM** (from the *Home Assistant OS* guide) orchestrates the pipeline and runs **Piper** for text-to-speech. A **faster-whisper LXC** on the GPU host does speech-to-text and answers over Wyoming. An **Ollama LXC** on the same GPU host runs the conversation model and answers over its HTTP API. Nothing here reaches the internet — the only traffic is between machines on your own LAN. It's the same architectural habit as everywhere else in this collection: small single-purpose pieces, each reachable at a pinned address, wired together over the network.

### Wire it into the build
Assist is a convenience layer over the devices and automations the earlier guides built, so it inherits their plumbing rather than inventing new plumbing. The same **Areas** from the *Home Assistant OS* guide are what let it address rooms; the same **scripts** the *Voice Control* guide built are reachable by voice here too (a script with a sayable name is just as good a target for Assist as it was for Siri); and any **automation** you've written can be triggered by name. Where Siri could only reach what you exposed through the HomeKit bridge, Assist starts with the run of the whole house.

> [!TIP]
> Building the conversational path is also the moment to lean on the *Automations* guide's **Run actions** and **Traces** tools when something "doesn't work." Nine times out of ten the trace shows the intent matched and the action fired exactly as written — the assistant heard you fine, the underlying automation just did what it actually says, not what you meant.

### Be honest about the limits
Local voice is the most satisfying path on a build like this, and also the one most worth setting expectations on before you spend money.

> [!WARNING]
> Three things to keep in mind. First, the hardware is still **"preview"** — capable, but unfinished and changing. Second, **without a GPU you realistically run Speech-to-Phrase**, which means command-style speech ("turn on the porch light"), not free-flowing conversation — perfectly useful, just not the chatty assistant the LLM section describes. Third, **music and general knowledge are still better elsewhere**: a HomePod or Google speaker will out-answer a local LLM on trivia and out-play it on streaming music. The graceful move is to let each do what it's good at — keep the *Voice Control* guide's Apple speaker for "play something" and the weather, and point local voice at the house it controls so completely.

### Keep it boring
Like every other piece in this collection, the upkeep is the upkeep you already do. The faster-whisper and Ollama LXCs update with the **one guest at a time, snapshot first** habit from the *Maintenance and Upkeep* guide; the Voice Preview Edition takes firmware updates from within Home Assistant; and a command that suddenly stops landing is almost always a renamed entity or an entity that slipped out of its Area — the same quick look in **Settings → Areas, labels & zones** that fixed it before. Say the words; you built every link in the chain that hears them.
