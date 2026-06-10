import type { Guide } from "./types";

/**
 * Group library items by their guide's `collection` frontmatter.
 * - Within a collection: ascending `order`; missing/tied order falls back to title.
 * - Collections are sorted by name; items with no collection are standalone and
 *   keep their incoming order (the Library already sorts those sensibly).
 */
export type GroupedLibrary<T> = {
  collections: { name: string; items: T[] }[];
  standalone: T[];
};

export function groupByCollection<T extends { guide: Guide }>(
  items: T[],
): GroupedLibrary<T> {
  const byName = new Map<string, T[]>();
  const standalone: T[] = [];

  for (const item of items) {
    const name = item.guide.collection?.trim();
    if (name) {
      const list = byName.get(name);
      if (list) list.push(item);
      else byName.set(name, [item]);
    } else {
      standalone.push(item);
    }
  }

  const collections = [...byName.entries()]
    .map(([name, list]) => ({
      name,
      items: list.sort(
        (a, b) =>
          (a.guide.order ?? Number.POSITIVE_INFINITY) -
            (b.guide.order ?? Number.POSITIVE_INFINITY) ||
          a.guide.title.localeCompare(b.guide.title),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { collections, standalone };
}
