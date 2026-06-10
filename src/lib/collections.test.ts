import { describe, expect, it } from "vitest";
import { groupByCollection } from "./collections";
import { parseGuide } from "./parseGuide";
import type { Guide } from "./types";

const mk = (title: string, collection?: string, order?: number) => ({
  guide: {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    phases: [],
    totalSteps: 0,
    ...(collection ? { collection } : {}),
    ...(order !== undefined ? { order } : {}),
  } as Guide,
});

describe("frontmatter — collection & order", () => {
  it("parses collection and order from frontmatter", () => {
    const g = parseGuide(
      [
        "---",
        "title: Install Proxmox",
        "subtitle: Bare-metal install and first boot",
        "collection: Proxmox Home Server",
        "order: 2",
        "---",
        "",
        "### Step",
        "body",
      ].join("\n"),
    );
    expect(g.collection).toBe("Proxmox Home Server");
    expect(g.order).toBe(2);
    expect(g.id).toBe("install-proxmox"); // id stays a stable slug of title
  });

  it("leaves collection/order undefined when absent, ignores junk order", () => {
    const g = parseGuide("# T\n\n### S\nbody");
    expect(g.collection).toBeUndefined();
    expect(g.order).toBeUndefined();
    const g2 = parseGuide("---\ntitle: T\norder: banana\n---\n\n### S\nbody");
    expect(g2.order).toBeUndefined();
  });
});

describe("groupByCollection", () => {
  it("groups by collection, sorts by order asc, falls back to title", () => {
    const items = [
      mk("Zeta", "Build", 3),
      mk("Alpha", "Build"), // no order -> last
      mk("Beta", "Build", 1),
      mk("Tied B", "Build", 2),
      mk("Tied A", "Build", 2),
      mk("Loner"),
      mk("Other", "Another Build", 1),
    ];
    const g = groupByCollection(items);

    expect(g.collections.map((c) => c.name)).toEqual(["Another Build", "Build"]);
    expect(g.collections[1].items.map((i) => i.guide.title)).toEqual([
      "Beta",
      "Tied A",
      "Tied B",
      "Zeta",
      "Alpha",
    ]);
    expect(g.standalone.map((i) => i.guide.title)).toEqual(["Loner"]);
  });

  it("returns everything standalone when no collections exist", () => {
    const g = groupByCollection([mk("One"), mk("Two")]);
    expect(g.collections).toHaveLength(0);
    expect(g.standalone).toHaveLength(2);
  });
});
