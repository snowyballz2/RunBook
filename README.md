# Runbook

A polished, installable PWA that turns a plain Markdown procedure into a calm,
sequential, **checkable** guide. Drop a `.md` file in, get a beautiful runbook
out. Works full-screen and offline.

The signature is the **progress spine** — a vertical rail down the Reader where
phases are stations and steps are nodes. As you check steps, the rail fills and a
live marker shows where you are, so a procedure reads as a literal path you walk.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build (outputs dist/, incl. PWA SW)
npm run preview    # serve the production build (service worker active here)
npm test           # run the parser unit tests
node scripts/generate-icons.mjs   # regenerate app icons from the SVG source
```

> Requires Node 18+ (built and tested on Node 24 LTS).

## Adding a guide

Three first-class paths, all zero-friction:

1. **Paste** — open *Add guide* → paste Markdown. It live-previews and validates,
   then saves to your device.
2. **Drop a file** — drag a `.md` onto the import panel (or click to pick one).
3. **Bundle it** — drop a `.md` file into [`src/guides/`](src/guides/). Every file
   there is bundled at build time, auto-loaded into the library, and precached for
   offline use. No app code changes required.

Imported guides and progress live in `localStorage` — no accounts, no server.

## The guide format

Standard Markdown with a light, unambiguous convention (trivial to hand-author
and trivial for an AI to emit):

```markdown
---
title: Proxmox Home Server Build
subtitle: Bare-metal to a full local stack
accent: spruce            # optional: spruce·teal·azure·violet·amber·rose·emerald, or a #hex
---

## Phase 1 — Prep            ← "## " is a Phase (a spine station)

### Save your files first    ← "### " is a Step (a checkable spine node)
Body text, **bold**, `code`, [links](https://example.com), and lists render normally.

> [!WARNING]                 ← GitHub-style admonitions become colored callouts
> This step is irreversible. (NOTE · TIP · WARNING · DANGER)

```bash
echo "fenced code becomes a copyable command card"
```
```

- No frontmatter? The first `#` heading becomes the title.
- A guide's `id` is a stable slug of its title, so checkbox progress survives
  reloads and re-imports.
- A malformed file shows a specific, friendly parse error — never a blank screen.

## Tech stack

Vite · React + TypeScript · Tailwind CSS v4 · `marked` · `vite-plugin-pwa`
(Workbox) · self-hosted variable fonts (Space Grotesk, Inter, JetBrains Mono).

## Project structure

```
public/icons/            generated app icons (192 / 512 / maskable / apple-touch)
src/
  lib/
    parseGuide.ts         Markdown + admonitions → Guide data model (+ tests)
    storage.ts            localStorage: progress, collapse, imported guides, theme
    bundledGuides.ts      globs src/guides/*.md at build time
    accents.ts            per-guide accent → CSS token overrides
  components/             LibraryView, ReaderView, ProgressSpine, StepCard,
                          CommandBlock, Callout, ImportPanel, ThemeToggle, …
  guides/                 bundled starter guides (drop .md files here)
  styles/index.css        design tokens (light + dark) + base styles
  App.tsx                 routing, theme, library merge
scripts/generate-icons.mjs
```

## Offline & install

`vite-plugin-pwa` (autoUpdate) precaches the app shell, fonts, icons, and the
bundled guides. After one load the app runs fully offline and can be installed to
the home screen / dock / taskbar on iOS, Android, macOS, and Windows (Edge & Chrome).
