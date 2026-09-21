import { useEffect, useState } from "react";
import {
  HUBS,
  PANEL_PORTS,
  ROLES,
  TOTAL_PORTS,
  countLabeled,
  isDefaultEntry,
  pad,
  panelRuns,
  portKey,
  resolvePort,
  roleColor,
} from "../lib/ports";
import type { Hub, PanelRun, PortDef, PortEntry, PortMap, PortRole } from "../lib/ports";
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
/* Faces — each hub drawn as its own front panel, ports where they really are */
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

/** The VIMIN: three blocks of four columns, odd ports on top, uplinks 25 over 26. */
function viminFace(hub: Hub, labelOf: (d: PortDef) => string): Face {
  const chassisH = 144;
  const x0 = 200;
  const gap = 16;
  const groupW = 4 * PITCH;
  const rowY = [26, 26 + CELL_H + 8];
  const blockW = 3 * groupW + 2 * gap;
  const uplinkX = x0 + blockW + 26;
  const cells: Cell[] = hub.ports.map((d) => {
    if (d.n <= 24) {
      const idx = d.n - 1;
      const group = Math.floor(idx / 8);
      const within = idx % 8;
      const col = Math.floor(within / 2);
      const row = within % 2;
      return {
        name: d.name,
        role: d.role,
        x: x0 + group * (groupW + gap) + col * PITCH,
        y: rowY[row],
        above: row === 0,
        label: labelOf(d),
      };
    }
    const row = d.n === 25 ? 0 : 1;
    return { name: d.name, role: d.role, x: uplinkX, y: rowY[row], above: row === 0, label: labelOf(d) };
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
  labelOf: (d: PortDef) => string,
  opts: { brand: string; model: string; x0: number; gapBefore?: number; caption?: string },
): Face {
  const chassisH = 92;
  let x = opts.x0;
  const cells: Cell[] = hub.ports.map((d, i) => {
    if (opts.gapBefore === i) x += 24;
    const cell: Cell = { name: d.name, role: d.role, x, y: 24, above: false, label: labelOf(d) };
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

function buildFace(hub: Hub, labelOf: (d: PortDef) => string): Face {
  switch (hub.id) {
    case "vimin":
      return viminFace(hub, labelOf);
    case "gs308":
      return rowFace(hub, labelOf, { brand: "NETGEAR", model: "GS308EPP", x0: 150, caption: "PoE+ · 1–8" });
    case "router":
      return rowFace(hub, labelOf, { brand: "verizon", model: "CR1000A", x0: 140, gapBefore: 3 });
  }
}

/** The 48-port panel, read back from the hubs: 1–24 on top, 25–48 below, in blocks of eight. */
function panelFace(runs: Map<string, PanelRun>): Face {
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
    const run = runs.get(pad(p));
    const role: PortRole = run?.kind === "hub" ? run.def.role : "spare";
    const label = run ? run.entry.label.trim() || (run.kind === "legacy" ? run.entry.feeds : "") : "";
    cells.push({ name: String(p), role, x, y: rowY[row], above: row === 0, label });
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
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const inputCls =
  "rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint hover:border-line focus-visible:border-accent";

function HubSection({
  hub,
  map,
  onChange,
}: {
  hub: Hub;
  map: PortMap;
  onChange: (hub: Hub, def: PortDef, patch: Partial<PortEntry>) => void;
}) {
  const face = buildFace(hub, (d) => resolvePort(d, map, hub.id).label);
  return (
    <section aria-label={`${hub.name} ports`}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1">
        <h2 className="font-display text-[1.05rem] font-semibold leading-none text-ink">{hub.name}</h2>
        <span className="font-mono text-[11px] text-ink-faint">{hub.model}</span>
      </div>
      <div className="mt-2">
        <FaceSvg face={face} title={`${hub.name} front panel`} />
      </div>
      <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
            <th className="w-16 px-1 py-1 font-medium">Port</th>
            <th className="w-14 px-1 py-1 font-medium">Panel</th>
            <th className="w-32 px-1 py-1 font-medium">Label</th>
            <th className="px-1 py-1 font-medium">Feeds</th>
          </tr>
        </thead>
        <tbody>
          {hub.ports.map((def) => {
            const entry = resolvePort(def, map, hub.id);
            const color = roleColor(def.role);
            return (
              <tr key={def.n} className="border-t border-line">
                <td className="whitespace-nowrap px-1 py-0.5 font-mono text-ink-soft">
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={
                      color
                        ? { background: color }
                        : { boxShadow: "inset 0 0 0 1px var(--color-line-strong)" }
                    }
                  />
                  {def.name}
                </td>
                <td className="px-1 py-0.5">
                  <input
                    value={entry.panel}
                    onChange={(e) => onChange(hub, def, { panel: e.target.value })}
                    placeholder="—"
                    aria-label={`${hub.name} ${def.name} — panel port`}
                    className={`${inputCls} w-12 text-center font-mono`}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    value={entry.label}
                    onChange={(e) => onChange(hub, def, { label: e.target.value })}
                    placeholder="label"
                    aria-label={`${hub.name} ${def.name} — label`}
                    className={`${inputCls} w-full font-mono`}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    value={entry.feeds}
                    onChange={(e) => onChange(hub, def, { feeds: e.target.value })}
                    placeholder="room · device · address"
                    aria-label={`${hub.name} ${def.name} — feeds`}
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

function PanelSection({ map }: { map: PortMap }) {
  const face = panelFace(panelRuns(map));
  return (
    <section aria-label="Patch panel">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1">
        <h2 className="font-display text-[1.05rem] font-semibold leading-none text-ink">Patch panel</h2>
        <span className="font-mono text-[11px] text-ink-faint">48 · read from the switch tables below</span>
      </div>
      <div className="mt-2">
        <FaceSvg face={face} title="Patch panel, 48 ports" />
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

  const labeled = countLabeled(map);

  const onChange = (hub: Hub, def: PortDef, patch: Partial<PortEntry>) => {
    const next = { ...resolvePort(def, map, hub.id), ...patch };
    store.setPortEntry(portKey(hub.id, def.n), isDefaultEntry(def, next) ? null : next);
  };

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
              {labeled} of {TOTAL_PORTS} labeled · this device only
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
        <PanelSection map={map} />
        {HUBS.map((hub) => (
          <HubSection key={hub.id} hub={hub} map={map} onChange={onChange} />
        ))}
      </main>
    </div>
  );
}
