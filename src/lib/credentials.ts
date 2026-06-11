import { groupByCollection } from "./collections";
import type { Block, Guide } from "./types";

/**
 * Scope value meaning “guides that belong to no collection”. Reserved: a
 * collection literally named this would be scoped as standalone instead.
 */
export const STANDALONE_SCOPE = "__standalone__";

/** One credential field declared by a guide via [!INPUT]/[!SECRET]. */
export type CredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Pre-filled value for logins that ship fixed (e.g. `root`). */
  defaultValue?: string;
  secret: boolean;
  guideId: string;
  guideTitle: string;
  /** The guide's collection, when it has one — used to scope the view. */
  collection?: string;
};

type LocalField = Omit<CredentialField, "guideId" | "guideTitle" | "collection">;

function walk(blocks: Block[], out: LocalField[]) {
  for (const b of blocks) {
    if (b.type === "input") {
      out.push({
        key: b.key,
        label: b.label,
        ...(b.placeholder ? { placeholder: b.placeholder } : {}),
        ...(b.defaultValue ? { defaultValue: b.defaultValue } : {}),
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
    const local: LocalField[] = [];
    if (guide.intro) walk(guide.intro, local);
    for (const phase of guide.phases) {
      if (phase.intro) walk(phase.intro, local);
      for (const step of phase.steps) walk(step.blocks, local);
    }
    for (const f of local) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      fields.push({
        ...f,
        guideId: guide.id,
        guideTitle: guide.title,
        ...(guide.collection ? { collection: guide.collection } : {}),
      });
    }
  }
  return fields;
}

/**
 * How many fields have a usable value: something the user saved, or a
 * pre-filled default (a fixed login like `root` counts as filled).
 */
export function countFilled(
  fields: Pick<CredentialField, "key" | "defaultValue">[],
  saved: Record<string, string>,
): number {
  return fields.filter(
    (f) => (saved[f.key] ?? "").trim() !== "" || !!f.defaultValue,
  ).length;
}

/**
 * How many fields the user actually saved a value for — defaults don't count.
 * This is what “clear” can act on, as opposed to what reads as filled.
 */
export function countSaved(
  fields: Pick<CredentialField, "key">[],
  saved: Record<string, string>,
): number {
  return fields.filter((f) => (saved[f.key] ?? "").trim() !== "").length;
}
