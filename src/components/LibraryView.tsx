import { useEffect, useId, useRef, useState } from "react";
import * as store from "../lib/storage";
import type { Guide, GuideOrigin } from "../lib/types";
import { BookOpen, More, Plus, Search, Trash } from "./Icons";
import { ProgressRing } from "./ProgressRing";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../lib/storage";

export type LibraryItem = {
  guide: Guide;
  origin: GuideOrigin;
  markdown: string;
};

type Props = {
  items: LibraryItem[];
  theme: Theme;
  onToggleTheme: () => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
};

export function LibraryView({
  items,
  theme,
  onToggleTheme,
  onOpen,
  onAdd,
  onReset,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const showSearch = items.length > 5;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (i) =>
          i.guide.title.toLowerCase().includes(q) ||
          i.guide.subtitle?.toLowerCase().includes(q),
      )
    : items;

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-contrast">
            <BookOpen size={20} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold leading-none text-ink">
              Runbook
            </h1>
            <p className="mt-1 text-xs text-ink-faint">
              {items.length} {items.length === 1 ? "guide" : "guides"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button type="button" onClick={onAdd} className="btn btn-primary">
            <Plus size={17} /> <span className="hidden sm:inline">Add guide</span>
          </button>
        </div>
      </header>

      {showSearch && (
        <div className="relative mt-4 max-w-sm">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter guides…"
            aria-label="Filter guides by name"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyLibrary onAdd={onAdd} />
      ) : filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-soft">
          No guides match “{query}”.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <GuideCard
              key={item.guide.id}
              item={item}
              onOpen={() => onOpen(item.guide.id)}
              onReset={() => onReset(item.guide.id)}
              onRemove={() => onRemove(item.guide.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuideCard({
  item,
  onOpen,
  onReset,
  onRemove,
}: {
  item: LibraryItem;
  onOpen: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const { guide, origin } = item;
  const doneCount = store.getProgressCount(guide.id);
  const status =
    guide.totalSteps > 0 && doneCount >= guide.totalSteps
      ? "Done"
      : doneCount > 0
        ? "Resume"
        : "Start";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="rb-card relative flex min-h-[152px] cursor-pointer flex-col gap-3 p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift focus-visible:-translate-y-0.5"
    >
      <div className="absolute right-2.5 top-2.5">
        <CardMenu
          origin={origin}
          hasProgress={doneCount > 0}
          onReset={onReset}
          onRemove={onRemove}
        />
      </div>

      <div className="flex items-start gap-3.5">
        <ProgressRing done={doneCount} total={guide.totalSteps} />
        <div className="min-w-0 flex-1 pr-7">
          <h3 className="line-clamp-2 font-display text-[1.06rem] font-semibold leading-snug text-ink">
            {guide.title}
          </h3>
          {guide.subtitle && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft">
              {guide.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between font-mono text-[11px] text-ink-faint">
        <span className="tabular-nums">
          {guide.phases.length} {guide.phases.length === 1 ? "phase" : "phases"} ·{" "}
          {guide.totalSteps} {guide.totalSteps === 1 ? "step" : "steps"}
        </span>
        <span
          className={`font-sans font-medium ${
            status === "Done" ? "text-accent" : "text-ink-soft"
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

function CardMenu({
  origin,
  hasProgress,
  onReset,
  onRemove,
}: {
  origin: GuideOrigin;
  hasProgress: boolean;
  onReset: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div ref={ref} className="relative" onClick={stop}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Guide options"
        className="btn btn-quiet h-8 w-8 !px-0"
      >
        <More size={18} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-9 z-30 min-w-[180px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lift"
        >
          {hasProgress ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
            >
              Reset progress
            </button>
          ) : (
            origin === "bundled" && (
              <p className="px-3 py-2 text-xs text-ink-faint">Built-in guide</p>
            )
          )}
          {origin === "imported" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              <Trash size={15} /> Remove guide
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-ink-faint">
        <BookOpen size={26} />
      </span>
      <h2 className="font-display text-xl font-semibold text-ink">
        Your library is empty
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Add your first guide by pasting Markdown or dropping a{" "}
        <code className="font-mono text-[0.85em]">.md</code> file. A procedure
        becomes a clean, checkable path.
      </p>
      <button type="button" onClick={onAdd} className="btn btn-primary mt-6">
        <Plus size={17} /> Add your first guide
      </button>
    </div>
  );
}
