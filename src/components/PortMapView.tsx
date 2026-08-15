import { useEffect, useState } from "react";
import * as store from "../lib/storage";
import type { PortRow, Theme } from "../lib/storage";
import { ArrowLeft, Trash } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
};

/** Ports on the patch panel, and how the build groups them. */
const PANEL_PORTS = 48;
const BANDS: { from: number; to: number; title: string; note: string }[] = [
  {
    from: 1,
    to: 1,
    title: "Trunk",
    note: "The single in-wall run between the two locations, carrying every camera and shade back to the router. Label this panel port unmistakably — losing it takes the whole rack offline.",
  },
  {
    from: 2,
    to: 9,
    title: "Cameras → GS308EPP",
    note: "Eight ports mapped one-for-one onto the 8-port PoE switch, so anything here patches to the little switch without thinking.",
  },
  {
    from: 10,
    to: 33,
    title: "Shades → VIMIN",
    note: "Twenty-four ports matching the VIMIN's PoE count exactly, so the block cannot be over-subscribed. One run per motor — a dual shade takes two. Number them geographically, walking the house in one direction.",
  },
  {
    from: 34,
    to: PANEL_PORTS,
    title: "Spare",
    note: "Future wall jacks, an access point, a second run to a room that needs one.",
  },
];

export function PortMapView({ theme, onToggleTheme, onBack }: Props) {
  const [map, setMap] = useState<store.PortMap>(() => store.getPortMap());

  useEffect(() => store.onPortMapChange(() => setMap(store.getPortMap())), []);

  const mapped = Object.keys(map).length;

  const update = (port: number, patch: Partial<PortRow>) => {
    const current = map[String(port)] ?? { feeds: "", switchPort: "" };
    store.setPortRow(port, { ...current, ...patch });
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
            <h1 className="font-display text-xl font-semibold leading-none text-ink">
              Port Mapping
            </h1>
            <p className="mt-1 font-mono text-xs text-ink-faint">
              {mapped} of {PANEL_PORTS} mapped · stored only on this device
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Clear every port mapping on this device?"))
                store.clearPortMap();
            }}
            aria-label="Clear port mapping"
            title="Clear port mapping"
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Trash size={18} />
          </button>
        </div>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        One row per <strong className="text-ink">in-wall run</strong>, so a cable
        can be traced from either end without a tone generator. Anything running
        through a wall lands on the panel; anything sitting in the rack connects
        directly — so the switch-to-switch and server-to-router links never
        appear here.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Write the same number at <strong className="text-ink">both ends</strong>{" "}
        of every run — the panel port and the wall plate it feeds — and label
        each patch cable at the switch with its panel number.
      </p>

      <main className="mt-6 space-y-8">
        {BANDS.map((band) => (
          <section key={band.title} aria-label={`${band.title} ports`}>
            <div className="mb-1 flex items-baseline gap-2.5 px-1">
              <h2 className="font-display text-[1.05rem] font-semibold leading-none text-ink">
                {band.title}
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                {band.from === band.to
                  ? `port ${band.from}`
                  : `ports ${band.from}–${band.to}`}
              </span>
            </div>
            <p className="mb-3 px-1 text-[13px] leading-snug text-ink-faint">
              {band.note}
            </p>

            <div className="space-y-2">
              {Array.from(
                { length: band.to - band.from + 1 },
                (_, i) => band.from + i,
              ).map((port) => {
                const row = map[String(port)] ?? { feeds: "", switchPort: "" };
                return (
                  <div
                    key={port}
                    className="rb-card flex items-center gap-2.5 px-3 py-2"
                  >
                    <span className="w-8 shrink-0 font-mono text-sm tabular-nums text-ink-faint">
                      {String(port).padStart(2, "0")}
                    </span>
                    <input
                      value={row.feeds}
                      onChange={(e) => update(port, { feeds: e.target.value })}
                      placeholder="what it feeds"
                      aria-label={`Panel port ${port} — what it feeds`}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                    />
                    <input
                      value={row.switchPort}
                      onChange={(e) =>
                        update(port, { switchPort: e.target.value })
                      }
                      placeholder="switch port"
                      aria-label={`Panel port ${port} — switch port`}
                      className="w-28 shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
