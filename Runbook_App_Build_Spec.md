# Runbook — Build Spec & Claude Code Kickoff Prompt

A polished, installable web app (PWA) that turns a plain Markdown procedure file into a clean, checkable, step-by-step guide. Drop a file in, get a beautiful runbook out. Works full-screen and offline on Windows, Mac, iPhone, and Android.

"Runbook" is a working name. Rename freely.

---

## SECTION A — Paste this into Claude Code to start

> Build a polished, installable PWA called **Runbook**. It reads Markdown "procedure" files and renders each one as a clean, sequential, checkable guide. The whole point is convenience: adding a new guide should be as simple as dropping a `.md` file in, pasting Markdown into the app, or committing a file to a `guides/` folder. The look must be genuinely impressive and calm, not a generic template.
>
> Stack: Vite + React + TypeScript + Tailwind CSS. Use `vite-plugin-pwa` for installability and offline support. Use a Markdown parser (`marked` or `markdown-it`) with GitHub-style admonition support. No backend. All state local.
>
> Read the full spec in this file below (Sections B onward) and implement it. Follow your frontend-design skill for the visual work and execute the design direction in Section F exactly, taking one tasteful risk. Build in the milestone order in Section J. When done, run it, screenshot the Library and Reader views, and self-critique against Section K before telling me it is finished.
>
> Start by scaffolding the project, then implement the Markdown parser and data model, then the Reader view, then the Library, then PWA + persistence, then polish.

---

## SECTION B — Goal & principles

- **One job:** render a Markdown procedure into a polished, sequential, checkable guide that is a pleasure to follow while doing real work at a machine or desk.
- **Convenience is the product.** The friction of adding a guide must be near zero. Three ingestion paths, all first-class: paste Markdown, drag-and-drop a `.md` file, and auto-load any file in a bundled `guides/` folder.
- **Separate content from presentation.** Guides are just Markdown. The app never hard-codes any guide. Authoring a guide requires no knowledge of the app's internals.
- **Local-first.** No accounts, no server, no network needed after load. Progress and imported guides persist on-device.
- **Calm under load.** This is used while concentrating on something else. Clarity, legibility, and a clear sense of "where am I" beat decoration.

---

## SECTION C — The procedure file format (the thing you push in)

Guides are standard Markdown with a light, unambiguous convention. This format is chosen so it is trivial to hand-author and trivial for an AI to emit on request.

**Convention:**
- Optional YAML frontmatter for metadata.
- `##` heading = a **Phase** (a major section).
- `###` heading = a **Step** within the current phase.
- Anything under a step (paragraphs, lists, links, bold) = that step's body, rendered normally.
- Fenced code blocks (```` ``` ````) = **command blocks**, rendered as distinct terminal-style cards with a one-tap **Copy** button.
- GitHub-style admonitions = colored callouts:
  - `> [!NOTE]` → note (informational, blue)
  - `> [!TIP]` → tip (teal)
  - `> [!WARNING]` → warning (amber)
  - `> [!DANGER]` → danger / destructive (red)
- If there is no frontmatter, the first `#` heading is the guide title.

**Full worked example (a valid guide file):**

```markdown
---
title: Proxmox Home Server Build
subtitle: Bare-metal to full local stack on the 8700K
accent: spruce
---

## Phase 1 — Prep & BIOS

### Save anything off the PC first
Installing Proxmox wipes the drive, Windows and all. Pull any files you want to keep.

> [!WARNING]
> This step is irreversible. The target drive is fully erased.

### Set BIOS for virtualization
Enable VT-x and VT-d, enable the integrated graphics, and turn on C-states.

> [!TIP]
> VT-d is what makes USB and drive passthrough work later. Do not skip it.

## Phase 2 — Install Proxmox

### Flash the installer
Write the Proxmox ISO to a USB stick with Balena Etcher, then boot from it.

### Run the installer
Follow the prompts for disk, hostname, root password, and a static IP.

```bash
# After install, reach the web UI from another machine:
https://your-ip:8006
```

> [!NOTE]
> Proxmox has no desktop. You administer it from a browser at that address.

### Post-install cleanup
Run the community post-install script to set repos and remove the subscription nag.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/post-pve-install.sh)"
```
```

**Parsed data model (what the app builds from a file):**

```ts
type Callout = { kind: "note" | "tip" | "warning" | "danger"; html: string };
type Block =
  | { type: "prose"; html: string }
  | { type: "command"; language: string; code: string }
  | { type: "callout"; data: Callout };
type Step  = { id: string; title: string; blocks: Block[] };
type Phase = { id: string; title: string; steps: Step[] };
type Guide = {
  id: string;          // stable slug from title, used as the persistence key
  title: string;
  subtitle?: string;
  accent?: string;     // optional palette accent override
  phases: Phase[];
  totalSteps: number;
};
```

`id` must be a stable slug of the title so checkbox progress survives reloads and re-imports of the same guide.

---

## SECTION D — Screens

**1. Library (home).** A calm grid or list of guide cards. Each card shows title, subtitle, a progress indicator (ring or bar showing completed / total steps), and phase count. Actions: open, re-import, remove. A prominent but tasteful **Add guide** affordance that opens the import options. A quiet search/filter field once there is more than a handful of guides.

**2. Reader.** The heart of the app. A single guide rendered as a sequential path:
- Sticky top bar: guide title, overall progress bar, and a back-to-library control.
- The **progress spine** (see Section F signature) running down the left, with phases as stations and steps as nodes.
- Phases as collapsible sections. Steps as cards, each with a checkbox, title, body, command blocks, and callouts.
- A persistent, subtle "X of Y steps done" and a "reset progress" control for the guide.

**3. Import.** Reachable from the Library. Three tabs or a combined panel: **Paste** (a textarea that live-previews and saves), **Drop a file** (drag-and-drop or file picker for `.md`), and a note that any file placed in the repo's `guides/` folder loads automatically.

---

## SECTION E — Features & behavior

- **Checkboxes per step**, with state saved to `localStorage` keyed by `guide.id` + `step.id`. Checking a step animates its spine node to filled.
- **Overall + per-phase progress.** Top bar bar-graph for the whole guide; each phase header shows its own done/total. A phase auto-collapses when fully complete (with a gentle cue), and can be reopened.
- **Copy buttons** on every command block. One tap copies the raw code; show a brief "Copied" confirmation. Strip leading `#` comment-only lines from what is copied? No — copy verbatim, but render comments dimmed.
- **Collapsible phases**, smooth height animation, state remembered per guide.
- **Resume.** Reopening a guide scrolls to the first unchecked step.
- **Reset progress** per guide, with a confirm.
- **Library persistence.** Imported guides are stored locally so they survive reloads; the bundled `guides/` folder is always merged in on load.
- **Search/filter** guides by title in the Library.
- **Theme toggle:** light (default) and dark. Dark is genuinely useful at the machine; make it first-class, not an afterthought.
- **Print / save as PDF** stylesheet so a guide prints cleanly (nice-to-have, not blocking).
- **Empty states** that invite action: an empty Library shows how to add the first guide; a malformed file shows a clear, specific parse error naming what was wrong, in the interface's voice.

---

## SECTION F — Design direction (execute this, then refine with the frontend-design skill)

Treat the subject as a **precision instrument for getting things done** — a calm, confident technical control panel, not a document and not a dashboard. Avoid the generic AI looks (cream + serif + terracotta; black + acid-green; broadsheet hairlines). Spend the boldness on the signature, keep everything else quiet.

**Palette (light; provide a matching dark theme):**
- Ink `#181A1F` — primary text
- Paper `#FAFAF8` — app background
- Surface `#FFFFFF` — cards
- Line `#E7E5DF` — hairlines, borders
- Accent (primary) `#0F766E` — spruce/teal, used for the progress spine and primary actions
- Note `#2563EB` · Tip `#0F766E` · Warning `#B45309` · Danger `#DC2626` — semantic callouts only
- Command surface: a near-ink panel (`#15171C`) with light mono text, so commands read as a distinct material

**Type (all free; load from Google Fonts / Fontshare):**
- Display (phase titles, guide title): **Space Grotesk** or **Hanken Grotesk** — characterful, used with restraint
- Body (step titles, prose): **Inter**
- Mono (commands, metadata): **JetBrains Mono**
- Set a clear scale with intentional weights. Phase titles large and confident; step titles medium; body comfortable for reading mid-task.

**Layout:**
```
LIBRARY                          READER
┌───────────────────────────┐   ┌───────────────────────────────┐
│  Runbook        [+ add]    │   │ ‹ back   Guide title   ▓▓▓░ 60%│
│  search…                   │   ├──┬────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐    │   │ ●│ ## Phase 1                 │
│ │card │ │card │ │card │    │   │ ┃│ ┌── ☑ Step title ───────┐  │
│ │ ◔ % │ │ ◑ % │ │ ○ % │    │   │ ┃│ │ body text…           │  │
│ └─────┘ └─────┘ └─────┘    │   │ ●│ │ ▌ command   [copy]    │  │
│                            │   │ ┃│ └──────────────────────┘  │
└───────────────────────────┘   │ ○│ ## Phase 2 (collapsed)    │
   progress ring per card        └──┴────────────────────────────┘
                                  ↑ the spine: stations = phases,
                                    nodes = steps, fills as you go
```

**Signature element — the progress spine.** A vertical rail down the left of the Reader. Each step is a node on it; each phase is a labeled station. As steps are checked, their nodes fill with the accent and the connecting line "completes" up to the current point, so the guide reads as a literal path you are walking. This is justified by the content: a procedure genuinely is a sequence, so the timeline encodes real information, not decoration. Make this the one memorable thing.

**Motion (restrained, respect `prefers-reduced-motion`):** a satisfying fill on node check, smooth phase collapse/expand, a gentle staggered reveal of step cards on guide open. Nothing else.

---

## SECTION G — PWA requirements

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- Web app manifest: name, short_name, theme/background colors matching the palette, `display: standalone`, and a full icon set (192, 512, maskable). Generate clean app icons consistent with the design.
- Service worker precaches the app shell and the bundled `guides/` files for full offline use.
- Verify it installs and launches full-screen with no browser chrome on all four targets: Windows (via Edge and Chrome — check both, since app-icon and window-title polish can differ between them), macOS dock, iOS home screen, and Android home screen.

---

## SECTION H — Accessibility & quality floor

- Responsive from small phone (primary at-the-machine use) up to desktop window.
- Visible keyboard focus on every interactive element; checkboxes, copy buttons, and collapses fully keyboard-operable.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Sufficient contrast in both themes. Real semantic HTML. Copy buttons announce their result.

---

## SECTION I — Project structure (suggested)

```
runbook/
  public/
    guides/                 # drop .md guides here; auto-loaded
      proxmox-home-server.md
    icons/
  src/
    lib/
      parseGuide.ts         # markdown -> Guide data model
      storage.ts            # localStorage: progress, imported guides
    components/
      LibraryView.tsx
      ReaderView.tsx
      ProgressSpine.tsx
      StepCard.tsx
      CommandBlock.tsx
      Callout.tsx
      ImportPanel.tsx
      ThemeToggle.tsx
    App.tsx
    main.tsx
    styles/  (Tailwind config + design tokens)
  vite.config.ts            # + vite-plugin-pwa
  index.html
```

---

## SECTION J — Build milestones (do in order)

1. Scaffold Vite + React + TS + Tailwind. Establish the design tokens and fonts.
2. `parseGuide.ts`: Markdown + admonitions → the `Guide` data model. Unit-test against the Section C example.
3. Reader view with the progress spine, step cards, command blocks (with copy), and callouts. Hard-code one guide to build against.
4. Checkbox state + persistence + overall/per-phase progress + resume-to-first-unchecked.
5. Library view: cards, progress indicators, search, open/remove.
6. Import: paste, drag-drop, and auto-load from `public/guides/`.
7. PWA: manifest, icons, service worker, offline. Verify install on all three platforms.
8. Polish pass per Section F + the frontend-design skill: motion, dark theme, empty/error states, print stylesheet. Screenshot and self-critique.

---

## SECTION K — Definition of done (acceptance criteria)

- Dropping a valid `.md` file (or pasting Markdown) immediately renders a clean, correct guide. Adding a guide never requires touching app code.
- A malformed file shows a specific, friendly parse error, not a blank screen or a crash.
- Checking steps fills the spine, updates progress, and persists across reloads and reinstalls of the app.
- Command blocks copy verbatim with clear confirmation.
- Installs and runs full-screen offline on Windows (Edge and Chrome), Mac, iPhone, and Android.
- Light and dark themes both look intentional and pass contrast.
- The Reader looks genuinely polished on a phone screen and a desktop window. The progress spine is the clear visual signature.
- Keyboard and reduced-motion paths work.

---

## SECTION L — Later / stretch (not for v1)

- Load a whole library from a GitHub repo's `guides/` folder via a small index file, so the library lives in one place and syncs across devices.
- Per-step timers for "wait / bake / sync" steps.
- An in-app editor with live preview for authoring guides directly.
- Optional cross-device sync of progress (would introduce a backend, deliberately out of scope for the local-first v1).

---

### How you'll actually use it
Ask me for any procedure. I hand you a `.md` file in the format in Section C. You drop it into `public/guides/` (or paste it into the app) and it renders as a polished runbook with checkboxes and copy buttons. That is the whole loop.
