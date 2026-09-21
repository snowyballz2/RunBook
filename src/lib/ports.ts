/**
 * The house's wired ports, panel-first. The 48-port patch panel is the record
 * of what is in the walls: each port carries a run (a camera, a shade, the
 * router trunk, a wall jack) and, once decided, the switch port it is patched
 * to. The three hubs — the VIMIN, the GS308EPP hanging off it, and the Fios
 * router at the far end of the trunk — are drawn as their real front panels
 * and read their labels back from those links; only cables that never meet
 * the panel (the switch-to-switch link, the server) are recorded on the hub.
 *
 * Defaults are what is punched down today (panel 25–30, per Chris's list) and
 * the rack's fixed direct cables. A stored entry overrides the default for
 * that one port and is dropped again when it matches it.
 */

export type HubId = "vimin" | "gs308" | "router";

export type PortRole = "camera" | "shade" | "trunk" | "jack" | "direct" | "wan" | "spare";

/** What a panel run can be — the roles a user picks from. */
export type PanelKind = "camera" | "shade" | "trunk" | "jack";
export const PANEL_KINDS: { kind: PanelKind; title: string }[] = [
  { kind: "camera", title: "Camera" },
  { kind: "shade", title: "Shade" },
  { kind: "trunk", title: "Trunk" },
  { kind: "jack", title: "Jack" },
];

export const ROLES: { role: PortRole; title: string; color: string; hint: string }[] = [
  { role: "camera", title: "PoE camera", color: "#f43f5e", hint: "An in-wall run that ends at a camera." },
  { role: "shade", title: "PoE shade", color: "#f59e0b", hint: "An in-wall run that ends at a shade motor." },
  {
    role: "trunk",
    title: "Trunk · router ↔ rack",
    color: "#8b5cf6",
    hint: "The one in-wall run between the router and the rack — everything on the switches reaches the internet through it.",
  },
  {
    role: "jack",
    title: "Wall jack",
    color: "#10b981",
    hint: "An ordinary room outlet: a wall plate whose run lands on the panel, with whatever gets plugged in behind it.",
  },
  {
    role: "direct",
    title: "Direct cable · no panel",
    color: "#0ea5e9",
    hint: "A cable straight into a switch or the router that never touches the panel.",
  },
  { role: "wan", title: "WAN", color: "#64748b", hint: "The router's line to the Fios ONT." },
  { role: "spare", title: "Spare", color: "", hint: "Nothing patched here." },
];

export const roleColor = (role: PortRole): string =>
  ROLES.find((r) => r.role === role)?.color ?? "";

export type HubPort = { n: number; name: string };
export type Hub = { id: HubId; name: string; model: string; ports: HubPort[] };

export const pad = (n: number): string => String(n).padStart(2, "0");

const range = (count: number, name = (n: number) => String(n)): HubPort[] =>
  Array.from({ length: count }, (_, i) => ({ n: i + 1, name: name(i + 1) }));

export const HUBS: Hub[] = [
  { id: "vimin", name: "VIMIN", model: "VM-GS2420P · 24 PoE+ (320 W) + uplinks 25–26", ports: range(26) },
  { id: "gs308", name: "GS308EPP", model: "Netgear · 8 PoE+", ports: range(8) },
  {
    id: "router",
    name: "Fios router",
    model: "CR1000A · 1× 10G + 2× 2.5G LAN",
    ports: [
      { n: 1, name: "LAN 1" },
      { n: 2, name: "LAN 2" },
      { n: 3, name: "LAN 3" },
      { n: 4, name: "WAN" },
    ],
  },
];

export const PANEL_PORTS = 48;
export const TOTAL_HUB_PORTS = HUBS.reduce((sum, hub) => sum + hub.ports.length, 0);

export const hubKey = (hub: HubId, n: number): string => `${hub}:${n}`;
export const panelKey = (port: number): string => `panel:${pad(port)}`;

export function hubOf(id: string): Hub | undefined {
  return HUBS.find((h) => h.id === id);
}

/** "vimin:25" → { hub, port } when it names a real hub port. */
export function parseHubKey(key: string): { hub: Hub; port: HubPort } | null {
  const [id, n] = key.split(":");
  const hub = hubOf(id);
  const port = hub?.ports.find((p) => p.n === Number(n));
  return hub && port ? { hub, port } : null;
}

/* -------------------------------------------------------------------------- */
/* Entries                                                                    */
/* -------------------------------------------------------------------------- */

/** One patch-panel port: the run punched down on it, and where it is patched. */
export type PanelEntry = { label: string; feeds: string; kind: PanelKind; to: string };
/** One hub port that no panel run lands on: a direct cable, or a note on a spare. */
export type HubEntry = { label: string; feeds: string; role: PortRole };

export type PortMap = Record<string, PanelEntry | HubEntry>;

const EMPTY_PANEL: PanelEntry = { label: "", feeds: "", kind: "jack", to: "" };
const EMPTY_HUB: HubEntry = { label: "", feeds: "", role: "direct" };

/** What is punched down today — Chris's list, panel 25–30 — with the obvious switch side proposed. */
export const PANEL_DEFAULTS: Record<number, PanelEntry> = {
  25: { label: "Router uplink", feeds: "trunk from the Fios router LAN", kind: "trunk", to: hubKey("vimin", 25) },
  26: { label: "Chimney cam", feeds: "chimney_turret · 192.168.1.75", kind: "camera", to: hubKey("gs308", 1) },
  27: { label: "Back shed cam", feeds: "shed_turret · 192.168.1.72", kind: "camera", to: hubKey("gs308", 2) },
  28: { label: "Carport cam", feeds: "carport_turret · 192.168.1.73", kind: "camera", to: hubKey("gs308", 3) },
  29: { label: "Sliding dr cam", feeds: "patio_turret · 192.168.1.74", kind: "camera", to: hubKey("gs308", 4) },
  30: { label: "Indoor cam", feeds: "kitchen_turret · 192.168.1.76", kind: "camera", to: hubKey("gs308", 5) },
};

/** Cables that never meet the panel. */
export const HUB_DEFAULTS: Record<string, HubEntry> = {
  [hubKey("vimin", 26)]: { label: "GS308EPP", feeds: "short cable → GS308EPP port 8", role: "direct" },
  [hubKey("gs308", 8)]: { label: "VIMIN", feeds: "short cable → VIMIN port 26", role: "direct" },
  [hubKey("router", 1)]: { label: "Server", feeds: "Proxmox host · 192.168.1.50", role: "direct" },
  [hubKey("router", 2)]: { label: "Trunk", feeds: "wall plate → panel 25 → VIMIN 25", role: "trunk" },
  [hubKey("router", 3)]: { label: "Caséta", feeds: "Lutron bridge · 192.168.1.61", role: "direct" },
  [hubKey("router", 4)]: { label: "ONT", feeds: "Fios ONT", role: "wan" },
};

export function panelEntry(port: number, map: PortMap): PanelEntry {
  return (map[panelKey(port)] as PanelEntry | undefined) ?? PANEL_DEFAULTS[port] ?? EMPTY_PANEL;
}

export function hubEntry(key: string, map: PortMap): HubEntry {
  return (map[key] as HubEntry | undefined) ?? HUB_DEFAULTS[key] ?? EMPTY_HUB;
}

export function isDefaultPanel(port: number, e: PanelEntry): boolean {
  const d = PANEL_DEFAULTS[port] ?? EMPTY_PANEL;
  return e.label === d.label && e.feeds === d.feeds && e.kind === d.kind && e.to === d.to;
}

export function isDefaultHub(key: string, e: HubEntry): boolean {
  const d = HUB_DEFAULTS[key] ?? EMPTY_HUB;
  return e.label === d.label && e.feeds === d.feeds && e.role === d.role;
}

/* -------------------------------------------------------------------------- */
/* Reading the hubs back from the panel                                       */
/* -------------------------------------------------------------------------- */

/** Hub port key → the panel port patched into it (lowest panel port wins a double booking). */
export function linksByHubPort(map: PortMap): Map<string, number> {
  const links = new Map<string, number>();
  for (let p = 1; p <= PANEL_PORTS; p++) {
    const to = panelEntry(p, map).to;
    if (to && !links.has(to)) links.set(to, p);
  }
  return links;
}

export type HubPortView = {
  label: string;
  feeds: string;
  role: PortRole;
  /** The panel port patched in, or null for a direct cable / spare. */
  panel: number | null;
};

export function hubPortView(hub: Hub, port: HubPort, map: PortMap, links = linksByHubPort(map)): HubPortView {
  const key = hubKey(hub.id, port.n);
  const panel = links.get(key);
  if (panel != null) {
    const e = panelEntry(panel, map);
    return { label: e.label, feeds: e.feeds, role: e.kind, panel };
  }
  const e = hubEntry(key, map);
  return { label: e.label, feeds: e.feeds, role: e.label.trim() || e.feeds.trim() ? e.role : "spare", panel: null };
}

/** The role a panel port shows: its kind once anything is recorded on it, else spare. */
export function panelRole(port: number, map: PortMap): PortRole {
  const e = panelEntry(port, map);
  return e.label.trim() || e.feeds.trim() || e.to ? e.kind : "spare";
}

export function countPanelLabeled(map: PortMap): number {
  let n = 0;
  for (let p = 1; p <= PANEL_PORTS; p++) if (panelEntry(p, map).label.trim()) n++;
  return n;
}

export function countHubUsed(map: PortMap): number {
  const links = linksByHubPort(map);
  let n = 0;
  for (const hub of HUBS)
    for (const port of hub.ports) if (hubPortView(hub, port, map, links).role !== "spare") n++;
  return n;
}

/* -------------------------------------------------------------------------- */
/* Migration from the two earlier shapes                                      */
/* -------------------------------------------------------------------------- */

/** "1", " 01 " and "01" are the same panel port. */
export function normPanel(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? pad(n) : t;
}

function fold(all: Record<string, unknown>, key: string, incoming: PanelEntry): void {
  const existing = all[key] as PanelEntry | undefined;
  if (!existing) {
    all[key] = incoming;
    return;
  }
  const feeds =
    existing.feeds && incoming.feeds && !existing.feeds.includes(incoming.feeds)
      ? `${existing.feeds} · ${incoming.feeds}`
      : existing.feeds || incoming.feeds;
  all[key] = {
    label: existing.label || incoming.label,
    feeds,
    kind: existing.kind ?? incoming.kind,
    to: existing.to || incoming.to,
  };
}

/** The role the hub-keyed second version implied for a port, for rows that carried a panel number. */
function kindForHubKey(key: string): PanelKind {
  const parsed = parseHubKey(key);
  if (!parsed) return "jack";
  if (parsed.hub.id === "gs308") return "camera";
  if (parsed.hub.id === "vimin") return parsed.port.n <= 24 ? "shade" : "trunk";
  if (parsed.hub.id === "router" && parsed.port.n === 2) return "trunk";
  return "jack";
}

/**
 * First version: rows keyed by panel port ("12") with free-text switch port.
 * Second: rows keyed by hub port ("vimin:3") carrying a panel number.
 * Both become panel entries; hub rows with no panel number stay on the hub.
 * Nothing typed is discarded. Returns whether anything changed.
 */
export function migratePorts(all: Record<string, unknown>): boolean {
  let changed = false;
  for (const key of Object.keys(all)) {
    const v = (all[key] ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string).trim() : "");

    if (/^\d+$/.test(key)) {
      delete all[key];
      changed = true;
      const typedSwitch = str("switchPort");
      const feeds = [str("feeds"), typedSwitch ? `switch port ${typedSwitch}` : ""].filter(Boolean).join(" · ");
      if (feeds) fold(all, panelKey(Number(key)), { label: "", feeds, kind: "jack", to: "" });
      continue;
    }

    if (key.startsWith("panel:")) {
      if ("kind" in v && "to" in v) continue;
      // A "panel:NN" row left by the second version's migration — no kind or link yet.
      delete all[key];
      changed = true;
      const p = Number(normPanel(key.slice("panel:".length)));
      if (Number.isInteger(p) && p > 0 && (str("label") || str("feeds")))
        fold(all, panelKey(p), { label: str("label"), feeds: str("feeds"), kind: "jack", to: "" });
      continue;
    }

    if ("panel" in v) {
      // Second version's hub row.
      delete all[key];
      changed = true;
      const p = normPanel(str("panel"));
      if (/^\d+$/.test(p) && (str("label") || str("feeds") || parseHubKey(key)))
        fold(all, panelKey(Number(p)), { label: str("label"), feeds: str("feeds"), kind: kindForHubKey(key), to: key });
      else if (str("label") || str("feeds")) all[key] = { label: str("label"), feeds: str("feeds"), role: "direct" } satisfies HubEntry;
    }
  }
  return changed;
}
