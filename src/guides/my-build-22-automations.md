---
title: Automations
subtitle: My Build — wiring the house to act on its own, starting with the leak that pays for everything
collection: My Build
order: 22
accent: emerald
---

The infrastructure is finished, and this is where the house starts doing things on its own. An automation is one sentence — *when* something happens, *then* do something — and this page builds a stack of them on the devices already onboarded — the dozen Third Reality leak sensors and the Aqara valve from the Zigbee mesh, the three Aqara U400 locks commissioned over Matter, and the Reolink doorbell and camera through Frigate — plus the ecobee thermostats it onboards itself (the Lutron Caséta lights already came online on the Home Assistant page), and the Google/Nest speakers for announcements, which join later on the Voice page. The showpiece is the first one — a leak trips, the main water shuts off, and you find out loudly — and it is the automation that earns every other page in this build.

> [!WARNING]
> Build the **water-leak** automation first, the day the valve is paired, before any convenience rule. It is the one that pays for the whole build. Everything else can wait. The valve-close and the critical iPhone push work the moment you save it; the spoken announcement depends on Piper text-to-speech and a Cast speaker, which you set up later on the Voice page of this build — until then that one step quietly does nothing, so build the rule now anyway.

## Learn the editor

### Open the automation editor
1. In Home Assistant at the pinned address, go to **Settings → Automations & scenes**.
2. Click **Create automation** (lower right).
3. Click **Create new automation**.

An empty automation is three sections that read like the sentence they are: **When** (the trigger — the event that starts things), **And if** (optional conditions — extra tests that must also be true), and **Then do** (the actions). Build visually if you like; this page shows each finished rule as text, which is what the top-right menu's **Edit in YAML** displays.

Finishing any rule is the same two clicks:
1. Click **Save**.
2. Name it in the dialog that appears — that name becomes the YAML's `alias`.
3. Click **Save** again.

> [!INPUT] ha-ip | Home Assistant IP | 192.168.1.51

> [!DETAILS] The three parts, a little deeper
> **Triggers** are events, and any one of several fires the rule. **Conditions** are gates checked *after* a trigger fires (only when home, only after dark); no conditions means the actions always run — which matters enormously for the leak rule below. **Actions** run in order: close a valve, lock a deadbolt, set a thermostat, push your phone, speak on a speaker. The **For** field on a state trigger is the quiet hero — the state must *hold* for the whole duration before the trigger fires, so a "door closed for 5 minutes" resets the moment someone reopens it.

## The one that matters

### Water leak — shut off the main and shout
The twelve **Third Reality 3RWS18BZ** leak sensors and the **Aqara Valve Controller T1** came online through Zigbee2MQTT, so they already exist as entities. This rule wires them together: any sensor goes wet, the valve closes the quarter-turn lever main, and you find out on every channel at once.

1. Open **Settings → Devices & services → Entities**.
2. Substitute your real `binary_sensor.*_leak` names — list **all twelve**.

```yaml
alias: Water leak — shut off the main and alert
triggers:
  - trigger: event
    event_type: state_changed
conditions:
  - condition: template
    value_template: >-
      {{ trigger.event.data.new_state is not none
         and trigger.event.data.new_state.state == 'on'
         and trigger.event.data.new_state.attributes.device_class == 'moisture'
         and (trigger.event.data.old_state is none or trigger.event.data.old_state.state != 'on') }}
actions:
  - action: switch.turn_off
    target: { entity_id: switch.main_water }
  - action: notify.mobile_app_chris_iphone
    data:
      title: "💧 Water leak"
      message: "Leak at {{ trigger.event.data.new_state.name }} — main water shut off."
      data:
        push:
          interruption-level: critical
          sound: { name: default, critical: 1, volume: 1.0 }
  - action: tts.speak
    target: { entity_id: tts.piper }
    data:
      media_player_entity_id: media_player.kitchen_speaker
      message: "Water leak detected at {{ trigger.event.data.new_state.name }}. The main water has been shut off."
mode: parallel
```

Why it works, top to bottom. The trigger watches every state change in the house, and the condition keeps only a **moisture**-class sensor turning `on` (wet) — so all twelve leak sensors, and any you pair later, are covered without naming one, and `trigger.event.data.new_state.name` carries *which* sensor into the alert, so the push and the spoken line both name the actual location. `mode: parallel` lets two rooms alert at once. The valve closes **first**, before any notification, because the point is to stop water, not to ask permission. Then two alerts fire in parallel: a **critical** push that reaches your iPhone wherever you are, and a `tts.speak` on a Google/Nest speaker so anyone home hears it out loud. The speech uses the **local Piper** TTS (text-to-speech) engine — installed as an app on the Home Assistant VM on the Voice page — rather than a cloud voice, so it still talks during the internet outage a burst pipe might cause.

> [!NOTE]
> The `notify.mobile_app_chris_iphone` action exists only after the Home Assistant companion app — the one you installed and signed in on the Matter Locks page of this build — has been **opened on the iPhone and granted notification permission**. It then surfaces as `notify.mobile_app_` plus the phone's name, underscored (so `chris_iphone` becomes `notify.mobile_app_chris_iphone`). Without that permission the entity does not exist and will not autocomplete in the editor — and if you paste the YAML anyway, Home Assistant saves it but the notify step errors when it runs. Grant it before building this rule, since every automation on this page leans on it.

> [!NOTE]
> The spoken `tts.speak` step needs two things this build sets up later, on the Voice page: the **Piper** text-to-speech engine (which becomes the `tts.piper` entity) and a Google/Nest **Cast** speaker added to Home Assistant as a `media_player.*` entity. Until both exist, that one action fails silently while the valve-close and the critical push — the parts that actually matter — work from the moment you save. Build the rule the day the valve is paired; the spoken line starts working once you finish the Voice page. Your Google/Nest speakers are not in Home Assistant just because they are on the network — the Voice page adds them through **Settings → Devices & services → Add integration → Google Cast** so they surface as `media_player.*` targets (a HomePod cannot be a target — Home Assistant cannot push audio to it).

> [!WARNING]
> **No presence, time, or guest-mode condition — on purpose.** The rule's only condition is the moisture filter above. A leak at 3 a.m. with everyone home, a leak while you are away, a leak during any "guest mode" — every one of them needs the water off. A safety action must never be suppressed by presence, time, or a toggle. Drive the valve straight off the raw sensors and resist the urge to be clever.

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
> `interruption-level: critical` pierces Focus and silent mode; `critical: 1` on the sound forces it to play at the `volume` you set regardless of the ringer switch. iOS asks permission to deliver critical alerts when the companion app first requests notification access — if you declined it there, the alert that matters most arrives silently, with no second prompt.
>
> If that happened, fix it:
>
> 1. Go to **Settings → Apps → Home Assistant → Notifications → Critical Alerts** on the iPhone.
>
> Reserve this for things that genuinely cannot wait — leak, smoke, a security trip — and your critical alerts stay credible.

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
         | map(attribute='state') | map('float')
         | select('lt', 20) | list | count > 0 }}
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      title: "🔋 Low battery"
      message: >-
        {% set low = namespace(names=[]) %}
        {% for s in states.sensor
           | selectattr('attributes.device_class', 'eq', 'battery')
           | selectattr('state', 'is_number') %}
        {% if s.state | float < 20 %}
        {% set low.names = low.names + [s.name] %}
        {% endif %}
        {% endfor %}
        {{ low.names | join(', ') }}
```

It walks every sensor with a `battery` device class, keeps the ones under 20%, and only notifies if the list is non-empty — naming each low device so you know which coin cell to buy. The `float` conversions are load-bearing: an entity's state is always text in a template, and comparing text against the number 20 throws a template error instead of filtering. An ordinary push is right here; it is a chore reminder, not an emergency.

> [!TIP]
> A dead battery on a convenience sensor is an annoyance; a dead battery on a leak sensor quietly switches off the most important automation you own. Give the **leak sensors specifically** more runway: clone the sweep as a second automation whose templates list just the twelve leak-sensor battery entities (swap the `device_class` filter for their `entity_id`s) with the threshold raised to 40, so the warning on those arrives with months to spare.

### Two more guards for the leak net
A sensor that drops off the Zigbee mesh reads `unavailable`, not "low battery" — the sweep above never sees it, and the leak rule silently loses a room. This rule catches any moisture sensor that has been unreachable for an hour, by device class, so it covers all twelve without naming them:

```yaml
alias: Leak sensor offline
triggers:
  - trigger: template
    value_template: >-
      {{ states.binary_sensor | selectattr('attributes.device_class', 'eq', 'moisture')
         | selectattr('state', 'eq', 'unavailable') | list | count > 0 }}
    for: "01:00:00"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      title: "Leak sensor offline"
      message: >-
        {{ states.binary_sensor | selectattr('attributes.device_class', 'eq', 'moisture')
           | selectattr('state', 'eq', 'unavailable') | map(attribute='name') | join(', ') }} — the leak rule cannot see it.
mode: single
```

A motorised valve that never moves can seize, and the first time it is asked to close for real is the wrong time to find out. Once a month, at a quiet hour, close and reopen it:

```yaml
alias: Exercise the water valve monthly
triggers:
  - trigger: time
    at: "10:00:00"
conditions:
  - condition: template
    value_template: "{{ now().day == 1 }}"
  - condition: state
    entity_id: switch.main_water
    state: "on"
actions:
  - action: switch.turn_off
    target: { entity_id: switch.main_water }
  - delay: "00:00:30"
  - action: switch.turn_on
    target: { entity_id: switch.main_water }
  - action: notify.mobile_app_chris_iphone
    data:
      message: "Main water valve exercised — closed and reopened. If the pressure seems off today, check the valve."
mode: single
```

## Doors and presence

### Auto-lock the U400s and notify on unlock
The three **Aqara U400** deadbolts were commissioned directly into Home Assistant over Matter (per the Matter Locks page), so each surfaces as a `lock.*` entity. This build has **no door or window contact sensors** — the only Third Reality devices here are the leak sensors and the router plugs — so these rules trigger off the lock's *own* reported state instead of an external sensor. Three patterns per lock.

First, auto-lock a few minutes after the lock is opened — trigger on the lock holding `unlocked` for a few minutes, then re-lock it. This stands in for a door-closed sensor: if the deadbolt is left open, it secures itself.

```yaml
alias: Auto-lock any door
triggers:
  - trigger: state
    entity_id:
      - lock.front_door
      - lock.carport_door
      - lock.basement_door
    to: "unlocked"
    for: "00:05:00"
actions:
  - action: lock.lock
    target:
      entity_id: "{{ trigger.entity_id }}"
mode: parallel
```

Second, notify the moment a lock goes to `unlocked`, so an unexpected unlock reaches your phone right away:

```yaml
alias: Door unlocked
triggers:
  - trigger: state
    entity_id:
      - lock.front_door
      - lock.carport_door
      - lock.basement_door
    to: "unlocked"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      message: "{{ trigger.to_state.name }} unlocked."
mode: parallel
```

Third, a longer left-unlocked reminder — the same `unlocked` trigger held for, say, ten minutes, paired with a push so you get nudged (or just let the auto-lock above handle it silently). Pick whichever fits each door:

```yaml
alias: Door left unlocked
triggers:
  - trigger: state
    entity_id:
      - lock.front_door
      - lock.carport_door
      - lock.basement_door
    to: "unlocked"
    for: "00:10:00"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      message: "{{ trigger.to_state.name }} has been unlocked for 10 minutes."
mode: parallel
```

All three doors sit in every trigger, and `trigger.entity_id` and `trigger.to_state.name` let one rule serve whichever door fired — `mode: parallel` lets two doors run their own timers at the same time.

> [!TIP]
> If you later add a door/window **contact sensor** and pair it (the same way you joined the leak sensors), you can swap the auto-lock trigger to fire on the *door* closing and holding (`binary_sensor.front_door_contact` reading `off` `for: "00:05:00"`) for a more natural "lock after the door is shut" behaviour. An Aqara contact on the **Zigbee** mesh is the safe choice, since Zigbee already has mains-powered routers here; IKEA's **MYGGBETT** at $8 is the cheaper option once the Thread mesh has routers of its own. The build does not ship one, so the lock-state version above is the default.

### Watch the locks the way the storm taught
A power blip has a lock-specific aftermath this build has now lived through: Home Assistant comes back, the Matter subscription does not, and a lock sits there showing **connected** while commands time out — invisible until someone tries the door from an airport. Two watchdogs cover both shapes of the failure.

The restart watchdog fires whenever Home Assistant starts — which is exactly when subscriptions go stale — and lands the nudge when a thirty-second check is actually worth doing:

```yaml
alias: Restart watchdog — check the locks
triggers:
  - trigger: homeassistant
    event: start
actions:
  - delay: "00:03:00"
  - action: notify.mobile_app_chris_iphone
    data:
      title: Home Assistant restarted
      message: >-
        If this follows a power blip, open each lock in the app and confirm a
        live status — a stale lock still shows connected but times out.
        Fix: Settings → Devices & Services → Matter → Reload.
mode: single
```

The offline watchdog covers the honest failure, where a lock drops off outright:

```yaml
alias: Lock offline for 10 minutes
triggers:
  - trigger: state
    entity_id:
      - lock.front_door
      - lock.carport_door
      - lock.basement_door
    to: unavailable
    for: "00:10:00"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      title: "Lock offline: {{ trigger.to_state.attributes.friendly_name }}"
      message: Unavailable for 10 minutes. Matter → Reload usually revives it; the keypad works regardless.
mode: parallel
```

`mode: parallel` lets two doors alert independently instead of the second swallowing the first. The honest limit, stated plainly: the offline watchdog cannot see the connected-but-stale mode — that entity never reads unavailable — which is why the restart watchdog exists; power events are that mode's known trigger. The outage itself already has a voice from the UPS & Safe Shutdown page; these two cover its aftermath. And through all of it, the keypads never depended on Home Assistant — the codes live in the locks.

### Give the power outage a voice
The UPS & Safe Shutdown page taught NUT to shut the server down cleanly; this tells your phone the moment the house loses power, and again when it comes back.

1. Open **Settings → Devices & services → NUT** and find the **Status Data** entity — its ID should read `sensor.cyberpower_status_data`; if yours differs, use that name below.
2. Paste the rule:

```yaml
alias: Power — on battery and restored
triggers:
  - trigger: template
    value_template: "{{ 'OB' in states('sensor.cyberpower_status_data') }}"
    id: on_battery
  - trigger: template
    value_template: "{{ 'OL' in states('sensor.cyberpower_status_data') }}"
    id: restored
actions:
  - choose:
      - conditions: "{{ trigger.id == 'on_battery' }}"
        sequence:
          - action: notify.mobile_app_chris_iphone
            data:
              title: "⚡ Power out"
              message: "The UPS is on battery. NUT shuts the server down cleanly if it runs low."
              data:
                push:
                  interruption-level: time-sensitive
      - conditions: "{{ trigger.id == 'restored' }}"
        sequence:
          - action: notify.mobile_app_chris_iphone
            data:
              message: "Power restored — the UPS is back on line power."
mode: queued
```

> [!NOTE]
> A short blip sends both messages a few seconds apart, which is exactly the record you want. If an outage runs long enough for NUT to shut the server down, "restored" never sends — Home Assistant boots back up already on line power, so there is no transition to catch; the restart watchdog above is the nudge that arrives instead.

### Onboard the thermostats
The presence rules below reach for `climate.*` and `light.*` entities. The Caséta `light.*` entities already exist — you added the Lutron Caséta bridge back on the Home Assistant & Zigbee2MQTT page. The one integration still missing is the **ecobee thermostats**, so add it here — **Settings → Devices & services → Add integration → ecobee**, then its dialog field by field:

- **API key** → **leave it blank**. The field still appears, but since Home Assistant 2026.3 no developer key is needed
- **Username / Password** → your ecobee account's — a cloud integration, so the account must actually work
- **6-digit authenticator code** → only if the account has MFA enabled; authenticator-app codes are the only kind the integration supports

Then note the two `climate.*` entity names it creates (the rules below use `climate.downstairs`; substitute your real names). The Caséta dimmers are already `light.*` entities from that earlier step, ready for the presence rules here and the scenes at the end of this page.

### Presence — everybody left, somebody home
The companion app on each iPhone hands you a **device tracker** for free. So far only one phone has the app — the iPhone from the Matter Locks page.

1. Have the second person install the **Home Assistant companion app** on their iPhone.
2. Have them sign in — ideally as their own user, created under **Settings → People** — and their tracker appears too.
3. Find both trackers under **Entities** (search "tracker"); each reads `home` or `not_home` and is the most reliable presence signal a home network has.

Build two mirror-image rules. Everybody-left triggers when *either* phone leaves, but the **conditions require both** to read `not_home` before acting, so the house only goes to away-mode when it is actually empty:

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
    target: { entity_id: [lock.carport_door, lock.front_door, lock.basement_door] }
  - action: climate.set_temperature
    target: { entity_id: climate.downstairs }
    data: { temperature: 62 }
  - if:
      - condition: state
        entity_id: binary_sensor.sliding_door
        state: "on"
    then:
      - action: notify.mobile_app_chris_iphone
        data:
          message: "Sliding door is open and nobody is home."
```

The last block is why the sliding glass door gets a **MYGGBETT** contact sensor. The three deadbolts lock themselves on the line above, but the slider has no smart hardware and cannot be closed remotely — so the only useful action is to tell you before you are too far away to turn around. Confirm the entity's real name under **Entities** after you pair it; the guide assumes you renamed it to `binary_sensor.sliding_door`.

Coming home is the easy half — no conditions needed.

```yaml
alias: Somebody home
triggers:
  - trigger: state
    entity_id: [device_tracker.chris_iphone, device_tracker.partner_iphone]
    to: "home"
actions:
  - action: light.turn_on
    target: { entity_id: light.entryway }
  - action: climate.set_temperature
    target: { entity_id: climate.downstairs }
    data: { temperature: 70 }
mode: single
```

> [!NOTE]
> Both numbers are **Fahrenheit** — this install runs US units, so `temperature:` values are °F (a °C-configured install would use 17 and 21; a Celsius value on this one would clamp the thermostat to its floor).

### The house at night and away
Four rules that use the contacts, locks, and presence the pages above already set up. Bedtime locks every door and reports anything still open:

```yaml
alias: Goodnight lockdown
triggers:
  - trigger: time
    at: "22:30:00"
actions:
  - action: lock.lock
    target:
      entity_id: [lock.front_door, lock.carport_door, lock.basement_door]
  - if:
      - condition: or
        conditions:
          - condition: state
            entity_id: binary_sensor.front_door_contact
            state: "on"
          - condition: state
            entity_id: binary_sensor.sliding_door
            state: "on"
          - condition: state
            entity_id: binary_sensor.living_room_window
            state: "on"
    then:
      - action: notify.mobile_app_chris_iphone
        data:
          title: "Still open at bedtime"
          message: >-
            {{ expand('binary_sensor.front_door_contact', 'binary_sensor.sliding_door', 'binary_sensor.living_room_window')
               | selectattr('state', 'eq', 'on') | map(attribute='name') | join(', ') }}
mode: single
```

With nobody home, any door or window opening — or any lock unlocking — is worth a critical alert, the same interruption level the leak rule uses. Guest mode is the off-switch for the evening a friend is house-sitting:

```yaml
alias: Away — door or window opened
triggers:
  - trigger: state
    entity_id:
      - binary_sensor.front_door_contact
      - binary_sensor.sliding_door
      - binary_sensor.living_room_window
    to: "on"
  - trigger: state
    entity_id: [lock.front_door, lock.carport_door, lock.basement_door]
    to: "unlocked"
conditions:
  - condition: state
    entity_id: device_tracker.chris_iphone
    state: "not_home"
  - condition: state
    entity_id: device_tracker.partner_iphone
    state: "not_home"
  - condition: state
    entity_id: input_boolean.guest_mode
    state: "off"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      title: "🚨 Nobody home"
      message: "{{ trigger.to_state.name }} — {{ trigger.to_state.state }}."
      data:
        push:
          interruption-level: critical
          sound: { name: default, critical: 1, volume: 1.0 }
mode: parallel
```

A door left open is a quieter problem — conditioned air leaving, or a door nobody remembers opening:

```yaml
alias: Door left open
triggers:
  - trigger: state
    entity_id: [binary_sensor.front_door_contact, binary_sensor.sliding_door]
    to: "on"
    for: "00:10:00"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      message: "{{ trigger.to_state.name }} has been open for 10 minutes."
mode: parallel
```

And the doorbell, which the Reolink integration exposes as a visitor sensor, reaches both your phone and the kitchen:

```yaml
alias: Doorbell pressed
triggers:
  - trigger: state
    entity_id: binary_sensor.front_doorbell_visitor
    to: "on"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      title: "🔔 Front door"
      message: "Someone pressed the doorbell."
  - action: tts.speak
    target: { entity_id: tts.piper }
    data:
      media_player_entity_id: media_player.kitchen_speaker
      message: "Someone is at the front door."
mode: single
```

## Comfort and awareness

### ecobee setback and an optional open-window pause
The presence pair above already nudges the **two ecobees** through `climate.set_temperature` on their `climate.*` entities — point them at the upstairs and downstairs entities the ecobee integration created when you added it before the presence rules. That setback alone is the comfort-and-savings win this build ships with.

> [!NOTE]
> **Optional.** A money-saving extra is pausing a system when a door is open, so you are not heating the street. The build's one contact sensor is the **MYGGBETT** on the sliding glass door, which is the opening most likely to be left ajar, so point the rule at that. For windows as well, add more contacts — an Aqara contact on the **Zigbee** mesh or another MYGGBETT on Thread, whichever mesh reaches that room — and rename each to something like `binary_sensor.living_room_window`. Trigger on it holding open and turn the mode off:
>
> ```yaml
> alias: Pause HVAC on open window
> triggers:
>   - trigger: state
>     entity_id: binary_sensor.sliding_door
>     to: "on"
>     for: "00:02:00"
> actions:
>   - action: climate.set_hvac_mode
>     target: { entity_id: climate.downstairs }
>     data: { hvac_mode: "off" }
> ```
>
> A contact sensor reads `on` when open — that is what the trigger matches. Pair it with the mirror automation — door closed, set the mode back to `heat` or `cool` — and the two-minute **For** keeps a quick airing-out from cycling the furnace.

### Frigate person alerts
The **Reolink doorbell**, the **RLC-510WA**, and the five **EmpireTech cameras** run through Frigate with detection on the 1080 Ti. The Frigate integration gives you a quick `binary_sensor.*_person_occupancy` per camera, which is fine for switching a porch light — but for a *notification* build the graduate version that triggers on the **`frigate/events`** MQTT (MQ Telemetry Transport) topic. It fires on Frigate's considered judgement rather than its fast first guess, and each event carries its own `id`, which Frigate turns into a permanent snapshot URL — so the push shows the exact frame that fired, not a live view of an empty driveway three seconds later. Frigate already shares Mosquitto with Zigbee2MQTT, so Home Assistant is listening on this topic.

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
          /api/frigate/notifications/{{ trigger.payload_json['after']['id'] }}/snapshot.jpg
```

The first condition keeps you to `type: new`, so one person walking through does not notify you for every frame; the second filters to the label you care about. The `image` line is the subtle one: the picture is downloaded by **the phone**, not by Home Assistant — so a Frigate address would fail twice on this build (the firewall fence admits only HA and Kuma to port 5000, and a LAN IP is unreachable when you are away). The Frigate integration publishes a notification proxy on Home Assistant itself for exactly this, and the **relative** path above resolves against whatever address the phone reached HA on — which works at home and over the tailnet alike. The same proxy also serves `/thumbnail.jpg` and `/clip.mp4` per event id, if you ever want the smaller image or the video in a tap-through.

> [!INPUT] frigate-ip | Frigate container IP | 192.168.1.52

> [!NOTE]
> A doorbell **press** is separate from person detection — intentional, and free of false alarms. But the press entity is **not** created by the go2rtc/Frigate setup from the Cameras page: that gives you a video feed and person detection, not the button's own entity. To get the press entity you must add the **Reolink Home Assistant integration** — the extra connection the Cameras page flagged as a possible dropout risk, so add it carefully and watch the Frigate logs after:
>
> 1. Go to **Settings → Devices & services → Add integration → Reolink**.
> 2. Fill in its dialog: **Host** → `192.168.1.70`, the doorbell's **Username**, and its **Password**.
>
> Once it is in, the ring surfaces as a **"Visitor" binary sensor** (something like `binary_sensor.front_doorbell_visitor` — the integration exposes the press this way, not as an `event` entity), and the trigger is the same shape as everything else on this page: `trigger: state` on that sensor, `to: "on"`. Confirm the exact entity name under **Entities** before you reference it. If a press ever lands seconds late, know the delivery ladder: the integration prefers TCP push, then ONVIF push, then long polling, then plain 5-second polling — and Reolink hardware cannot push ONVIF events to an HTTPS address, one more reason HA stays plain HTTP inside the LAN. Many people wire both: soft awareness on approach, the full announcement on the actual ring. The speaker-on-doorbell announcement is the worked example in the next callout below — reuse that pattern with this trigger.

> [!DETAILS] Make a speaker greet a visitor
> The same trigger can drive an announcement alongside the push. Home Assistant can only push audio to a media player it controls, which on this build means a **Google/Nest (Cast)** speaker added via **Settings → Devices & services → Add integration → Google Cast** so it surfaces as a `media_player.*` entity — the HomePod mini cannot be a target. This relies on the same Piper engine and Cast speaker the leak rule's spoken line does, both set up on the Voice page later in this build. Set the volume first as a kindness to a late-night visitor, then speak with the local Piper voice so it still announces if the internet is down:
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
>
> Prefer a simple ding over a spoken line? Swap the `tts.speak` action for `media_player.play_media`, pointing `media_content_id` at a sound file you dropped in Home Assistant's `config/media` folder:
>
> ```yaml
>   - action: media_player.play_media
>     target: { entity_id: media_player.kitchen_speaker }
>     data:
>       media_content_id: media-source://media_source/local/doorbell.mp3
>       media_content_type: music
> ```

## Motorized shades

Every shade in this build is a **SmartWings** — most **PoE** (wired), a few **battery**. Both are Matter under the hood, so Home Assistant sees one uniform set of `cover` entities: identical open/close/set-position controls whether the motor is wired or battery.

### Two SmartWings flavours, one control surface — and nothing to lock down
Unlike a camera — which must be an IP device and usually drags a cloud along — a shade sends only tiny commands, so it rides **Matter**, which is local by design: Home Assistant drives it directly with no cloud to phone home to and nothing to isolate. SmartWings sells that Matter in two forms you mix freely:

- **PoE "Matter over Ethernet"** — the pick for most windows. Power *and* Matter control down one Cat6 run, no batteries. It is a wired IP device on your flat LAN.
- **Battery "Matter over Thread"** — for the few windows where pulling a cable is not worth it. Same Matter, carried wirelessly over the Thread mesh.

Either way, every motor commissions into the *same* Home Assistant Matter controller and lands as an identical `cover` entity, so a mixed PoE-and-battery fleet is one set of shades in HA.

> [!NOTE]
> **The PoE Matter shades are the exception to the camera lockdown rule.** They *are* IP devices on your flat LAN, but Matter is local — Home Assistant drives them with no cloud, so they need no internet lockdown. Belt-and-suspenders, you *can* give one a static IP with a blank gateway and it keeps working; optional, not required. Do keep them on the **same flat subnet** as Home Assistant — Matter over Ethernet finds its controller by mDNS, which does not cross subnets.

> [!NOTE]
> **The battery (Thread) shades ride the Thread mesh, not the wired LAN** — so they lean on **Home Assistant's own OpenThread Border Router** (the second ZBT-2 you stood up on the Matter Locks page), the same one carrying the locks. A battery Matter shade is a low-power *sleepy end-device* that does not repeat the mesh, and a single border router does not blanket a house — so keep the battery shades within solid range of the radio, or add a mains-powered Thread router near a far one. A HomePod added later becomes a second border router and helps. Most of your shades are PoE (wired, no Thread), so the Thread footprint stays light.

### Split the PoE shades and cameras across the two switches
PoE shades and PoE cameras both pull from the switch, so divide them by what each needs:

- **PoE cameras → the managed 8-port GS308EPP**, whose per-port PoE control lets you power-cycle a frozen camera from software (or from an HA automation).
- **PoE shades → the 24-port VIMIN VM-GS2420P** (26 ports: 24 PoE + 2 gigabit uplinks — the router feeds one uplink, the GS308EPP hangs off the other). Its **320 W** budget is almost entirely the shades', since the cameras sit on the other switch. Each shade is one port plus one Cat6 run to the window, punched down on the patch panel and patched across.

A motor draws almost nothing idle and only a modest amount while moving, so 320 W covers a whole house of shades. The one time you near the budget is a scene that moves *every* shade at once — with many shades, stagger the close-all below into small groups a second apart so the motors never all peak together.

### Run one Cat6 to each PoE shade
Every PoE shade needs its **own Cat6 run** back to the switch.

1. Join the motor's short **7.5-inch (19 cm) Ethernet pigtail** to the in-wall cable with a **Cat6A inline coupler**.
2. Plan the **cable exit before the drywall closes**: **inside-mount** shades bring it out at the **head jamb**, **outside-mount** shades out the **rear of the motor cover**.
3. Give each shade a dedicated run (a dual shade needs two); two motors *can* share one run through an Ethernet splitter, but a run per shade is cleaner.
4. Terminate every run on the 48-port patch panel.
5. Patch each one across to the 24-port switch.

> [!NOTE]
> The motor is **802.3af/at** and draws about **5 W** (120–150 µA idle) over runs up to **100 m (328 ft)**, which is why a whole house of them barely dents the 320 W budget. SmartWings ships a full PoE wiring guide with the shades; this matches it.

### Onboard the shades
Both kinds land as `cover.*` entities, commissioned straight into Home Assistant's Matter controller — no Apple Home, no vendor app:

- In the **Home Assistant companion app**:
  1. Go to **Settings → Devices & services → Matter**.
  2. Tap **Add device**.
  3. Choose **"No, it's new."**
  4. Scan the shade's QR pairing code (**More options…** takes a typed code instead).
  5. Confirm **Add to Home Assistant**.
- Give each PoE shade a **DHCP reservation** so its address never moves.

> [!NOTE]
> **Add integration → Matter** is only the one-time server setup, done back on the Matter Locks page — it dead-ends on an already-configured integration. A **PoE (Ethernet) shade** joins over the wired LAN; a **battery (Thread) shade** joins over Home Assistant's OpenThread Border Router — the phone's Bluetooth does the handshake and hands over the Thread credentials, exactly like the locks.

### Group them and drive them as one
Make one group so PoE-vs-battery stops mattering, then automate the group.

1. Go to **Settings → Devices & services → Helpers → Create helper → Group → Cover group**.
2. Add every shade entity.
3. Name it `cover.all_shades`.

Now a single rule closes the whole house at sunset:

```yaml
alias: Shades — close at sunset
triggers:
  - trigger: sun
    event: sunset
    offset: "-00:15:00"
actions:
  - action: cover.close_cover
    target:
      entity_id: cover.all_shades
```

The morning open waits for both daylight and a civilised hour, so a June sunrise never opens the house at five:

```yaml
alias: Shades — open in the morning
triggers:
  - trigger: sun
    event: sunrise
    offset: "00:30:00"
  - trigger: time
    at: "07:30:00"
conditions:
  - condition: time
    after: "07:00:00"
  - condition: state
    entity_id: sun.sun
    state: above_horizon
actions:
  - action: cover.open_cover
    target:
      entity_id: cover.all_shades
mode: single
```

Following the sun through the day needs a second group — only the windows that take direct sun:

1. Go to **Settings → Devices & services → Helpers → Create helper → Group → Cover group**.
2. Add only the shades on windows that get direct sun.
3. Name it `cover.sun_facing_shades`.

This rule checks the sun's position every ten minutes, lowers those shades to 30% while the sun is in the window, and opens them again once it has moved on:

```yaml
alias: Shades — follow the sun
triggers:
  - trigger: time_pattern
    minutes: "/10"
conditions:
  - condition: state
    entity_id: sun.sun
    state: above_horizon
  - condition: state
    entity_id: input_boolean.guest_mode
    state: "off"
actions:
  - choose:
      - conditions:
          - condition: numeric_state
            entity_id: sun.sun
            attribute: azimuth
            above: 150
            below: 270
          - condition: numeric_state
            entity_id: sun.sun
            attribute: elevation
            above: 10
            below: 45
        sequence:
          - action: cover.set_cover_position
            target:
              entity_id: cover.sun_facing_shades
            data:
              position: 30
    default:
      - action: cover.open_cover
        target:
          entity_id: cover.sun_facing_shades
mode: single
```

> [!NOTE]
> Two numbers are yours to set. **Azimuth** is the sun's compass bearing: `150`–`270` covers south through west, where afternoon glare lives; east-facing windows want roughly `60`–`120`, south alone `150`–`210`. **Elevation** is the sun's height: below `10°` it is behind trees and neighbours, above `45°` it is too high to reach far into a room. The rule re-asserts the daytime position every ten minutes, so a shade lowered by hand during the day comes back up — flip **Guest mode** on for the afternoon and the rule stands down, the same off-switch as the rest of the house.

When a fixed clock beats the sun — school mornings, a set bedtime — swap the sun trigger for a time trigger with a weekday condition:

```yaml
alias: Shades — close at bedtime on school nights
triggers:
  - trigger: time
    at: "21:30:00"
conditions:
  - condition: time
    weekday:
      - sun
      - mon
      - tue
      - wed
      - thu
actions:
  - action: cover.close_cover
    target:
      entity_id: cover.all_shades
mode: single
```

> [!TIP]
> Drive shades with **`cover.set_cover_position`** (0–100) rather than the vendor app — one action covers every shade, PoE or battery, in the house. If a close-all ever browns a motor out on the PoE budget, split `cover.all_shades` into two smaller groups and close them a second apart.

## Make it yours

### Scenes — set the room, not the devices
A **scene** is a saved room state — these lights at these brightnesses, the Lutron Caseta dimmers just so — that any automation can recall by name.

1. Go to **Settings → Automations & scenes**.
2. Click the scenes view's **Add scene** button (lower right) to open the editor.
3. Add the devices.
4. Set them how "movie night" should look.
5. Save.

Then any automation's **Then do** can activate the scene with the `scene.turn_on` action — so a single trigger paints a whole room instead of switching one light.

> [!WARNING]
> The scene editor is **live**: while you edit, it actually drives the real devices to the scene's states so you can see what you are building, and restores them when you leave. Do not panic when the room changes around you — that is the editor showing its work, not an automation firing.

### Test without waiting for real events
Two tools live in each automation's three-dot menu. **Run actions** executes the Then-do half immediately, skipping triggers and conditions — the fast way to confirm the valve, the critical push, and the spoken line all fire. **Traces** keeps a step-by-step record of the last few runs, drawn as a graph showing exactly which path ran and where it stopped; the first time a rule "didn't work," the trace almost always shows it worked precisely as written, just not as intended.

> [!WARNING]
> **Run actions** on the leak rule will physically close the main water valve — that is the point of the test, but do it on purpose, not by accident, and re-open the valve afterward.

### An off-switch for exceptions, never for safety
The house acting on its own is great until the evening it should not. Make a toggle for that.

1. Go to **Settings → Devices & services → Helpers → Create helper → Toggle**.
2. Name it "Guest mode".
3. Add a **State** condition to the **Frigate person alert and the doorbell announcement** requiring Guest mode be off — visitor alerts hush while guests come and go.

> [!WARNING]
> Gate convenience behind Guest mode freely — but **never** the leak valve, the auto-lock, or any safety action. Same rule, one last time so it sticks: a safety automation answers to the raw sensor and nothing else.
