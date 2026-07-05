---
title: Cooling Refresh
subtitle: Swap the aging AIO for air, rewire the fans, and repaste the 1080 Ti — one open-case session
collection: My Build
order: 3
accent: emerald
---

The PC being converted has 2017 cooling in it: an **AIO** (all-in-one liquid cooler) with an aging pump, liquid metal on the CPU, seven proprietary RGB fans, and a Thermaltake controller box driving them. On a gaming rig that was fine. On a headless server that runs the house 24/7, the pump is the single scariest failure point in the case — pumps live five to seven years, and when one seizes on a box nobody is sitting at, the CPU throttles or shuts down while you are nowhere near it. This page trades all of it for boring, long-life air cooling in one open-case session, and repastes the GTX 1080 Ti FTW3 while everything is already apart.

Do this alongside the Hardware & BIOS page's work — same screwdriver session, before the OS install. Windows is still on the NVMe at this stage, which matters at the end: it is your test bench for verifying temperatures before the wipe.

> [!NOTE]
> The swap, at a glance. **Out:** the 2017 Thermaltake AIO, the liquid metal on the CPU, all seven proprietary-plug RGB fans, and the RGB/fan controller box. **In:** a **Thermalright Phantom Spirit 120 SE** air cooler (~$55, ships with two fans and its own paste) and **four Noctua NF-P12 redux-1700 PWM** case fans (~$72), all running straight off the motherboard's own headers — no controller, no splitters, no lights.

> [!WARNING]
> Static kills chips. Before touching the card or the board: unplug the PC, hold the power button ten seconds to bleed residual charge, and ground yourself on bare case or PSU metal — or wear an **ESD** (electrostatic discharge) strap. Work on a hard, non-carpet surface.

## Swap the CPU cooler

### Remove the AIO and the controller box
Unplug the pump lead and the three radiator-fan leads, unscrew the pump block from the CPU bracket, then free the radiator from the case and lift the whole unit out — it is a sealed loop, so there is nothing to drain; it leaves in one piece. While you are in there, pull the **Thermaltake controller box** and every proprietary RGB fan with it: the four case fans and their controller come out as a set. The motherboard's own headers drive everything from now on, which is one less powered box that can fail and one less piece of vendor software that never worked well anyway.

### Clean the liquid metal off the CPU
Liquid metal is the other maintenance item leaving today. It is electrically conductive — a stray droplet on the socket or board kills the machine — so work carefully: wipe the **IHS** (integrated heat spreader, the CPU's metal lid) with isopropyl alcohol on lint-free cloth, repeatedly, until nothing gray transfers. A permanent dull stain where the metal alloyed into the lid is normal and harmless. Keep the cloth moving away from the socket.

> [!NOTE]
> This applies to the liquid metal between the lid and the old cooler. If this CPU was ever **delidded** with liquid metal *under* the lid, leave the inside alone — only the lid-to-cooler interface gets cleaned and repasted here.

### Mount the Phantom Spirit
Fit the cooler's LGA1151 mounting bracket, spread a pea-sized dot of the **included paste** on the center of the IHS, seat the tower, and tighten its two spring screws evenly. Clip on its two fans blowing **toward the rear of the case** so the tower exhausts into the rear fan's airstream. Plug fan one into **CPU_FAN** and fan two into **CPU_OPT** — on this board CPU_OPT follows CPU_FAN's curve, which is exactly what two fans on one tower want.

> [!NOTE]
> Regular paste over liquid metal costs a couple of degrees on paper and nothing in practice at server loads — and it never needs to be touched again. The Phantom Spirit is heavily oversized for an i7-8700K that is not being overclocked, which is the point: big heatsink, slow quiet fans, no pump.

## Rewire the case fans

### Place the fans
Four Noctuas replace the case's old set, positioned for what this box actually does — feed a working GPU and keep three spinning drives cool:

- **Three front intake**, top to bottom, pulling fresh air across the drive trays and straight into the 1080 Ti.
- **One rear exhaust**, directly behind the CPU tower.
- **Optional fifth fan: top exhaust, mounted toward the rear** of the top panel (the View 71's top tray takes 120 mm or 140 mm). The GPU dumps real heat during Frigate detection and Ollama bursts, and it rises; a rear-biased top exhaust gives it a vertical exit. Do not mount it front-top — there it steals fresh intake air before the GPU ever sees it.

Three (or three-and-a-bit) in versus two-to-three out keeps the case at slight positive pressure, so dust gets pushed out through cracks instead of pulled in.

### Wire every fan to its own header
The board has eight fan/pump headers — more than enough to skip splitters entirely, and worth doing on a headless machine: wired individually, every fan reports its own RPM, so the BIOS can flag a single stalled fan you would otherwise never notice.

- **CPU_FAN + CPU_OPT** — the Phantom Spirit's two fans (done above)
- **CHA_FAN1** — rear exhaust
- **CHA_FAN2, CHA_FAN3** — two front intakes
- **H_AMP** — third front intake (a normal header with extra current headroom)
- **AIO_PUMP** — the optional top exhaust
- **W_PUMP+** — spare

> [!WARNING]
> **AIO_PUMP and W_PUMP+ run at 100% by default** — they are meant for pumps. If the top fan lands on AIO_PUMP, enable fan control for that header in BIOS (**Advanced → Monitor → Q-Fan Configuration → AIO Pump control**) and give it a curve, or it will scream at full speed forever. The six other headers behave normally out of the box.

> [!TIP]
> While you are in the BIOS on the Hardware & BIOS page anyway, set the chassis-fan curves to **Silent** — this box idles 24/7 in a basement, and the Noctuas at low **PWM** (pulse-width modulation, the 4-pin speed signal) are effectively inaudible. The fans only need to ramp when the GPU is grinding.

## Repaste the GPU — gather everything first

### Have all of this in hand before you start
The 1080 Ti FTW3's paste and pads are as old as the AIO, and the card now works around the clock — a refresh typically drops load temperatures 10–20°C and buys it years. But do not begin until everything is here: stopping mid-teardown to order a pad thickness leaves the card sitting open for days.

- **Thermal paste, non-conductive.** Arctic MX-4, Thermal Grizzly Kryonaut, or Noctua NT-H2. One tube covers the GPU die with plenty to spare.
- **Thermal pads.** See the thickness note below. A 0.5 / 1.0 / 1.5 mm variety kit is the safe buy.
- **Isopropyl 90%+ or thermal-remover wipes**, plus lint-free cloth and cotton swabs.
- **Precision Phillips set** (PH00, PH0, PH1), ideally magnetic.
- **Plastic pry tool** and a way to track screws by location (compartment tray or labeled tape).
- **Calipers** to measure old pad thickness.
- **Air duster** to blow out the fins and fans while it is open.

> [!DETAILS] Thermal pad thicknesses — the part that bites people
> The FTW3 is one of the most heavily padded 1080 Tis EVGA made, blanketing the VRAM and the **VRM** (voltage regulator module — the row of power-delivery components) rather than a few spots. Owner reports disagree on the exact mix — mostly **0.5 mm and 1.0 mm**, with some spots at **1.25 mm** — and nine years of compression makes the old pads unreliable witnesses. So measure each old pad with calipers as you peel it, and match. A 0.5 / 1.0 / 1.5 mm variety kit finishes the job in one sitting no matter what you find (1.5 mm compresses fine where 1.25 mm sat). Never stack pads to fake a thickness, and never skip a pad.

> [!DANGER]
> **Non-conductive paste only on this card — never liquid metal.** The die sits inches from exposed VRAM and power components with no barrier; one conductive droplet during application or a later pump-out kills the card instantly. Liquid metal also attacks aluminum on contact, and parts of the cooler assembly are aluminum. This is exactly the maintenance liability the CPU just got rid of — do not reintroduce it on the GPU.

## Take the card apart

### Pull the card
Power off, unplug, release the PCIe slot latch and the bracket screws, and lift the card out. Set it on the clean, well-lit, non-static surface.

### Remove the backplate
On this card the backplate is what frees the whole assembly, so it comes off first. Note that some backplate areas have their own pads touching the rear of the PCB — note their positions too.

> [!WARNING]
> Two Phillips screw types are used: **wider-thread** screws for the plastic shroud, **thinner** screws where the backplate secures to the front-side heatsinks. Keep the two piles separate. The wrong screw in the wrong hole strips or bottoms out.

### Disconnect all the cables
The FTW3 runs more cables than a normal card. Unplug every one you find before you lift the shroud, or you will tear a connector. Pull on the connector, never the wires.

- **Three fan headers** along the bottom front
- **RGB nameplate cable** on the back
- **LED sync cable** at the top

### Separate the heatsink, carefully
Remove the four spring-loaded screws around the GPU die, plus the remaining screws holding the heatsink to the PCB for VRAM and VRM contact. Back the four die screws off gradually in a diagonal cross pattern so tension releases evenly.

> [!WARNING]
> Nine-year-old paste acts like glue. Do **not** pry hard or pull the heatsink straight up — you can tear the die off its substrate. **Twist** the heatsink a few degrees to break the paste seal. If it resists, warm it gently with a hair dryer on low (or, if you have not torn down yet, run the card under load for a minute first so it comes apart warm) and twist again. Let it come free on its own.

> [!TIP]
> Mind the **iCX sensors** on the PCB — the extra little chips that feed EVGA's per-component temperature readouts. Be gentle and do not pry near them.

## Clean and repad

### Strip the old interface
Wipe all old paste off the bare die and the coldplate until both are spotless. The die is exposed silicon — gentle pressure, no abrasives. Peel the old VRAM and VRM pads one at a time, noting exactly where each sat and measuring its thickness as you go. Blow the dust out of the fins and fans now while you have full access.

### Lay the new pads
Cut new pads to cover each VRAM chip and VRM/MOSFET group where the originals were, matched to each location's measured thickness, and peel the protective film off **both** sides.

> [!NOTE]
> If an old pad is still soft and intact you can reuse it, but at nine years most are hard and crumbly — replacing is the safer call.

## Repaste and reassemble

### Paste the die
The GPU die is small, like a CPU die. A modest pea-sized dot in the center, or a thin even spread. Do not drown it — mounting pressure spreads it.

### Reassemble evenly
Set the heatsink back down aligned, start all screws by hand, then tighten the four die screws gradually in a diagonal cross pattern so the die seats under even pressure. Snug, not cranked.

> [!WARNING]
> Overtightening cracks dies and PCBs. Even, moderate pressure only. Then the remaining heatsink screws, reconnect all three fan cables plus the RGB and LED leads, and reattach the shroud and backplate with their correct screw types.

## Verify before the wipe

### Test it under Windows while you still can
Windows is still on the NVMe until the Install Proxmox page erases it — use it. Seat the card, reconnect both PCIe power cables, boot into the old Windows install, and run a GPU stress test (FurMark, or Heaven looping) for ten minutes while watching temperatures, plus a short CPU load (Cinebench) to prove the new tower is seated well. This is the last point where load-testing the hardware is trivial.

> [!NOTE]
> A good repaste and repad usually drops GPU load temps 10–20°C; target under about **80°C** under sustained load. If temps are the same or worse, the die screws are uneven or a pad is the wrong thickness — recheck before trusting it. The CPU under the new air cooler should sit comfortably under 75°C in a stress run, and the room should be noticeably quieter with the pump gone.

> [!TIP]
> Later in the build, once the GPU is shared into containers, graph its temperature (the host's `nvidia-smi` readings can feed a Home Assistant sensor). Thermal creep over weeks is the early warning that a pad or fan is failing — it lets you service the card on your schedule instead of at 3 a.m.

> [!DETAILS] Visual reference and parts reality
> GamersNexus filmed a full [FTW3 teardown](https://gamersnexus.net/guides/2894-evga-1080ti-ftw3-teardown-and-pcb-info) showing the cooler, every cable, and the screw layout — worth ten minutes before you start. EVGA has exited the GPU business and shut its forums, so there is no OEM pad kit or RMA to fall back on; use aftermarket pads. Old EVGA forum threads with pad maps still live on the Wayback Machine.

> [!DETAILS] Lower-risk first pass
> The die repaste is the big thermal win and the safe part. The repad is more finicky on this heavily padded card. If you would rather ease in, repaste the die and only repad the spots whose pads are visibly hardened or cracked. At nine years that is usually most of them, but you do not have to commit to all of it sight unseen.
