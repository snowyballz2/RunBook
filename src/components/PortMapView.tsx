import { useEffect, useState } from "react";
import {
  HUBS,
  PANEL_KINDS,
  PANEL_PORTS,
  ROLES,
  TOTAL_HUB_PORTS,
  countHubUsed,
  countPanelLabeled,
  hubEntry,
  hubKey,
  hubPortView,
  isDefaultHub,
  isDefaultPanel,
  linksByHubPort,
  pad,
  panelEntry,
  panelKey,
  panelRole,
  roleColor,
} from "../lib/ports";
import type { Hub, HubEntry, HubPort, PanelEntry, PanelKind, PortMap, PortRole } from "../lib/ports";
import * as store from "../lib/storage";
import type { Theme } from "../lib/storage";
import { ArrowLeft, Trash } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
};

/* -------------------------------------------------------------------------- */
/* Faces — the panel and each hub drawn as its own front, ports where they are */
/* -------------------------------------------------------------------------- */

const CELL_W = 40;
const CELL_H = 44;
const PITCH = 44;
const MAX_LABEL = 14;
/** Advance of one rotated 11px mono glyph, in viewBox units. */
const CHAR_W = 6.6;

type Cell = {
  name: string;
  role: PortRole;
  /** Position relative to the chassis' top-left corner. */
  x: number;
  y: number;
  /** Top-row ports label above the chassis, bottom-row ports below. */
  above: boolean;
  label: string;
};

type Rect = { x: number; y: number; w: number; h: number };

type Face = {
  width: number;
  height: number;
  /** The chassis sits at x = 0; its y is the height of the label zone above it. */
  chassis: { y: number; w: number; h: number };
  fields: Rect[];
  brand: string;
  model: string;
  captions: { x: number; y: number; text: string }[];
  cells: Cell[];
  cellW: number;
  cellH: number;
};

const clip = (label: string) =>
  label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;

/** Height of a label zone: just enough for the longest label it holds, near nothing when empty. */
function zoneFor(cells: Cell[], above: boolean): number {
  const longest = cells
    .filter((c) => c.above === above && c.label.trim())
    .reduce((m, c) => Math.max(m, clip(c.label).length), 0);
  return longest === 0 ? 14 : 18 + longest * CHAR_W;
}

function finish(
  cells: Cell[],
  chassisW: number,
  chassisH: number,
  rest: Pick<Face, "fields" | "brand" | "model" | "captions" | "cellW" | "cellH">,
): Face {
  const top = zoneFor(cells, true);
  const bottom = zoneFor(cells, false);
  return {
    width: chassisW,
    height: top + chassisH + bottom,
    chassis: { y: top, w: chassisW, h: chassisH },
    cells,
    ...rest,
  };
}

type CellOf = (port: HubPort) => { label: string; role: PortRole };

/** The VIMIN: three blocks of four columns, odd ports on top, uplinks 25 over 26. */
function viminFace(hub: Hub, cellOf: CellOf): Face {
  const chassisH = 144;
  const x0 = 200;
  const gap = 16;
  const groupW = 4 * PITCH;
  const rowY = [26, 26 + CELL_H + 8];
  const blockW = 3 * groupW + 2 * gap;
  const uplinkX = x0 + blockW + 26;
  const cells: Cell[] = hub.ports.map((port) => {
    const { label, role } = cellOf(port);
    if (port.n <= 24) {
      const idx = port.n - 1;
      const group = Math.floor(idx / 8);
      const within = idx % 8;
      const col = Math.floor(within / 2);
      const row = within % 2;
      return { name: port.name, role, x: x0 + group * (groupW + gap) + col * PITCH, y: rowY[row], above: row === 0, label };
    }
    const row = port.n === 25 ? 0 : 1;
    return { name: port.name, role, x: uplinkX, y: rowY[row], above: row === 0, label };
  });
  return finish(cells, uplinkX + CELL_W + 26, chassisH, {
    fields: [
      { x: x0 - 10, y: 16, w: blockW + 20, h: chassisH - 32 },
      { x: uplinkX - 8, y: 16, w: CELL_W + 16, h: chassisH - 32 },
    ],
    brand: "Vimin",
    model: "VM-GS2420P",
    captions: [
      { x: x0 + blockW / 2, y: 11, text: "10/100/1000 PoE · 1–24" },
      { x: uplinkX + CELL_W / 2, y: 11, text: "Up Link" },
    ],
    cellW: CELL_W,
    cellH: CELL_H,
  });
}

/** A single row of ports with the labels below — the GS308EPP and the router. */
function rowFace(
  hub: Hub,
  cellOf: CellOf,
  opts: { brand: string; model: string; x0: number; gapBefore?: number; caption?: string },
): Face {
  const chassisH = 92;
  let x = opts.x0;
  const cells: Cell[] = hub.ports.map((port, i) => {
    if (opts.gapBefore === i) x += 24;
    const { label, role } = cellOf(port);
    const cell: Cell = { name: port.name, role, x, y: 24, above: false, label };
    x += PITCH;
    return cell;
  });
  const lastRight = x - PITCH + CELL_W;
  return finish(cells, lastRight + 26, chassisH, {
    fields: [{ x: opts.x0 - 10, y: 14, w: lastRight - opts.x0 + 20, h: chassisH - 28 }],
    brand: opts.brand,
    model: opts.model,
    captions: opts.caption ? [{ x: opts.x0 + (lastRight - opts.x0) / 2, y: 10, text: opts.caption }] : [],
    cellW: CELL_W,
    cellH: CELL_H,
  });
}

function buildFace(hub: Hub, cellOf: CellOf): Face {
  switch (hub.id) {
    case "vimin":
      return viminFace(hub, cellOf);
    case "gs308":
      return rowFace(hub, cellOf, { brand: "NETGEAR", model: "GS308EPP", x0: 150, caption: "PoE+ · 1–8" });
    case "router":
      return rowFace(hub, cellOf, { brand: "verizon", model: "CR1000A", x0: 140, gapBefore: 3 });
  }
}

/** The 48-port panel: 1–24 on top, 25–48 below, in blocks of eight. */
function panelFace(map: PortMap): Face {
  const cellW = 28;
  const cellH = 40;
  const pitch = 31;
  const chassisH = 132;
  const x0 = 22;
  const gap = 12;
  const rowY = [20, 20 + cellH + 8];
  const cells: Cell[] = [];
  for (let p = 1; p <= PANEL_PORTS; p++) {
    const row = p <= 24 ? 0 : 1;
    const col = (p - 1) % 24;
    const x = x0 + col * pitch + Math.floor(col / 8) * gap;
    cells.push({ name: String(p), role: panelRole(p, map), x, y: rowY[row], above: row === 0, label: panelEntry(p, map).label });
  }
  const groupW = 8 * pitch - (pitch - cellW);
  const lastRight = x0 + 2 * (8 * pitch + gap) + groupW;
  return finish(cells, lastRight + x0, chassisH, {
    fields: [0, 1, 2].map((g) => ({
      x: x0 + g * (8 * pitch + gap) - 6,
      y: 12,
      w: groupW + 12,
      h: chassisH - 24,
    })),
    brand: "",
    model: "",
    captions: [],
    cellW,
    cellH,
  });
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

function Jack({ cell, w, h }: { cell: Cell; w: number; h: number }) {
  const color = roleColor(cell.role);
  const filled = Boolean(color);
  const cx = w / 2;
  const plastic = filled ? "#f8fafc" : "#3a414b";
  // The keystone is drawn 22 wide; narrower cells scale it down around its top centre.
  const s = Math.min(1, (w - 6) / 22);
  return (
    <g transform={`translate(${cell.x} ${cell.y})`}>
      <rect
        width={w}
        height={h}
        rx={4}
        fill={filled ? color : "#1c2026"}
        stroke={filled ? "none" : "#4a515c"}
        strokeDasharray={filled ? undefined : "3 2"}
      />
      <g transform={`translate(${cx} 5) scale(${s}) translate(${-cx} -5)`}>
        <rect x={cx - 11} y={5} width={22} height={17} rx={2} fill={plastic} />
        <rect x={cx - 4} y={21} width={8} height={4} fill={plastic} />
        <rect x={cx - 8} y={8} width={16} height={9} rx={1} fill="#0d1014" />
      </g>
      <text
        x={cx}
        y={h - 5}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={600}
        fill={filled ? "#fff" : "#9aa1ad"}
        className="font-mono"
      >
        {cell.name}
      </text>
    </g>
  );
}

function RotLabel({ cell, w, chassis }: { cell: Cell; w: number; chassis: Face["chassis"] }) {
  const text = clip(cell.label);
  // rotate(-90) runs the text upward; shift right so the glyphs sit centered on the port.
  const x = cell.x + w / 2 + 4;
  if (cell.above) {
    const y = chassis.y - 8;
    return (
      <text transform={`rotate(-90 ${x} ${y})`} x={x} y={y} textAnchor="start" fontSize={11} fill="currentColor" className="font-mono">
        {text}
      </text>
    );
  }
  const y = chassis.y + chassis.h + 8;
  return (
    <text transform={`rotate(-90 ${x} ${y})`} x={x} y={y} textAnchor="end" fontSize={11} fill="currentColor" className="font-mono">
      {text}
    </text>
  );
}

function FaceSvg({ face, title }: { face: Face; title: string }) {
  const c = face.chassis;
  return (
    <div className="overflow-x-auto text-ink">
      <svg
        viewBox={`0 0 ${face.width} ${face.height}`}
        role="img"
        aria-label={title}
        className="block h-auto"
        style={{ width: "100%", maxWidth: face.width * 1.15, minWidth: Math.min(face.width, 640) }}
      >
        <g transform={`translate(0 ${c.y})`}>
          <rect x={1} y={0} width={c.w - 2} height={c.h} rx={8} fill="#24282f" stroke="#3a3f48" />
          <rect x={9} y={1} width={c.w - 18} height={3} rx={1.5} fill="#40454f" />
          {face.brand && (
            <>
              <text x={18} y={c.h / 2 - 2} fontSize={18} fontWeight={700} fill="#e6e8ec">
                {face.brand}
              </text>
              <text x={18} y={c.h / 2 + 15} fontSize={9} fill="#9aa1ad" className="font-mono">
                {face.model}
              </text>
            </>
          )}
          {face.fields.map((f, i) => (
            <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx={5} fill="#15181d" />
          ))}
          {face.captions.map((cap) => (
            <text key={cap.text} x={cap.x} y={cap.y} textAnchor="middle" fontSize={8} fill="#8b93a1" className="font-mono">
              {cap.text}
            </text>
          ))}
          {face.cells.map((cell) => (
            <Jack key={cell.name} cell={cell} w={face.cellW} h={face.cellH} />
          ))}
        </g>
        {face.cells.map(
          (cell) => cell.label.trim() && <RotLabel key={`l-${cell.name}`} cell={cell} w={face.cellW} chassis={c} />,
        )}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

const inputCls =
  "rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint hover:border-line focus-visible:border-accent";
const selectCls =
  "rounded-md border border-transparent bg-transparent py-1 pl-1 pr-5 text-[13px] text-ink outline-none hover:border-line focus-visible:border-accent";
const thCls = "px-1 py-1 font-medium";

function RoleDot({ role }: { role: PortRole }) {
  const color = roleColor(role);
  return (
    <span
      aria-hidden
      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
      style={color ? { background: color } : { boxShadow: "inset 0 0 0 1px var(--color-line-strong)" }}
    />
  );
}

function SectionTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1">
      <h2 className="font-display text-[1.05rem] font-semibold leading-none text-ink">{title}</h2>
      <span className="font-mono text-[11px] text-ink-faint">{meta}</span>
    </div>
  );
}

/** The panel: what is in the walls, and where each run is patched. Editable, and the record the hubs read. */
function PanelSection({ map, links }: { map: PortMap; links: Map<string, number> }) {
  const face = panelFace(map);

  const update = (port: number, patch: Partial<PanelEntry>) => {
    const next = { ...panelEntry(port, map), ...patch };
    store.setPortEntry(panelKey(port), isDefaultPanel(port, next) ? null : next);
  };

  // Every hub port a run can be patched to; a port another panel run already
  // holds is shown but cannot be picked twice.
  const options = HUBS.flatMap((hub) =>
    hub.ports
      .filter((port) => !(hub.id === "router" && port.n === 4))
      .map((port) => {
        const key = hubKey(hub.id, port.n);
        const takenBy = links.get(key);
        const local = hubEntry(key, map);
        return {
          key,
          text: `${hub.name} ${port.name}`,
          takenBy: takenBy ?? null,
          note: takenBy != null ? `panel ${pad(takenBy)}` : local.label.trim() || "",
        };
      }),
  );

  return (
    <section aria-label="Patch panel">
      <SectionTitle title="Patch panel" meta="48 · what is in the walls, and the switch port each run goes to" />
      <div className="mt-2">
        <FaceSvg face={face} title="Patch panel, 48 ports" />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              <th className={`${thCls} w-12`}>Port</th>
              <th className={`${thCls} w-24`}>Kind</th>
              <th className={`${thCls} w-36`}>Label</th>
              <th className={thCls}>Feeds</th>
              <th className={`${thCls} w-40`}>Switch port</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PANEL_PORTS }, (_, i) => i + 1).map((port) => {
              const e = panelEntry(port, map);
              return (
                <tr key={port} className="border-t border-line">
                  <td className="whitespace-nowrap px-1 py-0.5 font-mono text-ink-soft">
                    <RoleDot role={panelRole(port, map)} />
                    {pad(port)}
                  </td>
                  <td className="px-1 py-0.5">
                    <select
                      value={e.kind}
                      onChange={(ev) => update(port, { kind: ev.target.value as PanelKind })}
                      aria-label={`Panel ${pad(port)} — kind`}
                      className={selectCls}
                    >
                      {PANEL_KINDS.map((k) => (
                        <option key={k.kind} value={k.kind}>
                          {k.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      value={e.label}
                      onChange={(ev) => update(port, { label: ev.target.value })}
                      placeholder="label"
                      aria-label={`Panel ${pad(port)} — label`}
                      className={`${inputCls} w-full font-mono`}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      value={e.feeds}
                      onChange={(ev) => update(port, { feeds: ev.target.value })}
                      placeholder="room · device · address"
                      aria-label={`Panel ${pad(port)} — feeds`}
                      className={`${inputCls} w-full`}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <select
                      value={e.to}
                      onChange={(ev) => update(port, { to: ev.target.value })}
                      aria-label={`Panel ${pad(port)} — switch port`}
                      className={`${selectCls} w-full font-mono`}
                    >
                      <option value="">—</option>
                      {options.map((o) => (
                        <option key={o.key} value={o.key} disabled={o.takenBy != null && o.takenBy !== port}>
                          {o.text}
                          {o.note && o.takenBy !== port ? ` · ${o.note}` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A hub: its face and table read the panel's links; only cables that never meet the panel are typed here. */
function HubSection({ hub, map, links }: { hub: Hub; map: PortMap; links: Map<string, number> }) {
  const view = (port: HubPort) => hubPortView(hub, port, map, links);
  const face = buildFace(hub, (port) => {
    const v = view(port);
    return { label: v.label, role: v.role };
  });

  // A linked port's label and detail belong to the panel run, so editing them
  // here edits that run; an unlinked port keeps its own entry.
  const update = (port: HubPort, patch: { label?: string; feeds?: string }) => {
    const v = view(port);
    if (v.panel != null) {
      const next = { ...panelEntry(v.panel, map), ...patch };
      store.setPortEntry(panelKey(v.panel), isDefaultPanel(v.panel, next) ? null : next);
      return;
    }
    const key = hubKey(hub.id, port.n);
    const next: HubEntry = { ...hubEntry(key, map), ...patch };
    store.setPortEntry(key, isDefaultHub(key, next) ? null : next);
  };

  return (
    <section aria-label={`${hub.name} ports`}>
      <SectionTitle title={hub.name} meta={hub.model} />
      <div className="mt-2">
        <FaceSvg face={face} title={`${hub.name} front panel`} />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              <th className={`${thCls} w-16`}>Port</th>
              <th className={`${thCls} w-14`}>Panel</th>
              <th className={`${thCls} w-36`}>Label</th>
              <th className={thCls}>Feeds</th>
            </tr>
          </thead>
          <tbody>
            {hub.ports.map((port) => {
              const v = view(port);
              return (
                <tr key={port.n} className="border-t border-line">
                  <td className="whitespace-nowrap px-1 py-0.5 font-mono text-ink-soft">
                    <RoleDot role={v.role} />
                    {port.name}
                  </td>
                  <td className="px-1 py-0.5 text-center font-mono text-ink-soft">{v.panel != null ? pad(v.panel) : "—"}</td>
                  <td className="px-1 py-0.5">
                    <input
                      value={v.label}
                      onChange={(ev) => update(port, { label: ev.target.value })}
                      placeholder="label"
                      aria-label={`${hub.name} ${port.name} — label`}
                      className={`${inputCls} w-full font-mono`}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      value={v.feeds}
                      onChange={(ev) => update(port, { feeds: ev.target.value })}
                      placeholder={v.panel != null ? "" : "direct cable · device"}
                      aria-label={`${hub.name} ${port.name} — feeds`}
                      className={`${inputCls} w-full`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The view                                                                   */
/* -------------------------------------------------------------------------- */

export function PortMapView({ theme, onToggleTheme, onBack }: Props) {
  const [map, setMap] = useState<PortMap>(() => store.getPortMap());
  useEffect(() => store.onPortMapChange(() => setMap(store.getPortMap())), []);

  const links = linksByHubPort(map);
  const panelLabeled = countPanelLabeled(map);
  const hubUsed = countHubUsed(map);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <header className="flex items-start justify-between gap-3 py-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to library"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold leading-none text-ink">Port Map</h1>
            <p className="mt-1 font-mono text-xs text-ink-faint">
              {panelLabeled}/{PANEL_PORTS} panel · {hubUsed}/{TOTAL_HUB_PORTS} switch ports · this device only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset every port to its default on this device?")) store.clearPortMap();
            }}
            aria-label="Reset port map"
            title="Reset port map"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Trash size={18} />
          </button>
        </div>
      </header>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-ink-soft" aria-label="Legend">
        {ROLES.map((r) => (
          <li key={r.role} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={r.color ? { background: r.color } : { boxShadow: "inset 0 0 0 1px var(--color-line-strong)" }}
            />
            {r.title}
          </li>
        ))}
      </ul>

      <main className="mt-6 space-y-10">
        <PanelSection map={map} links={links} />
        {HUBS.map((hub) => (
          <HubSection key={hub.id} hub={hub} map={map} links={links} />
        ))}
      </main>
    </div>
  );
}
