import { describe, expect, it } from "vitest";
import {
  HUBS,
  PANEL_DEFAULTS,
  countHubUsed,
  countPanelLabeled,
  hubEntry,
  hubKey,
  hubPortView,
  isDefaultHub,
  isDefaultPanel,
  linksByHubPort,
  migratePorts,
  panelEntry,
  panelKey,
  panelRole,
  parseHubKey,
} from "./ports";
import type { PortMap } from "./ports";

const hub = (id: "vimin" | "gs308" | "router") => HUBS.find((h) => h.id === id)!;
const port = (id: "vimin" | "gs308" | "router", n: number) => hub(id).ports.find((p) => p.n === n)!;

describe("panel defaults", () => {
  it("carry what is punched down today, panel 25–30", () => {
    expect(panelEntry(25, {}).label).toBe("Router uplink");
    expect(panelEntry(25, {}).to).toBe(hubKey("vimin", 25));
    expect(panelEntry(26, {}).kind).toBe("camera");
    expect(panelEntry(30, {}).to).toBe(hubKey("gs308", 5));
    expect(panelEntry(1, {})).toEqual({ label: "", feeds: "", kind: "jack", to: "" });
  });

  it("are recognised so matching entries are not stored", () => {
    expect(isDefaultPanel(27, { ...PANEL_DEFAULTS[27] })).toBe(true);
    expect(isDefaultPanel(27, { ...PANEL_DEFAULTS[27], to: hubKey("vimin", 3) })).toBe(false);
    expect(isDefaultHub(hubKey("gs308", 8), hubEntry(hubKey("gs308", 8), {}))).toBe(true);
    expect(isDefaultHub(hubKey("vimin", 3), { label: "", feeds: "", role: "direct" })).toBe(true);
  });
});

describe("hubs read the panel back", () => {
  it("shows a linked panel run on its switch port, with the panel number", () => {
    const v = hubPortView(hub("gs308"), port("gs308", 1), {});
    expect(v).toEqual({ label: "Chimney cam", feeds: "chimney_turret · 192.168.1.75", role: "camera", panel: 26 });
  });

  it("keeps direct cables on the hub and leaves the rest spare", () => {
    expect(hubPortView(hub("vimin"), port("vimin", 26), {}).role).toBe("direct");
    expect(hubPortView(hub("vimin"), port("vimin", 3), {}).role).toBe("spare");
    expect(hubPortView(hub("router"), port("router", 4), {}).role).toBe("wan");
  });

  it("gives the lowest panel port a double-booked switch port", () => {
    const map: PortMap = {
      [panelKey(3)]: { label: "LR-1", feeds: "", kind: "shade", to: hubKey("gs308", 1) },
    };
    expect(linksByHubPort(map).get(hubKey("gs308", 1))).toBe(3);
    expect(hubPortView(hub("gs308"), port("gs308", 1), map).label).toBe("LR-1");
  });

  it("colours a panel port by its kind once anything is recorded", () => {
    expect(panelRole(25, {})).toBe("trunk");
    expect(panelRole(7, {})).toBe("spare");
    expect(panelRole(7, { [panelKey(7)]: { label: "", feeds: "", kind: "shade", to: hubKey("vimin", 1) } })).toBe("shade");
  });
});

describe("counts", () => {
  it("count labeled panel ports and used hub ports, defaults included", () => {
    expect(countPanelLabeled({})).toBe(6);
    // 6 linked + VIMIN 26, GS308EPP 8, router LAN 1–3 and WAN.
    expect(countHubUsed({})).toBe(12);
  });
});

describe("parseHubKey", () => {
  it("resolves real hub ports and rejects the rest", () => {
    expect(parseHubKey(hubKey("vimin", 25))?.port.name).toBe("25");
    expect(parseHubKey("vimin:99")).toBeNull();
    expect(parseHubKey("nope")).toBeNull();
  });
});

describe("migratePorts", () => {
  it("turns a first-version panel row into a panel entry, keeping the typed switch port", () => {
    const all: Record<string, unknown> = { "12": { feeds: "LR shade", switchPort: "3" } };
    expect(migratePorts(all)).toBe(true);
    expect(all).toEqual({ [panelKey(12)]: { label: "", feeds: "LR shade · switch port 3", kind: "jack", to: "" } });
  });

  it("turns a second-version hub row with a panel number into a linked panel entry", () => {
    const all: Record<string, unknown> = { [hubKey("vimin", 3)]: { label: "LR-1", feeds: "", panel: "12" } };
    expect(migratePorts(all)).toBe(true);
    expect(all).toEqual({ [panelKey(12)]: { label: "LR-1", feeds: "", kind: "shade", to: hubKey("vimin", 3) } });
  });

  it("keeps a second-version hub row without a panel number on the hub", () => {
    const all: Record<string, unknown> = { [hubKey("gs308", 7)]: { label: "AP", feeds: "ceiling AP", panel: "" } };
    migratePorts(all);
    expect(all).toEqual({ [hubKey("gs308", 7)]: { label: "AP", feeds: "ceiling AP", role: "direct" } });
  });

  it("folds two rows landing on one panel port without losing either", () => {
    const all: Record<string, unknown> = {
      [panelKey(12)]: { label: "", feeds: "office", kind: "jack", to: "" },
      "12": { feeds: "old note", switchPort: "" },
    };
    migratePorts(all);
    expect(all[panelKey(12)]).toEqual({ label: "", feeds: "office · old note", kind: "jack", to: "" });
  });

  it("is a no-op on the current shape", () => {
    const all: Record<string, unknown> = {
      [panelKey(1)]: { label: "x", feeds: "", kind: "jack", to: "" },
      [hubKey("gs308", 7)]: { label: "AP", feeds: "", role: "direct" },
    };
    expect(migratePorts(all)).toBe(false);
  });
});
