---
title: Automations
subtitle: My Build — wiring the house to act on its own, starting with the leak that pays for everything
collection: My Build
order: 22
accent: emerald
---

The infrastructure is finished, and this is where the house starts doing things on its own. An automation is one sentence — *when* something happens, *then* do something — and this page builds a stack of them on the devices already onboarded — the dozen Third Reality leak sensors and the Aqara valve from the Zigbee mesh, the three Aqara U400 locks commissioned over Matter, and the Reolink doorbell and camera through Frigate — plus two it onboards itself, the ecobee thermostats and the Lutron Caséta lights, and the Google/Nest speakers for announcements, which join later on the Voice page. The showpiece is the first one — a leak trips, the main water shuts off, and you find out loudly — and it is the automation that earns every other page in this build.

> [!WARNING]
> Build the **water-leak** automation first, the day the valve is paired, before any convenience rule. It is the one that pays for the whole build. Everything else can wait. The valve-close and the critical iPhone push work the moment you save it; the spoken announcement depends on Piper text-to-speech and a Cast speaker, which you set up later on the Voice page of this build — until then that one step quietly does nothing, so build the rule now anyway.

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

Why it works, top to bottom. The trigger lists every leak sensor under one roof, so any one going `on` (wet) fires the whole thing, and `trigger.to_state.name` carries *which* sensor into the alert — so the push and the spoken line both name the actual location without you writing twelve copies. The valve closes **first**, before any notification, because the point is to stop water, not to ask permission. Then two alerts fire in parallel: a **critical** push that reaches your iPhone wherever you are, and a `tts.speak` on a Google/Nest speaker so anyone home hears it out loud. The speech uses the **local Piper** TTS (text-to-speech) engine — installed as an add-on on the Home Assistant VM on the Voice page — rather than a cloud voice, so it still talks during the internet outage a burst pipe might cause.

> [!NOTE]
> The `notify.mobile_app_chris_iphone` action exists only after the Home Assistant companion app — the one you installed and signed in on the Matter Locks page of this build — has been **opened on the iPhone and granted notification permission**. It then surfaces as `notify.mobile_app_` plus the phone's name, underscored (so `chris_iphone` becomes `notify.mobile_app_chris_iphone`). Without that permission the entity does not exist, it will not autocomplete in the editor, and the rule will not save. Grant it before building this rule, since every automation on this page leans on it.

> [!NOTE]
> The spoken `tts.speak` step needs two things this build sets up later, on the Voice page: the **Piper** text-to-speech engine (which becomes the `tts.piper` entity) and a Google/Nest **Cast** speaker added to Home Assistant as a `media_player.*` entity. Until both exist, that one action fails silently while the valve-close and the critical push — the parts that actually matter — work from the moment you save. Build the rule the day the valve is paired; the spoken line starts working once you finish the Voice page. Your Google/Nest speakers are not in Home Assistant just because they are on the network — the Voice page adds them through **Settings → Devices & services → Add integration → Google Cast** so they surface as `media_player.*` targets (a HomePod cannot be a target — Home Assistant cannot push audio to it).

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

## Doors and presence

### Auto-lock the U400s and notify on unlock
The three **Aqara U400** deadbolts were commissioned directly into Home Assistant over Matter (per the Matter Locks page), so each surfaces as a `lock.*` entity. This build has **no door or window contact sensors** — the only Third Reality devices here are the leak sensors and the router plugs — so these rules trigger off the lock's *own* reported state instead of an external sensor. Three patterns per lock.

First, auto-lock a few minutes after the lock is opened — trigger on the lock holding `unlocked` for a few minutes, then re-lock it. This stands in for a door-closed sensor: if the deadbolt is left open, it secures itself.

```yaml
alias: Auto-lock front door
triggers:
  - trigger: state
    entity_id: lock.front_door
    to: "unlocked"
    for: "00:05:00"
actions:
  - action: lock.lock
    target: { entity_id: lock.front_door }
```

Second, notify the moment a lock goes to `unlocked`, so an unexpected unlock reaches your phone right away:

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

Third, a longer left-unlocked reminder — the same `unlocked` trigger held for, say, ten minutes, paired with a push so you get nudged (or just let the auto-lock above handle it silently). Pick whichever fits each door:

```yaml
alias: Front door left unlocked
triggers:
  - trigger: state
    entity_id: lock.front_door
    to: "unlocked"
    for: "00:10:00"
actions:
  - action: notify.mobile_app_chris_iphone
    data:
      message: "Front door has been unlocked for 10 minutes."
```

Repeat the patterns you want for `lock.side_door` and `lock.garage_door` too — the Side and Garage locks from the Matter Locks page (your real names from **Entities**).

> [!TIP]
> If you later add an Aqara door/window **contact sensor** to the Zigbee mesh and pair it (the same way you joined the leak sensors), you can swap the auto-lock trigger to fire on the *door* closing and holding (`binary_sensor.front_door_contact` reading `off` `for: "00:05:00"`) for a more natural "lock after the door is shut" behaviour. The build does not ship one, so the lock-state version above is the default.

### Onboard the thermostats
The presence rules below reach for `climate.*` and `light.*` entities. The Caséta `light.*` entities already exist — you added the Lutron Caséta bridge back on the Home Assistant & Zigbee2MQTT page. The one integration still missing is the **ecobee thermostats**, so add it here: in **Settings → Devices & services → Add integration**, add **ecobee** and sign in with your ecobee account when prompted — it is a cloud integration, so it needs that account working — then note the two `climate.*` entity names it creates (the rules below use `climate.downstairs`; substitute your real names). The Caséta dimmers are already `light.*` entities from that earlier step, ready for the presence rules here and the scenes at the end of this page.

### Presence — everybody left, somebody home
The companion app on each iPhone hands you a **device tracker** for free. So far only one phone has the app — the iPhone from the Matter Locks page — so have the second person install the **Home Assistant companion app** on their iPhone now and sign in, ideally as their own user created under **Settings → People**, and their tracker appears too. Find both under **Entities** (search "tracker"); each reads `home` or `not_home` and is the most reliable presence signal a home network has. Build two mirror-image rules. Everybody-left triggers when *either* phone leaves, but the **conditions require both** to read `not_home` before acting, so the house only goes to away-mode when it is actually empty:

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
    target: { entity_id: [lock.front_door, lock.side_door, lock.garage_door] }
  - action: climate.set_temperature
    target: { entity_id: climate.downstairs }
    data: { temperature: 16 }
```

Coming home is the easy half — trigger on the first phone reaching `home`, no conditions needed. Mirror the above with `to: "home"`, then turn on `light.entryway` and set the ecobee back to 21.

## Comfort and awareness

### ecobee setback and an optional open-window pause
The presence pair above already nudges the **two ecobees** through `climate.set_temperature` on their `climate.*` entities — point them at the upstairs and downstairs entities the ecobee integration created when you added it before the presence rules. That setback alone is the comfort-and-savings win this build ships with.

> [!NOTE]
> **Optional, needs a sensor you do not have yet.** A money-saving extra is pausing a system when a window or door is open, so you are not heating the street — but this build includes **no window or door contact sensors**. If you want this rule, first add an Aqara door/window **contact sensor**, pair it into the Zigbee mesh the same way you joined the leak sensors, and rename it to something like `binary_sensor.living_room_window`. Then trigger on it holding open and turn the mode off:
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
>     target: { entity_id: climate.downstairs }
>     data: { hvac_mode: "off" }
> ```
>
> Pair it with the mirror automation — window closed, set the mode back to `heat` or `cool` — and the two-minute **For** keeps a quick airing-out from cycling the furnace.

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
> A doorbell **press** is separate from person detection — intentional, and free of false alarms. But the press entity is **not** created by the go2rtc/Frigate setup from the Cameras page: that gives you a video feed and person detection, not the button's own entity. To get `event.front_doorbell` you must add the **Reolink Home Assistant integration** — **Settings → Devices & services → Add integration → Reolink** — which is the extra connection the Cameras page flagged as a possible dropout risk, so add it carefully and watch the Frigate logs after. Once it is in, the ring surfaces as an `event` entity you trigger the same way (`trigger: state` on `event.front_doorbell`), and everything below the trigger stays identical. Exactly how the press appears depends on the Reolink integration, not Frigate, so confirm the entity name under **Entities** before you reference it. Many people wire both: soft awareness on approach, the full announcement on the actual ring. The speaker-on-doorbell announcement is the worked example in the next callout below — reuse that pattern with this trigger.

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
- **PoE shades → the 24-port switch.** Its **320 W** budget is almost entirely theirs, since the cameras sit on the other switch. Each shade is one port plus one Cat6 run to the window, punched down on the patch panel and patched across.

A motor draws almost nothing idle and only a modest amount while moving, so 320 W covers a whole house of shades. The one time you near the budget is a scene that moves *every* shade at once — with many shades, stagger the close-all below into small groups a second apart so the motors never all peak together.

### Run one Cat6 to each PoE shade
Every PoE shade needs its **own Cat6 run** back to the switch. The motor ships with a short **7.5-inch (19 cm) Ethernet pigtail** — join it to the in-wall cable with a **Cat6A inline coupler**. The motor is **802.3af/at** and draws about **5 W** (120–150 µA idle) over runs up to **100 m (328 ft)**, which is why a whole house of them barely dents the 320 W budget. Plan the **cable exit before the drywall closes**: **inside-mount** shades bring it out at the **head jamb**, **outside-mount** shades out the **rear of the motor cover**. Give each shade a dedicated run (a dual shade needs two); two motors *can* share one run through an Ethernet splitter, but a run per shade is cleaner. Terminate every run on the 48-port patch panel and patch across to the 24-port switch. (SmartWings ships a full PoE wiring guide with the shades; this matches it.)

### Onboard the shades
Both kinds land as `cover.*` entities, commissioned straight into Home Assistant's Matter controller — no Apple Home, no vendor app:

- In the **Home Assistant companion app**, go to **Settings → Devices & services → Add integration → Matter**, and enter each shade's pairing code. A **PoE (Ethernet) shade** joins over the wired LAN; a **battery (Thread) shade** joins over Home Assistant's OpenThread Border Router — the phone's Bluetooth does the handshake and hands over the Thread credentials, exactly like the locks.
- Give each PoE shade a **DHCP reservation** so its address never moves.

### Group them and drive them as one
Make one group so PoE-vs-battery stops mattering, then automate the group. In **Settings → Devices & services → Helpers → Create helper → Group → Cover group**, add every shade entity and name it `cover.all_shades`. Now a single rule closes the whole house at sunset:

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

> [!TIP]
> Drive shades with **`cover.set_cover_position`** (0–100) rather than the vendor app — one action covers every shade, PoE or battery, in the house. If a close-all ever browns a motor out on the PoE budget, split `cover.all_shades` into two smaller groups and close them a second apart.

## Make it yours

### Scenes — set the room, not the devices
A **scene** is a saved room state — these lights at these brightnesses, the Lutron Caseta dimmers just so — that any automation can recall by name. On **Settings → Automations & scenes**, the scenes view's **Add scene** button (lower right) opens an editor: add the devices, set them how "movie night" should look, and save. Then any automation's **Then do** can activate it with the `scene.turn_on` action — so a single trigger paints a whole room instead of switching one light.

> [!WARNING]
> The scene editor is **live**: while you edit, it actually drives the real devices to the scene's states so you can see what you are building, and restores them when you leave. Do not panic when the room changes around you — that is the editor showing its work, not an automation firing.

### Test without waiting for real events
Two tools live in each automation's three-dot menu. **Run actions** executes the Then-do half immediately, skipping triggers and conditions — the fast way to confirm the valve, the critical push, and the spoken line all fire. **Traces** keeps a step-by-step record of the last few runs, drawn as a graph showing exactly which path ran and where it stopped; the first time a rule "didn't work," the trace almost always shows it worked precisely as written, just not as intended.

> [!WARNING]
> **Run actions** on the leak rule will physically close the main water valve — that is the point of the test, but do it on purpose, not by accident, and re-open the valve afterward.

### An off-switch for exceptions, never for safety
The house acting on its own is great until the evening it should not. Make a toggle for that: **Settings → Devices & services → Helpers → Create helper → Toggle**, named "Guest mode". Add a **State** condition to the **Frigate person alert and the doorbell announcement** requiring Guest mode be off, and visitor alerts hush while guests come and go. Gate convenience behind it freely — but **never** the leak valve, the auto-lock, or any safety action. Same rule, one last time so it sticks: a safety automation answers to the raw sensor and nothing else.
