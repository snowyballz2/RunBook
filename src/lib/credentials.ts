import { groupByCollection } from "./collections";
import type { Block, Guide } from "./types";

/** One credential field declared by a guide via [!INPUT]/[!SECRET]. */
export type CredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  guideId: string;
  guideTitle: string;
};

function walk(blocks: Block[], out: Omit<CredentialField, "guideId" | "guideTitle">[]) {
  for (const b of blocks) {
    if (b.type === "input") {
      out.push({
        key: b.key,
        label: b.label,
        ...(b.placeholder ? { placeholder: b.placeholder } : {}),
        secret: b.secret,
      });
    } else if (b.type === "details") {
      walk(b.blocks, out);
    }
  }
}

/**
 * Collect every credential field across the library, in reading order
 * (collections by order, then standalone). Duplicate keys keep their first
 * appearance — one key, one value, shared everywhere it is referenced.
 */
export function collectCredentialFields<T extends { guide: Guide }>(
  items: T[],
): CredentialField[] {
  const grouped = groupByCollection(items);
  const ordered = [
    ...grouped.collections.flatMap((c) => c.items),
    ...grouped.standalone,
  ];

  const fields: CredentialField[] = [];
  const seen = new Set<string>();
  for (const { guide } of ordered) {
    const local: Omit<CredentialField, "guideId" | "guideTitle">[] = [];
    if (guide.intro) walk(guide.intro, local);
    for (const phase of guide.phases) {
      if (phase.intro) walk(phase.intro, local);
      for (const step of phase.steps) walk(step.blocks, local);
    }
    for (const f of local) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      fields.push({ ...f, guideId: guide.id, guideTitle: guide.title });
    }
  }
  return fields;
}
