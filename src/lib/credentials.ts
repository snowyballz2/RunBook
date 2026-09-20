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

/* -------------------------------------------------------------------------- */
/* Sections — a field lives with its subject, not with the first page that    */
/* happened to mention it. Several build pages touch one system (the TrueNAS  */
/* VM is created on Virtual Machines, configured on TrueNAS Storage, backed up */
/* on Protect Your Data), so those pages share one section. Guides not listed */
/* keep their own title.                                                      */
/* -------------------------------------------------------------------------- */

const SECTION_BY_GUIDE_TITLE: Record<string, string> = {
  "Start Here": "Proxmox host",
  "Hardware & BIOS": "Proxmox host",
  "Cooling Refresh": "Proxmox host",
  "Install Proxmox": "Proxmox host",
  Containers: "Proxmox host",
  "GPU Sharing & HBA Passthrough": "Proxmox host",
  "Proxmox Backups": "Proxmox host",
  "Maintenance & Upkeep": "Proxmox host",
  "Renumber the LAN": "Proxmox host",
  "When Something Breaks": "Proxmox host",
  "Virtual Machines": "TrueNAS & storage",
  "TrueNAS Storage": "TrueNAS & storage",
  "Protect Your Data": "TrueNAS & storage",
  "Home Assistant & Zigbee2MQTT": "Home Assistant",
  "Matter Locks": "Home Assistant",
  Automations: "Home Assistant",
  "Cameras, Doorbell & Frigate": "Cameras & Frigate",
  "Reverse Proxy": "Proxy, domain & remote access",
  "Remote Access": "Proxy, domain & remote access",
};

export type CredentialSection = {
  id: string;
  title: string;
  /** The guide whose accent colours the section — the first one seen. */
  accentGuideId: string;
  fields: CredentialField[];
};

export function sectionTitleFor(guideTitle: string): string {
  return SECTION_BY_GUIDE_TITLE[guideTitle] ?? guideTitle;
}

/** Group fields into sections, merging guides that share a subject, in the
 *  order each section is first seen. Field order within a section is kept. */
export function groupCredentialSections(fields: CredentialField[]): CredentialSection[] {
  const sections: CredentialSection[] = [];
  const byTitle = new Map<string, CredentialSection>();
  for (const f of fields) {
    const title = sectionTitleFor(f.guideTitle);
    let section = byTitle.get(title);
    if (!section) {
      section = {
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        title,
        accentGuideId: f.guideId,
        fields: [],
      };
      byTitle.set(title, section);
      sections.push(section);
    }
    section.fields.push(f);
  }
  return sections;
}

/* -------------------------------------------------------------------------- */
/* Retired keys — when two fields turned out to record the same fact, one key */
/* survives and the other's saved value moves across. Nothing is discarded.  */
/* -------------------------------------------------------------------------- */

export const LEGACY_CREDENTIAL_KEYS: Record<string, string> = {
  // The mirror-disk serials were declared twice: once on Hardware & BIOS, once
  // (with tray position) on TrueNAS Storage. The TrueNAS pair survives.
  "zfs-mirror-disk1-serial": "mirror-a-serial",
  "zfs-mirror-disk2-serial": "mirror-b-serial",
  // The Mosquitto broker lives on the Home Assistant VM — same address.
  "mqtt-host": "ha-ip",
};

/**
 * Move values saved under retired keys to their successors, in place.
 * A retired key is dropped only once its successor holds the same value; if
 * both hold different values, both stay. Returns true when anything changed.
 */
export function migrateLegacyCredentials(all: Record<string, string>): boolean {
  let changed = false;
  for (const [oldKey, newKey] of Object.entries(LEGACY_CREDENTIAL_KEYS)) {
    const old = all[oldKey];
    if (old == null) continue;
    if ((all[newKey] ?? "").trim() === "") {
      all[newKey] = old;
      changed = true;
    }
    if (all[newKey] === old) {
      delete all[oldKey];
      changed = true;
    }
  }
  return changed;
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
