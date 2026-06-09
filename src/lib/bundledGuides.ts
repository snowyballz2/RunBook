import { parseGuide } from "./parseGuide";
import type { Guide } from "./types";

/**
 * Every `.md` file in `src/guides/` is bundled at build time and precached by
 * the service worker, so the starter library is always available offline.
 * Authoring a new built-in guide is just: drop a `.md` file in that folder.
 */
const modules = import.meta.glob("../guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type BundledGuide = { guide: Guide; markdown: string; file: string };

export function loadBundledGuides(): BundledGuide[] {
  const out: BundledGuide[] = [];
  for (const [path, raw] of Object.entries(modules)) {
    const file = path.split("/").pop() ?? path;
    try {
      const guide = parseGuide(raw, { fallbackTitle: file.replace(/\.md$/, "") });
      out.push({ guide, markdown: raw, file });
    } catch (err) {
      // A broken built-in guide must never take down the whole library.
      console.error(`Skipping unparseable bundled guide “${file}”:`, err);
    }
  }
  out.sort((a, b) => a.guide.title.localeCompare(b.guide.title));
  return out;
}
