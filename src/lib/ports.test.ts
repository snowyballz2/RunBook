import { describe, expect, it } from "vitest";
import {
  HUBS,
  countLabeled,
  isDefaultEntry,
  migrateLegacyPorts,
  normPanel,
  panelRuns,
  portKey,
  resolvePort,
} from "./ports";
import type { PortMap } from "./ports";

const hub = (id: string) => HUBS.find((h) => h.id === id)!;
const def = (id: "vimin" | "gs308" | "router", n: number) => hub(id).ports.find((p) => p.n === n)!;

describe("port defaults follow the build's panel convention", () => {
  it("maps VIMIN 1–24 onto panel 10–33, the GS308EPP onto 02–09, and the trunk onto 01", () => {
    expect(def("vimin", 1).panel).toBe("10");
    expect(def("vimin", 24).panel).toBe("33");
    expect(def("gs308", 1).panel).toBe("02");
    expect(def("vimin", 25).panel).toBe("01");
    expect(def("router", 2).panel).toBe("01");
  });

  it("gives direct cables no panel port", () => {
    expect(def("vimin", 26).panel).toBe("");
    expect(def("gs308", 8).panel).toBe("");
    expect(def("router", 1).panel).toBe("");
  });
});

describe("resolvePort / isDefaultEntry", () => {
  it("returns the default until an entry overrides it", () => {
    const d = def("gs308", 1);
    expect(resolvePort(d, {}, "gs308")).toEqual({ label: "Shed", feeds: d.feeds, panel: "02" });
    const map: PortMap = { [portKey("gs308", 1)]: { label: "Front", feeds: "", panel: "02" } };
    expect(resolvePort(d, map, "gs308").label).toBe("Front");
  });

  it("treats '2' and '02' as the same panel port", () => {
    const d = def("gs308", 1);
    expect(isDefaultEntry(d, { label: "Shed", feeds: d.feeds, panel: "2" })).toBe(true);
    expect(normPanel(" 7 ")).toBe("07");
    expect(normPanel("A3")).toBe("A3");
    expect(normPanel("")).toBe("");
  });
});

describe("countLabeled", () => {
  it("counts default labels and user labels alike", () => {
    // 5 cameras + GS308EPP 8 + VIMIN 25/26 + the router's four.
    expect(countLabeled({})).toBe(12);
    expect(countLabeled({ [portKey("vimin", 3)]: { label: "LR-1", feeds: "", panel: "12" } })).toBe(13);
  });
});

describe("panelRuns", () => {
  it("reads the panel back from the hubs, switch side first", () => {
    const runs = panelRuns({});
    const p01 = runs.get("01");
    expect(p01?.kind === "hub" && p01.hub.id).toBe("vimin");
    const p02 = runs.get("02");
    expect(p02?.kind === "hub" && p02.def.n).toBe(1);
    expect(runs.get("09")).toBeUndefined();
    expect(runs.get("34")).toBeUndefined();
  });

  it("keeps legacy panel rows that belong to no switch", () => {
    const runs = panelRuns({ "panel:40": { label: "", feeds: "office jack", panel: "40" } });
    expect(runs.get("40")?.kind).toBe("legacy");
  });
});

describe("migrateLegacyPorts", () => {
  it("moves a panel-keyed row to the switch port the convention gives it", () => {
    const all: Record<string, unknown> = { "12": { feeds: "LR shade", switchPort: "3" } };
    expect(migrateLegacyPorts(all)).toBe(true);
    expect(all).toEqual({
      [portKey("vimin", 3)]: { label: "", feeds: "LR shade · switch port 3", panel: "12" },
    });
  });

  it("keeps a row past the mapped bands as a panel row, and drops empty ones", () => {
    const all: Record<string, unknown> = { "40": { feeds: "office jack", switchPort: "" }, "41": { feeds: "", switchPort: "" } };
    expect(migrateLegacyPorts(all)).toBe(true);
    expect(all).toEqual({ "panel:40": { label: "", feeds: "office jack", panel: "40" } });
  });

  it("never overwrites a newer entry, folding the old detail in instead", () => {
    const all: Record<string, unknown> = {
      [portKey("gs308", 1)]: { label: "Shed", feeds: "north corner", panel: "02" },
      "2": { feeds: "shed cam", switchPort: "1" },
    };
    migrateLegacyPorts(all);
    expect(all[portKey("gs308", 1)]).toEqual({
      label: "Shed",
      feeds: "north corner · shed cam · switch port 1",
      panel: "02",
    });
  });

  it("is a no-op on the new format", () => {
    const all: Record<string, unknown> = { [portKey("vimin", 1)]: { label: "x", feeds: "", panel: "10" } };
    expect(migrateLegacyPorts(all)).toBe(false);
  });
});
