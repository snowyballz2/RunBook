import { parseGuide, slugify } from "./parseGuide";
import type { Guide } from "./types";

/**
 * Every `.md` file in `src/guides/` is bundled at build time and precached by
 * the service worker, so the starter library is always available offline.
 * Authoring a new built-in guide is just: drop a `.md` file in that folder.
 * Files ending in `-2.md` are unmerged donor drafts and stay out of the app.
 */
const modules = import.meta.glob(["../guides/*.md", "!../guides/*-2.md"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type BundledGuide = { guide: Guide; markdown: string; file: string };

export function loadBundledGuides(): BundledGuide[] {
  const out: BundledGuide[] = [];
  const usedIds = new Set<string>();
  for (const [path, raw] of Object.entries(modules)) {
    const file = path.split("/").pop() ?? path;
    try {
      const guide = parseGuide(raw, { fallbackTitle: file.replace(/\.md$/, "") });
      // The route + progress id must be unique per guide. parseGuide derives it
      // from slugify(title), which collides when two collections share a guide
      // title (e.g. both "Proxmox Home Server" and "My Build" have an "Install
      // Proxmox"): the hash route then resolved to whichever file sorted first,
      // so one collection's page silently rendered the other's content. Qualify
      // the id with the collection, with a counter as a final uniqueness guard.
      let id = guide.collection
        ? `${slugify(guide.collection)}-${slugify(guide.title)}`
        : guide.id;
      for (let n = 2; usedIds.has(id); n++) id = `${id}-${n}`;
      usedIds.add(id);
      guide.id = id;
      out.push({ guide, markdown: raw, file });
    } catch (err) {
      // A broken built-in guide must never take down the whole library.
      console.error(`Skipping unparseable bundled guide “${file}”:`, err);
    }
  }
  out.sort((a, b) => a.guide.title.localeCompare(b.guide.title));
  return out;
}
