---
title: Voice Control
subtitle: Command the house from Siri, your phone, and your watch
collection: Proxmox Home Server
order: 19
accent: violet
---

The *Automations* guide taught the house to act on its own; this one lets you tell it what to do out loud. The good news for anyone already in Apple's world: the devices in your pocket and on your wrist can run any automation or scene you've built — free, processed at home, and reachable from anywhere thanks to the Tailscale link from the *Remote Access* guide. No subscription, and no extra hardware until you decide you want a speaker on the counter.

> [!NOTE]
> One idea makes everything below click: an **automation** *watches* (it fires itself when its trigger happens), while a **script** *runs* on command. So anything you want to say out loud, you point Siri at a **script** — or at an automation's manual trigger. You can't "tell Siri to run" a watching automation any more than you can ask it to set off a smoke detector.

## Say it from your iPhone

### Connect the companion app to home
Install the **Home Assistant** app from the App Store and sign in by entering your server's address — `http://192.168.1.51:8123`, the IP address you pinned in the *Home Assistant OS* guide. Because the *Remote Access* guide put the server on Tailscale with subnet routing, that same address answers whether you're home or out: turn Tailscale on and the app simply reaches it. The app renders the full Home Assistant — every dashboard and automation, plus Assist — in your pocket.

> [!TIP]
> The app keeps an **Internal URL** and an **External URL** under **Settings → Companion app → (your server)**. Point both at that one Tailscale-reachable address and it connects the same way whether you're home or out — no separate away-URL to maintain.

### Make a script for what you want to say
A script is the clean target for a voice command. In Home Assistant, go to **Settings → Automations & scenes → Scripts** and click **Add script**: give it a friendly, sayable name like "Movie night" or "Goodnight", add the actions (dim the lights, close the blinds, lock the doors), and save.

> [!DETAILS] Already built the automation? Two honest options
> If the thing you want to say out loud is the *actions* of an automation you already wrote, you have two clean choices. Either lift those actions into a script and have the automation call the script too (one set of actions, two ways to fire it) — or skip the script and point Siri straight at the automation with the `automation.trigger` action in the next step, which runs an automation's actions on demand regardless of its normal trigger. The script route is tidier when a human will say it often; `automation.trigger` is fine for a one-off.

### Build the Siri Shortcut
Open Apple's **Shortcuts** app, create a new shortcut, and add the Home Assistant **Call Service** action (it performs any Home Assistant action). Pick **`script.turn_on`** and choose your script — or **`automation.trigger`** and choose your automation. Then name the shortcut exactly what you intend to say.

> [!DETAILS] The other building blocks Shortcuts gains
> Installing the app adds more than Call Service to the Shortcuts app: **Fire Event** (drop an event on Home Assistant's bus for an automation to catch), **Render Template** (pull a live value out of HA (Home Assistant) — "what's the house temperature?"), **Get Camera Image**, **Update Sensors**, and **Send Location**. Call Service is the workhorse — because it can call *any* action, a single Shortcut can reach every script, scene, and automation you own — but the others are how people build richer spoken interactions later.

### Say "Hey Siri"
That's the whole trick: **"Hey Siri, Movie night."** The Shortcut fires, Call Service reaches your server over Tailscale, and the house responds. The same spoken name works from your iPhone, iPad, and Apple Watch. A HomePod can start Shortcuts too, but ones that reach into an app like this may hand off to your phone rather than run on the speaker — so for reliable speak-to-the-room control, the speaker path later in this guide is the sturdier route.

## Reach it without a full sentence

### Put scripts and scenes on your Apple Watch
The Home Assistant Watch app runs your scripts and scenes straight from the wrist — no phone, no sentence. Open the Watch app, and your scripts and scenes are right there to tap; recent app versions let you sort them into folders once the list grows. The watch face can also carry **complications** showing a live sensor value — the indoor temperature, whether the garage is open — built from a small Jinja2 template on the **Apple Watch** page inside the app's own settings (**Settings → Companion app → Apple Watch**).

### Wire up the quick triggers
For the handful of things you fire constantly, skip Siri entirely. Add a Home Assistant **widget** to your home or lock screen for one-tap scripts, map a favorite Shortcut to the iPhone's **Action button** (or **Back Tap** on older phones), and you've got physical-feeling controls for "I'm leaving" or "goodnight" without saying a word.

## Around the house, when you add a speaker

### Decide if you need the HomeKit bridge
Everything above works without exposing anything to Apple Home — your *phone* is the microphone. The moment you want to talk to the *room* — "Hey Siri, movie night" said to a speaker on the shelf — that speaker needs your scripts and scenes to exist as native **Apple Home** accessories. That is the one job of Home Assistant's **HomeKit Bridge**: a free, fully-local integration that publishes chosen entities into Apple Home. Add it only when a speaker is actually in the plan.

> [!NOTE]
> Expose **scripts and scenes**, not raw automations. An automation *can* be published, but it lands in Apple Home as a switch that only turns the automation on and off (enables or disables it) — it won't *run* it. Scripts and scenes, flipped "on" by Siri, do the thing. Same watch-versus-run distinction from the top of the guide, one more time.

### Add and pair the bridge
In Home Assistant, go to **Settings → Devices & services → Add Integration → HomeKit Bridge**, and in setup include the scripts and scenes you want Siri to reach (the filter lets you pick domains or individual entities). Home Assistant then shows a **pairing card with a QR (quick response) code and PIN**; open Apple's **Home** app, choose **Add Accessory**, and scan it. Your scripts and scenes now appear as switches you can tap or speak to.

> [!WARNING]
> Pairing must happen with your iPhone on the **same local network** as the server — do it at home, not over Tailscale. After pairing, day-to-day control works fine from anywhere.

### Add the speaker
A HomePod (or whatever Apple home speaker you pick up) then does two things at once. "Hey Siri" spoken to the room triggers the scenes and scripts you just exposed — voice control with no phone in hand. And the speaker quietly becomes an Apple **home hub**, which is what lets HomeKit answer you when you're away from home, too. That's the upgrade your note about a counter speaker was pointing at: nothing about the phone setup changes, you've just added ears to the house.

> [!DETAILS] The honest limits of the Apple Home side
> Three things the docs are clear about. A single bridge tops out at **150 accessories** — generous for scripts and scenes, but real if you ever expose every light and sensor (you can run a second bridge if needed). **HomeKit Secure Video is not supported**, so this isn't the path for your *Frigate* cameras — keep watching those in Home Assistant or its app. And HomeKit's own away-from-home control is what requires the home-hub speaker above; the phone-and-Shortcuts path you started with never needed one, because it rides your own Tailscale link instead of Apple's.

> [!DETAILS] The fully-local alternative — Home Assistant's own Assist
> If buying into Apple Home for a room speaker sits wrong with a build this self-hosted, there's a path that owes nothing to Apple, Google, or Amazon: Home Assistant's built-in voice assistant, **Assist**. It already lives in the app and the dashboard (the Assist icon, top right). For a counter speaker, Home Assistant sells the **Voice Preview Edition** (about $69) — a local puck (wake words "Okay Nabu," "Hey Jarvis," "Hey Mycroft") that can run the whole pipeline on your own hardware: a wake word engine (microWakeWord/openWakeWord), speech-to-text (Whisper, or the lighter Speech-to-Phrase), and text-to-speech (Piper), with an optional local LLM (large language model) via Ollama for looser phrasing. Nothing spoken ever leaves the house. The trade is real — it wants decent hardware and more setup than tapping "Add Accessory" — but it's the option most in keeping with everything else you've built. A guide of its own, when you're ready for it.

### Keep it boring
Voice is a convenience layer over the automations and devices the earlier guides built — so it inherits their upkeep, nothing new. The companion app updates from the App Store, the HomeKit bridge rides along with Home Assistant's own updates (the same monthly habit the maintenance guide folds in), and a script that suddenly goes quiet is almost always a renamed entity underneath — the same thing a quick look in **Settings → Automations & scenes** will show you. Say the words; the house was already listening.
