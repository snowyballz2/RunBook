---
title: Automations
subtitle: Wire the house to act on its own
collection: My Build
order: 7
accent: rose
---

The infrastructure is finished; this is where the house starts doing things. Every automation below is taught end-to-end in the *Automations* general guide — the grammar, the YAML, the why. This page is just the checklist: build each one straight from that guide and swap in my entities. The names here are placeholders — open **Settings → Devices & services → Entities** and substitute the real ones (Zigbee2MQTT, Matter, and the Frigate integration named them when they onboarded).

> [!WARNING]
> Build the **water-leak** automation first, the day the valve is paired — before any convenience automation. It's the one that pays for the whole build. The rest can wait.

## The one that matters

### Leak → close valve → critical alert → announce
Build the *Automations* guide's "Water leak — shut off the main and shout" verbatim, with my entities. Trigger lists **all twelve** Third Reality `binary_sensor.*_leak` sensors `to: "on"`; actions, in order: `valve.close_valve` on `valve.main_water` (the Aqara Valve Controller T1), a **critical iOS** push to `notify.mobile_app_chris_iphone`, and `tts.speak` on a Cast speaker via local **Piper** (`tts.piper`) so it still talks during an internet outage.

> [!WARNING]
> **No `conditions` block — ever.** The valve closes on a raw sensor going wet whether we're home, away, asleep, or in any "guest mode." Never gate a safety action behind presence, time, or a toggle.

> [!TIP]
> The valve clamps onto my quarter-turn lever main. Test with a real clean-water trip and confirm it rotates the lever **fully closed** — not just that the entity flips to `closed`. The Third Reality smart plugs near the sensors and valve are what keep the Zigbee mesh reaching them; a leak alert that can't get back to the coordinator is worthless.

### Low-battery sweep
A dead sensor battery silently disarms the leak net, so build the *Automations* guide's "Low battery sweep" too. It walks every `battery` device-class entity with no per-device setup, so the twelve sensors, the valve, and the locks are all covered (and anything I add later). Ordinary push to `notify.mobile_app_chris_iphone`. Per the guide, consider a **40%** threshold for the leak sensors specifically — more runway on the ones that matter most.

## Doors and presence

### U400 auto-lock + unlock notify
Build both lock patterns from the guide's "Auto-lock the Aqara U400" callout for each of my **three** U400 locks (commissioned in Apple Home, shared to HA over Matter): auto-lock when the door contact holds `off`/closed for `00:05:00` → `lock.lock`; and notify when a lock goes `to: "unlocked"`. Do it for `lock.front_door`, `lock.back_door`, `lock.side_door` (real names from **Entities**), each watching its own Third Reality contact sensor where one exists.

### Presence — everybody left / somebody home
Build the guide's mirror pair off the **companion-app device trackers** (`device_tracker.chris_iphone`, `device_tracker.partner_iphone`) — the most reliable presence signal the house has. The away half triggers on *either* phone leaving but **conditions require both** `not_home` before acting (lights off, lock the U400s, ecobee setback); the home half fires on the first to arrive `to: "home"`.

## Comfort and awareness

### ecobee setback + open-window pause
The presence pair already nudges the **two ecobees** via `climate.set_temperature` on their `climate.*` entities. Add the money-saver from the guide's "Climate setback on the ecobee" callout: a window/door contact holding `on`/open for `00:02:00` → `climate.set_hvac_mode: "off"`, with the mirror automation (closed → back to `heat`/`cool`). Point both at the upstairs and downstairs ecobee entities.

### Frigate person alerts
For the **Reolink doorbell + RLC-510WA**, skip the quick occupancy-sensor trigger and build the guide's graduate version — trigger on the **`frigate/events`** MQTT topic, filter to `type: new` and `label: person`. It fires on Frigate's considered judgement (not its fast first guess) and carries the event `id` for a permanent snapshot in the push. Reach Frigate by its LAN address or its NPM name in the snapshot URL.

> [!NOTE]
> A doorbell **press** is separate from person detection — also build the guide's "Trigger on the doorbell button" variant off the Reolink doorbell's button-press entity, for the intentional, false-alarm-free ring. Soft awareness on approach, the real alert on the actual press. The speaker-on-doorbell announcement has its own worked example in this collection's doorbell page — build it there, not twice.

## After they're all in

- **Test with Run actions** (each automation's three-dot menu), not by waiting for real events — confirm the valve, the critical push, and the spoken line all fire.
- The first leak-test push makes iOS ask to **allow critical alerts** for the companion app — grant it, or the 3 a.m. alert stays silent.
- A **guest-mode** helper toggle (from the guide) is fine to gate the *person/porch* notifications behind — but **never** the leak valve. Same rule, one more time so I don't forget it.
