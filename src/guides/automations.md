---
title: Automations
subtitle: The house starts doing things on its own
collection: Proxmox Home Server
order: 18
accent: violet
---

Seventeen guides of infrastructure, and now the payoff they were quietly building toward: the devices from the *Home Assistant OS* guide start acting without you. An automation is one sentence — *when* something happens, *then* do something — and this guide builds four of them, each a pattern you'll reuse for years: a light that follows motion, lights that follow the sun, blinds that follow the dark, and a porch that notices people.

## Learn the grammar

### Meet the automation editor
In Home Assistant, go to **Settings → Automations & scenes**, click **Create automation** (lower right), then **Create new automation**. An empty automation is three sections, and they read like the sentence they are: **When** (the trigger — the event that starts things), **And if** (optional conditions — extra tests that must also be true), **Then do** (the actions). Click around, then leave without saving; the real building starts below.

> [!NOTE]
> Older write-ups and forum posts talk about "calling services" in automations — Home Assistant renamed those to *actions* in 2024, and the editor's sections got the plain-English labels above. Same machinery, friendlier words; old YAML you find online still works.

> [!DETAILS] The three parts, a little deeper
> **Triggers** are events: an entity changing state (a motion sensor flipping on), the sun setting, a clock hitting 07:00. An automation can have several — any one of them fires it. **Conditions** are gates checked *after* a trigger fires: only when somebody's home, only after dark, only on weekdays. No conditions means the actions always run. **Actions** are anything Home Assistant can do: turn entities on and off, activate a scene, send your phone a notification — and an automation can do several in order. Every automation you build in the editor can also be viewed as text: the menu in the top right has **Edit in YAML**, which is how this guide shows the finished builds — compact, and easy to compare against your own.

### Let a blueprint build your first one
The genuinely easiest first automation isn't built — it's filled in. Home Assistant ships a built-in *blueprint* (a ready-made automation with blanks) called **Motion-activated Light**. Go to **Settings → Automations & scenes → Blueprints**, select it, and click **Create automation**: pick your motion sensor in **Motion Sensor**, your light in **Light**, set **Wait time** (how long the light stays on after the last motion — the default is 120 seconds), and save with a name like "Hallway motion light". That's a working motion light, and you never touched a trigger.

> [!NOTE]
> Blueprints are how the community shares finished automations: configure one many times with different devices each time. The **Import Blueprint** button on that same screen accepts a URL from Home Assistant's community Blueprint Exchange — worth a browse once the patterns below feel familiar.

> [!DETAILS] The same thing by hand — and what "For" means
> The blueprint hides a pattern worth knowing, because half your future automations are it. Two halves:
>
> ```yaml
> # Half one — motion on, light on:
> triggers:
>   - trigger: state
>     entity_id: binary_sensor.hallway_motion
>     to: "on"
> actions:
>   - action: light.turn_on
>     target:
>       entity_id: light.hallway
> ```
>
> ```yaml
> # Half two — no motion for five minutes, light off:
> triggers:
>   - trigger: state
>     entity_id: binary_sensor.hallway_motion
>     to: "off"
>     for: "00:05:00"
> actions:
>   - action: light.turn_off
>     target:
>       entity_id: light.hallway
> ```
>
> The **For** field is the quiet hero: the state must *hold* for the whole duration — five minutes of continuous no-motion — before the trigger fires. Someone walking back into the hallway resets the clock.

## Build the classics

### Lights on at sunset
Create a new automation. In **When**, click **Add trigger**, search for **Sun**, choose **Sunset**, and set an offset of `-00:30:00` — half an hour *before* sunset, when rooms start dimming. In **Then do**, add an action turning on your evening lights. Save it with a specific name — "Living room lights at dusk" beats "Lights automation" the day you have thirty of these.

```yaml
triggers:
  - trigger: sun
    event: sunset
    offset: "-00:30:00"
actions:
  - action: light.turn_on
    target:
      entity_id: light.living_room
```

> [!DETAILS] When sunset isn't dark yet
> Home Assistant computes sunset from the home location you set during onboarding — no configuration needed. But how long twilight lasts swings with the seasons, so a fixed offset that's perfect in December runs early in June. The docs' own suggestion for dusk automations: trigger on the sun's **elevation** dropping below an angle instead (a *numeric state* trigger on the sun entity's elevation attribute) — same idea, steadier result. The offset version is the right first draft; upgrade if summer annoys you.

### Blinds down after dark
Same trigger family, opposite direction, and your blinds from the *Home Assistant OS* guide's device layer get their first job:

```yaml
triggers:
  - trigger: sun
    event: sunset
    offset: "00:30:00"   # positive = after sunset
actions:
  - action: cover.close_cover
    target:
      entity_id: cover.bedroom_blinds
```

Every `cover` — blinds, shades, a garage door — answers to the same three verbs: `open_cover`, `close_cover`, and `set_cover_position` (0–100), so a "crack the blinds at sunrise" variant is the same build with `event: sunrise` and a position instead of a close.

### A porch light that notices people
The showpiece — two systems you built cooperating. The *Frigate* guide's Home Assistant integration created an *occupancy* sensor per camera per object: find yours under **Settings → Devices & services → Entities** (search "occupancy"; the *Frigate* guide's `driveway` camera gets a person sensor named like `binary_sensor.driveway_person_occupancy` — swap in your camera's name throughout). It sits `on` while Frigate sees at least one person in frame. Trigger on it:

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.driveway_person_occupancy
    to: "on"
actions:
  - action: light.turn_on
    target:
      entity_id: light.porch
  - action: notify.mobile_app_your_phone
    data:
      title: "Driveway"
      message: "Person in the driveway"
      data:
        image: "/api/camera_proxy/camera.driveway"
```

> [!NOTE]
> The notification action exists once the Home Assistant companion app is installed on your phone with notification permission granted — it appears as `notify.mobile_app_` plus your phone's name, underscored. `message` is the only required field. The nested `image` line attaches a live camera snapshot — that form is Android's; on an iPhone the companion docs attach the camera stream instead, with `entity_id: camera.driveway` in place of the `image` line.

> [!DETAILS] How trusting to be — Frigate's own honesty
> Frigate's documentation is candid about these sensors: occupancy sensors run "fewer checks" so latency stays low enough for lights — which means an occasional false positive. For a porch light, who cares; a wrongly-lit porch costs nothing. For something you'd hate to have cry wolf — an alarm, a loud announcement — Frigate recommends triggering from its `frigate/events` MQTT topic instead, which carries full event data (and unlocks event-specific snapshot URLs in notifications). That's the graduate course; the occupancy sensor is the right first build.

### Make a speaker greet the visitor
Same trigger, a louder action: when Frigate sees someone, have a speaker chime, play a clip, or speak a line. The one catch is *which* speaker — Home Assistant can only drive one it controls as a media player, which means a **Sonos** or a **Google/Nest (Cast)** speaker. A HomePod can't be the target; Home Assistant can't push audio to it.

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.driveway_person_occupancy
    to: "on"
actions:
  - action: media_player.volume_set
    target:
      entity_id: media_player.kitchen   # a Sonos or Cast speaker
    data:
      volume_level: 0.5
  - action: media_player.play_media
    target:
      entity_id: media_player.kitchen
    data:
      media_content_id: media-source://media_source/local/doorbell.mp3
      media_content_type: music
```

The `volume_set` first is a kindness — it stops a late-night visitor from blasting the house. Point `media_content_id` at a sound file you dropped in your `config/media` folder, or a service-specific id (a Sonos favorite, a radio URL) for actual music.

> [!DETAILS] Make it talk instead of chime
> Swap the play-media action for text-to-speech and the same trigger announces in words, on the same speaker:
>
> ```yaml
> actions:
>   - action: tts.speak
>     target:
>       entity_id: tts.home_assistant_cloud   # whichever TTS engine you set up
>     data:
>       media_player_entity_id: media_player.kitchen
>       message: "Someone is at the front door."
> ```
>
> The TTS engine is whatever you configured — the cloud voice, or a fully-local one like Piper. Either way the speaker has to be a media player Home Assistant controls, so the Sonos-or-Cast rule still holds.

> [!DETAILS] Trigger on the doorbell button instead
> Person-detection fires when someone *appears*; the doorbell button fires only when they actually *press it* — intentional, and free of false alarms. Once your doorbell is in Home Assistant, its press shows up as an entity you trigger on the same way, usually an `event` entity that updates on each ring:
>
> ```yaml
> triggers:
>   - trigger: state
>     entity_id: event.front_doorbell   # your doorbell's button-press entity
> ```
>
> Everything below the trigger stays identical — only what *starts* it changes. In the visual editor you'd add this as **Device → your doorbell → button pressed**, which writes the trigger for you. Honest caveat for an Aqara G410: it's a HomeKit/Matter-first doorbell and Aqara's Home Assistant support is thin, so exactly how its press surfaces won't be certain until it's set up — but the automation around it doesn't change. Many people wire up both triggers: a soft chime on approach, the full announcement on the actual ring.

## Make it yours

### Scenes — set the room, not the devices
A *scene* is a saved room state — these three lights at these brightnesses — that automations can recall by name. On **Settings → Automations & scenes**, the scenes view's **Add scene** button (lower right) opens an editor: add the devices, set them how "movie night" should look, save. Then any automation's **Then do** can activate it with the `scene.turn_on` action — your sunset automation can paint the whole room instead of switching one light.

> [!WARNING]
> The scene editor is live: while you're editing, it actually drives the devices to the scene's states so you can see what you're building, and restores them when you leave. Don't panic when the room changes around you.

### Test it without waiting for sunset
Two tools, both in the automation's three-dot menu. **Run actions** executes the Then-do half immediately, skipping triggers and conditions — the fast way to check the lights and notification actually fire. **Traces** is the time machine: Home Assistant keeps a step-by-step record of an automation's last 5 runs, drawn as a graph showing exactly which path ran and where it stopped. The first time an automation "didn't work," the trace almost always shows it worked precisely as written — just not as intended.

### Add an off-switch for exceptions
The house acting on its own is great until the one evening it shouldn't. Make a switch for that: **Settings → Devices & services → Helpers → Create helper → Toggle**, named something like "Guest mode". That toggle is now an entity any automation can consult — so open the porch automation, add a **State** condition under **And if** requiring Guest mode be *off*, and save. Now porch notifications hush while guests come and go, and flipping one switch beats disabling five automations (though every automation has an enable toggle too, right in the list). One condition, and the whole system gains manners. From here it's all variations: more triggers, more conditions, the Blueprint Exchange when you want ideas — the house is yours to teach.
