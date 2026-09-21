/**
 * The house's wired ports, hub-first. Three hubs, each drawn with its real
 * front panel: the VIMIN (the rack's main switch), the GS308EPP hanging off
 * it, and the Fios router at the other end of the trunk. The patch panel is
 * derived from them — every in-wall run has a switch end, so the switch
 * tables are the record and the panel reads them back.
 *
 * Per-port defaults come from the build's own conventions (panel 02–09 map
 * one-for-one onto the GS308EPP, 10–33 onto the VIMIN, 01 is the trunk). A
 * stored entry overrides the default for that port and nothing else.
 */

export type HubId = "vimin" | "gs308" | "router";
export type PortRole = "camera" | "shade" | "uplink" | "direct" | "wan" | "spare";

export const ROLES: { role: PortRole; title: string; color: string }[] = [
  { role: "camera", title: "PoE camera", color: "#f43f5e" },
  { role: "shade", title: "PoE shade", color: "#f59e0b" },
  { role: "uplink", title: "Trunk · in-wall", color: "#8b5cf6" },
  { role: "direct", title: "Direct cable · no panel", color: "#0ea5e9" },
  { role: "wan", title: "WAN", color: "#64748b" },
  { role: "spare", title: "Spare", color: "" },
];

export const roleColor = (role: PortRole): string =>
  ROLES.find((r) => r.role === role)?.color ?? "";

export type PortDef = {
  /** Port number as printed on the device. */
  n: number;
  /** What the device prints beside it: "1", "25", "LAN 1", "WAN". */
  name: string;
  role: PortRole;
  /** Default patch-panel port ("01"–"48"); "" when the cable never meets the panel. */
  panel: string;
  /** Default shorthand shown on the face. */
  label: string;
  /** Default detail shown in the table. */
  feeds: string;
};

export type Hub = { id: HubId; name: string; model: string; ports: PortDef[] };

export const pad = (n: number): string => String(n).padStart(2, "0");

const port = (
  n: number,
  name: string,
  role: PortRole,
  panel = "",
  label = "",
  feeds = "",
): PortDef => ({ n, name, role, panel, label, feeds });

const CAMERAS: [string, string][] = [
  ["Shed", "shed_turret · 192.168.1.72"],
  ["Carport", "carport_turret · 192.168.1.73"],
  ["Patio", "patio_turret · 192.168.1.74"],
  ["Chimney", "chimney_turret · 192.168.1.75 · not mounted yet"],
  ["Kitchen", "kitchen_turret · 192.168.1.76"],
];

export const HUBS: Hub[] = [
  {
    id: "vimin",
    name: "VIMIN",
    model: "VM-GS2420P · 24 PoE+ (320 W) + 2 uplinks",
    ports: [
      ...Array.from({ length: 24 }, (_, i) =>
        port(i + 1, String(i + 1), "shade", pad(10 + i)),
      ),
      port(25, "25", "uplink", "01", "Router", "trunk from the Fios router · panel 01 is labeled UPLINK — ROUTER"),
      port(26, "26", "direct", "", "GS308EPP", "short cable → GS308EPP port 8"),
    ],
  },
  {
    id: "gs308",
    name: "GS308EPP",
    model: "Netgear · 8 PoE+",
    ports: [
      ...CAMERAS.map(([label, feeds], i) =>
        port(i + 1, String(i + 1), "camera", pad(i + 2), label, feeds),
      ),
      port(6, "6", "spare", "07"),
      port(7, "7", "spare", "08"),
      port(8, "8", "direct", "", "VIMIN", "short cable → VIMIN port 26"),
    ],
  },
  {
    id: "router",
    name: "Fios router",
    model: "CR1000A · 1× 10G + 2× 2.5G LAN",
    ports: [
      port(1, "LAN 1", "direct", "", "Server", "Proxmox host · 192.168.1.50"),
      port(2, "LAN 2", "uplink", "01", "Trunk", "wall plate → panel 01 → VIMIN 25"),
      port(3, "LAN 3", "direct", "", "Caséta", "Lutron bridge · 192.168.1.61"),
      port(4, "WAN", "wan", "", "ONT", "Fios ONT"),
    ],
  },
];

export const TOTAL_PORTS = HUBS.reduce((sum, hub) => sum + hub.ports.length, 0);
export const PANEL_PORTS = 48;

/* -------------------------------------------------------------------------- */
/* Entries — what the user recorded, keyed "<hub>:<port>"                     */
/* -------------------------------------------------------------------------- */

export type PortEntry = { label: string; feeds: string; panel: string };
export type PortMap = Record<string, PortEntry>;

export const portKey = (hub: HubId, n: number): string => `${hub}:${n}`;

/** "1", " 01 " and "01" are the same panel port; anything non-numeric is kept as typed. */
export function normPanel(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? pad(n) : t;
}

export function resolvePort(def: PortDef, map: PortMap, hub: HubId): PortEntry {
  return map[portKey(hub, def.n)] ?? { label: def.label, feeds: def.feeds, panel: def.panel };
}

export function isDefaultEntry(def: PortDef, entry: PortEntry): boolean {
  return (
    entry.label === def.label &&
    entry.feeds === def.feeds &&
    normPanel(entry.panel) === normPanel(def.panel)
  );
}

export function countLabeled(map: PortMap): number {
  let n = 0;
  for (const hub of HUBS)
    for (const def of hub.ports) if (resolvePort(def, map, hub.id).label.trim()) n++;
  return n;
}

/* -------------------------------------------------------------------------- */
/* The panel, read back from the hubs                                         */
/* -------------------------------------------------------------------------- */

export type PanelRun =
  | { kind: "hub"; hub: Hub; def: PortDef; entry: PortEntry }
  | { kind: "legacy"; entry: PortEntry };

/**
 * Panel port ("01"–"48") → the run that lands on it. Hubs are read in order,
 * so a port both ends name (the trunk: VIMIN 25 and router LAN 2) shows the
 * switch side's label. Rows that survived the old panel-keyed format with no
 * switch to belong to are kept as legacy runs.
 */
export function panelRuns(map: PortMap): Map<string, PanelRun> {
  const runs = new Map<string, PanelRun>();
  for (const hub of HUBS) {
    for (const def of hub.ports) {
      const entry = resolvePort(def, map, hub.id);
      const p = normPanel(entry.panel);
      if (p && !runs.has(p)) runs.set(p, { kind: "hub", hub, def, entry });
    }
  }
  for (const [key, entry] of Object.entries(map)) {
    if (!key.startsWith("panel:")) continue;
    const p = normPanel(key.slice("panel:".length));
    if (p && !runs.has(p)) runs.set(p, { kind: "legacy", entry });
  }
  return runs;
}

/* -------------------------------------------------------------------------- */
/* Migration from the panel-keyed format                                      */
/* -------------------------------------------------------------------------- */

type LegacyRow = { feeds?: string; switchPort?: string };

/**
 * The first version keyed rows by panel port ("12") with a free-text switch
 * port. Move each to the switch port the build's convention gives that panel
 * port, folding the typed switch port into the detail so nothing is lost;
 * panel ports past the mapped bands keep a "panel:NN" row. Returns whether
 * anything changed.
 */
export function migrateLegacyPorts(all: Record<string, unknown>): boolean {
  let changed = false;
  for (const key of Object.keys(all)) {
    if (!/^\d+$/.test(key)) continue;
    const old = all[key] as LegacyRow | undefined;
    delete all[key];
    changed = true;
    const p = Number(key);
    const typedSwitch = old?.switchPort?.trim();
    const feeds = [old?.feeds?.trim(), typedSwitch ? `switch port ${typedSwitch}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (!feeds) continue;
    const target =
      p === 1
        ? portKey("vimin", 25)
        : p >= 2 && p <= 9
          ? portKey("gs308", p - 1)
          : p >= 10 && p <= 33
            ? portKey("vimin", p - 9)
            : `panel:${pad(p)}`;
    const existing = all[target] as PortEntry | undefined;
    if (!existing) all[target] = { label: "", feeds, panel: pad(p) } satisfies PortEntry;
    else if (!existing.feeds.includes(feeds))
      all[target] = { ...existing, feeds: existing.feeds ? `${existing.feeds} · ${feeds}` : feeds };
  }
  return changed;
}
