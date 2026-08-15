---
title: Cable & Port Map
subtitle: My Build — every in-wall run, what it feeds, and where it lands
collection: My Build
order: 25
accent: azure
---

A passive record, not a build step: one row per **in-wall Cat6 run**, so a cable can be traced from either end without a tone generator. Fill each row in as you pull and terminate it — the panel port is fixed by the label, and the value records **what it feeds → which switch port it patches to**.

The convention this follows is set on the **Start Here** page: anything running through a wall lands on the 48-port patch panel; anything sitting in the rack connects directly. So `VIMIN → GS308EPP` and `server → router` never appear here — they are short cables between adjacent boxes, not runs.

> [!TIP]
> Write the same number at **both ends** of every run — the panel port and the wall plate it feeds — and label each patch cable at the switch with its panel number. A cable pulled loose then goes back correctly without tracing anything.

## The trunk

### Port 1 — the uplink
The single run between the two locations, carrying every camera and shade back to the router. It is the one port whose loss takes the whole rack offline, so label it unmistakably at the panel — `UPLINK — ROUTER` — because on a panel of 48 identical jacks it is exactly what gets unpatched by someone hunting a free port.

> [!INPUT] panel-01 | Panel 01 — trunk | Fios router → VIMIN uplink 1

## Cameras — panel 2 to 9

### The GS308EPP block
Eight panel ports mapped one-for-one onto the 8-port PoE switch, so anything in this range patches to the little switch without thinking. Five PoE EmpireTechs today (`192.168.1.72`–`.76`), the Reolink doorbell if its RJ45 ever gets wired, and room to grow. Record the camera's corner and its address alongside the switch port — "Front NE turret .72 → GS308 p1".

> [!INPUT] panel-02 | Panel 02 — camera

> [!INPUT] panel-03 | Panel 03 — camera

> [!INPUT] panel-04 | Panel 04 — camera

> [!INPUT] panel-05 | Panel 05 — camera

> [!INPUT] panel-06 | Panel 06 — camera

> [!INPUT] panel-07 | Panel 07 — camera

> [!INPUT] panel-08 | Panel 08 — camera / spare

> [!INPUT] panel-09 | Panel 09 — camera / spare

## Shades — panel 10 to 33

### The VIMIN PoE block
Twenty-four panel ports mapped onto the VIMIN's 24 PoE ports, matching the switch exactly so the block can never be over-subscribed. **One run per motor** — a dual shade takes two. Number these geographically rather than by install order: walk the house in one consistent direction, floor by floor, so a port number implies roughly where the window is. Leave unused rows blank.

> [!INPUT] panel-10 | Panel 10 — shade

> [!INPUT] panel-11 | Panel 11 — shade

> [!INPUT] panel-12 | Panel 12 — shade

> [!INPUT] panel-13 | Panel 13 — shade

> [!INPUT] panel-14 | Panel 14 — shade

> [!INPUT] panel-15 | Panel 15 — shade

> [!INPUT] panel-16 | Panel 16 — shade

> [!INPUT] panel-17 | Panel 17 — shade

> [!INPUT] panel-18 | Panel 18 — shade

> [!INPUT] panel-19 | Panel 19 — shade

> [!INPUT] panel-20 | Panel 20 — shade

> [!INPUT] panel-21 | Panel 21 — shade

> [!INPUT] panel-22 | Panel 22 — shade

> [!INPUT] panel-23 | Panel 23 — shade

> [!INPUT] panel-24 | Panel 24 — shade

> [!INPUT] panel-25 | Panel 25 — shade

> [!INPUT] panel-26 | Panel 26 — shade

> [!INPUT] panel-27 | Panel 27 — shade

> [!INPUT] panel-28 | Panel 28 — shade

> [!INPUT] panel-29 | Panel 29 — shade

> [!INPUT] panel-30 | Panel 30 — shade

> [!INPUT] panel-31 | Panel 31 — shade

> [!INPUT] panel-32 | Panel 32 — shade

> [!INPUT] panel-33 | Panel 33 — shade

> [!NOTE]
> Ports 34–48 stay spare — future wall jacks, an access point, a second run to a room that needs one. They get rows here when they get cables.
