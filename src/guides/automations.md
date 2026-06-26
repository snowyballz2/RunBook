---
title: Automations
subtitle: The house starts doing things on its own
collection: Proxmox Home Server
order: 18
accent: violet
---

Seventeen guides of infrastructure, and now the payoff they were quietly building toward: the devices from the *Home Assistant OS* guide start acting without you. An automation is one sentence — *when* something happens, *then* do something — and this guide builds a stack of them, each a pattern you'll reuse for years: a light that follows motion, lights that follow the sun, blinds that follow the dark, a porch that notices people — and then the ones that earn their keep on the worst day, when a leak sensor trips and the house shuts off its own water before you've read the alert.

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

> [!DETAILS] The cry-wolf-proof upgrade — trigger on `frigate/events`
> Here's the graduate course the note above promised. Frigate publishes every detection to the `frigate/events` MQTT topic the moment it's confident — and because you already ran the MQTT broker setup in the *Frigate* guide, Home Assistant can listen on it directly. The payload is JSON, so you trigger on the topic and read fields out of it with a template. The payoff: each event carries its own `id`, which Frigate turns into a permanent snapshot URL — so the notification shows the exact frame that fired it, not a live view of an empty driveway three seconds later.
>
> ```yaml
> triggers:
>   - trigger: mqtt
>     topic: frigate/events
> conditions:
>   - condition: template
>     value_template: "{{ trigger.payload_json['type'] == 'new' }}"
>   - condition: template
>     value_template: "{{ trigger.payload_json['after']['label'] == 'person' }}"
> actions:
>   - action: notify.mobile_app_your_iphone
>     data:
>       title: "Frigate"
>       message: >-
>         {{ trigger.payload_json['after']['label'] | title }} seen on
>         {{ trigger.payload_json['after']['camera'] }}
>       data:
>         image: >-
>           https://your-frigate-host:5000/api/events/{{ trigger.payload_json['after']['id'] }}/snapshot.jpg
> ```
>
> The first condition keeps you to `type: new` so one person walking through doesn't notify you for every frame; the second filters to the label you care about. Swap `your-frigate-host` for however you reach Frigate (an internal IP, or its name behind the reverse proxy from the *Nginx Proxy Manager* guide). This is the same trigger that should feed any *loud* action — an alarm, a 2 a.m. announcement — for exactly the reason the note gave: it fires on Frigate's considered judgement, not its fast first guess.

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

## Track who's home

### Everybody left, everybody home
The companion app you installed for notifications in the *Voice Control* guide quietly hands you something else for free: a **device tracker** per phone. Find it under **Settings → Devices & services → Entities** (search "tracker"); it reads `home` or `not_home` as your phone comes and goes, and it's the most reliable presence signal a home network has. Presence is the backbone the next two sections stand on — once Home Assistant knows whether anyone's in, the lock and the thermostat can stop guessing.

Two automations, mirror images. Everybody-left runs when the *last* tracker flips away — so leave the front door behaving until the house is actually empty:

```yaml
alias: Everybody left
triggers:
  - trigger: state
    entity_id:
      - device_tracker.your_iphone
      - device_tracker.partner_iphone
    to: "not_home"
conditions:
  - condition: state
    entity_id: device_tracker.your_iphone
    state: "not_home"
  - condition: state
    entity_id: device_tracker.partner_iphone
    state: "not_home"
actions:
  - action: light.turn_off
    target:
      entity_id: all
  - action: lock.lock
    target:
      entity_id: lock.front_door
  - action: climate.set_temperature
    target:
      entity_id: climate.downstairs
    data:
      temperature: 16
```

The trigger fires whenever *either* phone leaves, but the two conditions are the gate: the actions only run when *both* read `not_home`. Coming back is the easy half — trigger on the first phone reaching `home` and welcome it:

```yaml
alias: Somebody home
triggers:
  - trigger: state
    entity_id:
      - device_tracker.your_iphone
      - device_tracker.partner_iphone
    to: "home"
actions:
  - action: light.turn_on
    target:
      entity_id: light.entryway
  - action: climate.set_temperature
    target:
      entity_id: climate.downstairs
    data:
      temperature: 21
```

> [!DETAILS] Auto-lock the Aqara U400
> The lock from the *Home Assistant OS* guide can look after itself. Three patterns, each useful on its own. Auto-lock a few minutes after the door is shut — trigger on the door sensor reading closed and holding for the **For** duration, then `lock.lock`:
>
> ```yaml
> alias: Auto-lock after door closes
> triggers:
>   - trigger: state
>     entity_id: binary_sensor.front_door_contact
>     to: "off"            # contact sensors read "off" when closed
>     for: "00:05:00"
> actions:
>   - action: lock.lock
>     target:
>       entity_id: lock.front_door
> ```
>
> Notify the moment it's *unlocked*, so an unexpected unlock reaches your phone — trigger on the lock's state going to `unlocked`:
>
> ```yaml
> triggers:
>   - trigger: state
>     entity_id: lock.front_door
>     to: "unlocked"
> actions:
>   - action: notify.mobile_app_your_iphone
>     data:
>       message: "Front door unlocked."
> ```
>
> And a left-unlocked reminder — the same `to: "unlocked"` trigger with a **For** of, say, ten minutes, paired with a `lock.lock` action if you'd rather it just fixed itself at night. Swap `lock.front_door` and `binary_sensor.front_door_contact` for your own entity names; the U400 comes into Home Assistant over Matter as covered in the *Home Assistant OS* guide.

> [!DETAILS] Climate setback on the ecobee
> The away/home pair above already nudges the thermostat, but you can make climate its own automation and let presence drive it — `climate.set_temperature` is the action, and the ecobee surfaces as a `climate.` entity. The genuinely money-saving addition is pausing the system when a window or door is open, so you're not heating the street:
>
> ```yaml
> alias: Pause HVAC on open window
> triggers:
>   - trigger: state
>     entity_id: binary_sensor.living_room_window
>     to: "on"             # contact sensors read "on" when open
>     for: "00:02:00"
> actions:
>   - action: climate.set_hvac_mode
>     target:
>       entity_id: climate.downstairs
>     data:
>       hvac_mode: "off"
> ```
>
> Pair it with the mirror automation — window closed, set the mode back to `heat` or `cool` — and the **For** keeps a quick airing-out from cycling the furnace. The two-minute hold is the same quiet hero from the motion light.

## Protect the house

Everything so far has been convenience — a light that saves you a switch, a porch that says hello. This section is different in kind: these run on the worst day, and the design rules invert. A porch light gated behind "only when we're away" is sensible. A safety action gated behind *anything* is a bug. The leak automation below is the showpiece of the whole guide for exactly that reason — it's the one that pays for the other seventeen.

### Water leak — shut off the main and shout
Your leak sensors and the water shut-off valve came online through the Zigbee2MQTT onboarding now in the *Home Assistant OS* guide. This automation wires them to each other: any sensor goes wet, the valve closes, and you find out loudly.

```yaml
alias: Water leak — shut off the main and alert
triggers:
  - trigger: state
    entity_id:
      - binary_sensor.under_sink_leak
      - binary_sensor.water_heater_leak
      - binary_sensor.washer_leak
    to: "on"
actions:
  - action: valve.close_valve
    target: { entity_id: valve.main_water }
  - action: notify.mobile_app_your_iphone
    data:
      title: "💧 Water leak"
      message: "Leak at {{ trigger.to_state.name }} — main water shut off."
      data:
        push:
          interruption-level: critical
          sound: { name: default, critical: 1, volume: 1.0 }
  - action: tts.speak
    target: { entity_id: tts.piper }
    data:
      media_player_entity_id: media_player.kitchen
      message: "Water leak detected at {{ trigger.to_state.name }}. The main water has been shut off."
mode: single
```

Why it works, top to bottom. The trigger lists every leak sensor under one roof — any one going `on` (wet) fires the whole thing, and `trigger.to_state.name` then carries *which* one into the alert, so the message and the spoken line both name the actual location without you writing three copies. The valve closes first, before any notification, because the point is to stop water, not to ask permission. Then two alerts in parallel registers: a **critical** push that reaches your phone wherever you are (next callout), and a `tts.speak` on the kitchen speaker for anyone home to hear it out loud — the local Piper voice from the *Voice Control* guide, so it works even if the internet is down with the leak.

Two design notes that deliberately break the rules the porch light taught you:

> [!WARNING]
> **No conditions — on purpose.** The porch automation earned a "only when we're away" gate, and that was right. This one has *no* `conditions` block, and adding one would be the mistake. A leak at 3 a.m. with everyone home, a leak while you're on holiday, a leak during "guest mode" — every one of them needs the water off. A safety action must never be suppressed by presence, time, or any toggle. Drive the valve straight off the raw sensors and resist the urge to be clever.

> [!DETAILS] The critical iOS notification recipe
> This is the block any safety alert should reuse, and it's why the leak message breaks through where an ordinary notification wouldn't. A plain `notify` respects silent mode, Focus, and Do Not Disturb — exactly the modes your phone is in at 3 a.m., which is exactly when a leak can't wait. The iOS companion app honours a small `push` override that bypasses all of it:
>
> ```yaml
> data:
>   push:
>     interruption-level: critical
>     sound:
>       name: default
>       critical: 1
>       volume: 1.0
> ```
>
> `interruption-level: critical` is the iOS flag that pierces Focus and silent mode; the `critical: 1` on the sound forces it to play at the `volume` you set regardless of the ringer switch. (The first time you send one, iOS asks permission to deliver critical alerts for the app — grant it.) This is iOS-only, and it's reserved for things that genuinely can't wait: a leak, smoke, a security trip. Use it for those and your critical alerts stay credible.

### Don't let a dead battery disarm your safety net
The leak automation has one silent failure mode: a leak sensor whose battery died months ago reports nothing, so a real leak never trips it and the valve never closes. The automation looks fine in the list and protects nothing. The fix is a sweep that watches the watchers — every battery entity in the house, alerting before any of them goes flat:

```yaml
alias: Low battery sweep
triggers:
  - trigger: time
    at: "09:00:00"
conditions:
  - condition: template
    value_template: >-
      {{ states.sensor
         | selectattr('attributes.device_class', 'eq', 'battery')
         | selectattr('state', 'is_number')
         | selectattr('state', 'lt', 20)
         | list | count > 0 }}
actions:
  - action: notify.mobile_app_your_iphone
    data:
      title: "🔋 Low battery"
      message: >-
        {{ states.sensor
           | selectattr('attributes.device_class', 'eq', 'battery')
           | selectattr('state', 'is_number')
           | selectattr('state', 'lt', 20)
           | map(attribute='name') | join(', ') }}
```

It runs once each morning, walks every sensor with a `battery` device class, keeps the ones reading below 20%, and only notifies if the list isn't empty — naming each low device so you know which coin cell to buy. No per-device setup: a battery sensor added next year is swept automatically. An ordinary notification is fine here; it's a chore reminder, not an emergency.

> [!TIP]
> Make the very first line of defence your leak and smoke sensors. A dead battery on a convenience sensor is an annoyance; a dead battery on the sensor guarding the valve quietly switches off the most important automation you own. Some people drop the threshold for those specific devices to 40% so the warning comes with plenty of runway.

## Make it yours

### Scenes — set the room, not the devices
A *scene* is a saved room state — these three lights at these brightnesses — that automations can recall by name. On **Settings → Automations & scenes**, the scenes view's **Add scene** button (lower right) opens an editor: add the devices, set them how "movie night" should look, save. Then any automation's **Then do** can activate it with the `scene.turn_on` action — your sunset automation can paint the whole room instead of switching one light.

> [!WARNING]
> The scene editor is live: while you're editing, it actually drives the devices to the scene's states so you can see what you're building, and restores them when you leave. Don't panic when the room changes around you.

### Test it without waiting for sunset
Two tools, both in the automation's three-dot menu. **Run actions** executes the Then-do half immediately, skipping triggers and conditions — the fast way to check the lights and notification actually fire. **Traces** is the time machine: Home Assistant keeps a step-by-step record of an automation's last 5 runs, drawn as a graph showing exactly which path ran and where it stopped. The first time an automation "didn't work," the trace almost always shows it worked precisely as written — just not as intended.

### Add an off-switch for exceptions
The house acting on its own is great until the one evening it shouldn't. Make a switch for that: **Settings → Devices & services → Helpers → Create helper → Toggle**, named something like "Guest mode". That toggle is now an entity any automation can consult — so open the porch automation, add a **State** condition under **And if** requiring Guest mode be *off*, and save. Now porch notifications hush while guests come and go, and flipping one switch beats disabling five automations (though every automation has an enable toggle too, right in the list). One condition, and the whole system gains manners. From here it's all variations: more triggers, more conditions, the Blueprint Exchange when you want ideas — the house is yours to teach.
