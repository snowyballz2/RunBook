---
title: Automations
subtitle: My Build — wiring the house to act on its own, starting with the leak that pays for everything
collection: My Build
order: 21
accent: emerald
---

The infrastructure is finished, and this is where the house starts doing things on its own. An automation is one sentence — *when* something happens, *then* do something — and this page builds a stack of them on the exact devices already onboarded: the dozen Third Reality leak sensors and the Aqara valve from the Zigbee mesh, the three Aqara U400 locks shared in over Matter, the two ecobees, the Reolink doorbell and camera through Frigate, and the Google/Nest speakers for announcements. The showpiece is the first one — a leak trips, the main water shuts off, and you find out loudly — and it is the automation that earns the other twenty pages.

> [!WARNING]
> Build the **water-leak** automation first, the day the valve is paired, before any convenience rule. It is the one that pays for the whole build. Everything else can wait.

## Learn the editor

### Open the automation editor
In Home Assistant at the pinned address, go to **Settings → Automations & scenes**, click **Create automation** (lower right), then **Create new automation**. An empty automation is three sections that read like the sentence they are: **When** (the trigger — the event that starts things), **And if** (optional conditions — extra tests that must also be true), and **Then do** (the actions). Build visually if you like; this page shows each finished rule as text, which is what the top-right menu's **Edit in YAML** displays.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!DETAILS] The three parts, a little deeper
> **Triggers** are events, and any one of several fires the rule. **Conditions** are gates checked *after* a trigger fires (only when home, only after dark); no conditions means the actions always run — which matters enormously for the leak rule below. **Actions** run in order: close a valve, lock a deadbolt, set a thermostat, push your phone, speak on a speaker. The **For** field on a state trigger is the quiet hero — the state must *hold* for the whole duration before the trigger fires, so a "door closed for 5 minutes" resets the moment someone reopens it.

## The one that matters

### Water leak — shut off the main and shout
The twelve **Third Reality 3RWS18BZ** leak sensors and the **Aqara Valve Controller T1** came online through Zigbee2MQTT, so they already exist as entities. This rule wires them together: any sensor goes wet, the valve closes the quarter-turn lever main, and you find out on every channel at once. Open **Settings → Devices & services → Entities** and substitute your real `binary_sensor.*_leak` names — list **all twelve**.

```yaml
alias: Water leak — shut off the main and alert
triggers:
  - trigger: state
    entity_id:
      - binary_sensor.water_heater_leak
      - binary_sensor.washer_leak
      - binary_sensor.dishwasher_leak
      - binary_sensor.kitchen_sink_leak
      # ... all twelve Third Reality sensors
    to: "on"
actions:
  - action: valve.close_valve
    target: { entity_id: valve.main_water }
  - action: notify.mobile_app_chris_iphone
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
      media_player_entity_id: media_player.kitchen_speaker
      message: "Water leak detected at {{ trigger.to_state.name }}. The main water has been shut off."
mode: single
```

Why it works, top to bottom. The trigger lists every leak sensor under one roof, so any one going `on` (wet) fires the whole thing, and `trigger.to_state.name` carries *which* sensor into the alert — so the push and the spoken line both name the actual location without you writing twelve copies. The valve closes **first**, before any notification, because the point is to stop water, not to ask permission. Then two alerts fire in parallel: a **critical** push that reaches your iPhone wherever you are, and a `tts.speak` on a Google/Nest speaker so anyone home hears it out loud. The speech uses the **local Piper** TTS (text-to-speech) engine running on the shared GTX 1080 Ti rather than a cloud voice, so it still talks during the internet outage a burst pipe might cause.

> [!WARNING]
> **No `conditions` block — on purpose.** A leak at 3 a.m. with everyone home, a leak while you are away, a leak during any "guest mode" — every one of them needs the water off. A safety action must never be suppressed by presence, time, or a toggle. Drive the valve straight off the raw sensors and resist the urge to be clever.

> [!DETAILS] The critical iOS notification recipe
> A plain notify respects silent mode, Focus, and Do Not Disturb — exactly the modes your phone is in at 3 a.m., which is exactly when a leak cannot wait. The iOS companion app honours a small `push` override that bypasses all of it, and it is the block any safety alert on this build should reuse:
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
> `interruption-level: critical` pierces Focus and silent mode; `critical: 1` on the sound forces it to play at the `volume` you set regardless of the ringer switch. The first time you send one, iOS asks permission to deliver critical alerts for the companion app — grant it, or the alert that matters most stays silent. Reserve this for things that genuinely cannot wait — leak, smoke, a security trip — and your critical alerts stay credible.

> [!TIP]
> The T1 clamps onto the quarter-turn **lever** main. Test with a real clean-water trip on a sensor and confirm the valve rotates the lever **fully closed** — not just that the entity flips to `closed`. The Third Reality 3RSP019BZ smart plugs near the sensor clusters and the valve are what keep the Zigbee mesh reaching them; a leak alert that cannot hop back to the ZBT-2 coordinator is worthless.

### Don't let a dead battery disarm the net
The leak rule has one silent failure mode: a sensor whose battery died months ago reports nothing, so a real leak never trips it and the valve never closes. The rule looks fine in the list and protects nothing. The fix is a once-a-morning sweep that watches the watchers — every battery entity in the house, with no per-device setup, so the twelve sensors, the valve, and the three locks are all covered, plus anything you add next year.

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
  - action: notify.mobile_app_chris_iphone
    data:
      title: "🔋 Low battery"
      message: >-
        {{ states.sensor
           | selectattr('attributes.device_class', 'eq', 'battery')
           | selectattr('state', 'is_number')
           | selectattr('state', 'lt', 20)
           | map(attribute='name') | join(', ') }}
```

It walks every sensor with a `battery` device class, keeps the ones under 20%, and only notifies if the list is non-empty — naming each low device so you know which coin cell to buy. An ordinary push is right here; it is a chore reminder, not an emergency.

> [!TIP]
> A dead battery on a convenience sensor is an annoyance; a dead battery on a leak sensor quietly switches off the most important automation you own. Bump the threshold for the **leak sensors specifically** to 40% so the warning on those comes with plenty of runway.

## Doors and presence

### Auto-lock the U400s and notify on unlock
The three **Aqara U400** deadbolts were commissioned into Apple Home for Home Key, then shared into Home Assistant over Matter's multi-admin, so each surfaces as a `lock.*` entity. Two patterns per lock. First, auto-lock a few minutes after the door is shut — trigger on the door's Third Reality contact sensor reading closed and holding, then `lock.lock`:

```yaml
alias: Auto-lock front door
triggers:
  - trigger: state
    entity_id: binary_sensor.front_door_contact
    to: "off"            # contact sensors read "off" when closed
    for: "00:05:00"
actions:
  - action: lock.lock
    target: { entity_id: lock.front_door }
```

Second, notify the moment a lock goes to `unlocked`, so an unexpected unlock reaches your phone:

```yaml
triggers:
  - trigger: state
    entity_id: lock.front_door
    to: "unlocked"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      message: "Front door unlocked."
```

Repeat both for `lock.back_door` and `lock.side_door` too (your real names from **Entities**), each watching its own contact sensor where one exists.

### Presence — everybody left, somebody home
The companion app on each iPhone hands you a **device tracker** for free — find them under **Entities** (search "tracker"); each reads `home` or `not_home` and is the most reliable presence signal a home network has. Build two mirror-image rules. Everybody-left triggers when *either* phone leaves, but the **conditions require both** to read `not_home` before acting, so the house only goes to away-mode when it is actually empty:

```yaml
alias: Everybody left
triggers:
  - trigger: state
    entity_id: [device_tracker.chris_iphone, device_tracker.partner_iphone]
    to: "not_home"
conditions:
  - condition: state
    entity_id: device_tracker.chris_iphone
    state: "not_home"
  - condition: state
    entity_id: device_tracker.partner_iphone
    state: "not_home"
actions:
  - action: light.turn_off
    target: { entity_id: all }
  - action: lock.lock
    target: { entity_id: [lock.front_door, lock.back_door, lock.side_door] }
  - action: climate.set_temperature
    target: { entity_id: climate.downstairs }
    data: { temperature: 16 }
```

Coming home is the easy half — trigger on the first phone reaching `home`, no conditions needed. Mirror the above with `to: "home"`, then turn on `light.entryway` and set the ecobee back to 21.

## Comfort and awareness

### ecobee setback and open-window pause
The presence pair above already nudges the **two ecobees** through `climate.set_temperature` on their `climate.*` entities — point them at the upstairs and downstairs ecobee. The money-saving addition is pausing a system when a window or door is open, so you are not heating the street. Trigger on a contact sensor holding open and turn the mode off:

```yaml
alias: Pause HVAC on open window
triggers:
  - trigger: state
    entity_id: binary_sensor.living_room_window
    to: "on"             # contact sensors read "on" when open
    for: "00:02:00"
actions:
  - action: climate.set_hvac_mode
    target: { entity_id: climate.downstairs }
    data: { hvac_mode: "off" }
```

Pair it with the mirror automation — window closed, set the mode back to `heat` or `cool` — and the two-minute **For** keeps a quick airing-out from cycling the furnace.

### Frigate person alerts
The **Reolink doorbell** and **RLC-510WA** run through Frigate with detection on the 1080 Ti. The Frigate integration gives you a quick `binary_sensor.*_person_occupancy` per camera, which is fine for switching a porch light — but for a *notification* build the graduate version that triggers on the **`frigate/events`** MQTT (Message Queuing Telemetry Transport) topic. It fires on Frigate's considered judgement rather than its fast first guess, and each event carries its own `id`, which Frigate turns into a permanent snapshot URL — so the push shows the exact frame that fired, not a live view of an empty driveway three seconds later. Frigate already shares Mosquitto with Zigbee2MQTT, so Home Assistant is listening on this topic.

```yaml
triggers:
  - trigger: mqtt
    topic: frigate/events
conditions:
  - condition: template
    value_template: "{{ trigger.payload_json['type'] == 'new' }}"
  - condition: template
    value_template: "{{ trigger.payload_json['after']['label'] == 'person' }}"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      title: "Frigate"
      message: >-
        {{ trigger.payload_json['after']['label'] | title }} seen on
        {{ trigger.payload_json['after']['camera'] }}
      data:
        image: >-
          http://FRIGATE-HOST:5000/api/events/{{ trigger.payload_json['after']['id'] }}/snapshot.jpg
```

The first condition keeps you to `type: new`, so one person walking through does not notify you for every frame; the second filters to the label you care about. Swap `FRIGATE-HOST` for Frigate's LAN (local area network) address — this is the internal Home Assistant integration path, so keep it on the container's IP and port `5000` rather than routing through Nginx Proxy Manager.

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52

> [!NOTE]
> A doorbell **press** is separate from person detection — intentional, and free of false alarms. The Reolink doorbell's button surfaces as an `event` entity you trigger the same way (`trigger: state` on `event.front_doorbell`), and everything below the trigger stays identical. Many people wire both: soft awareness on approach, the full announcement on the actual ring. The speaker-on-doorbell announcement is the worked example in the next callout below — reuse that pattern with this trigger.

> [!DETAILS] Make a speaker greet a visitor
> The same trigger can drive an announcement alongside the push. Home Assistant can only push audio to a media player it controls, which on this build means a **Google/Nest (Cast)** speaker — the HomePod mini cannot be a target. Set the volume first as a kindness to a late-night visitor, then speak with the local Piper voice so it still announces if the internet is down:
>
> ```yaml
> actions:
>   - action: media_player.volume_set
>     target: { entity_id: media_player.kitchen_speaker }
>     data: { volume_level: 0.4 }
>   - action: tts.speak
>     target: { entity_id: tts.piper }
>     data:
>       media_player_entity_id: media_player.kitchen_speaker
>       message: "Someone is at the front door."
> ```

## Make it yours

### Test without waiting for real events
Two tools live in each automation's three-dot menu. **Run actions** executes the Then-do half immediately, skipping triggers and conditions — the fast way to confirm the valve, the critical push, and the spoken line all fire. **Traces** keeps a step-by-step record of the last few runs, drawn as a graph showing exactly which path ran and where it stopped; the first time a rule "didn't work," the trace almost always shows it worked precisely as written, just not as intended.

> [!WARNING]
> **Run actions** on the leak rule will physically close the main water valve — that is the point of the test, but do it on purpose, not by accident, and re-open the valve afterward.

### An off-switch for exceptions, never for safety
The house acting on its own is great until the evening it should not. Make a toggle for that: **Settings → Devices & services → Helpers → Create helper → Toggle**, named "Guest mode". Add a **State** condition to the *porch and person* notifications requiring Guest mode be off, and visitor alerts hush while guests come and go. Gate convenience behind it freely — but **never** the leak valve, the auto-lock, or any safety action. Same rule, one last time so it sticks: a safety automation answers to the raw sensor and nothing else.
