import { useEffect, useId, useMemo, useRef, useState } from "react";
import { accentStyle } from "../lib/accents";
import { groupByCollection } from "../lib/collections";
import {
  collectCredentialFields,
  countFilled,
  STANDALONE_SCOPE,
} from "../lib/credentials";
import * as store from "../lib/storage";
import type { Guide, GuideOrigin } from "../lib/types";
import { BookOpen, ChevronDown, Key, More, Plus, Search, Trash } from "./Icons";
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
  /** Open the Credentials view scoped to one collection (or standalone). */
  onOpenCredentials: (scope: string) => void;
  onAdd: () => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
};

export function LibraryView({
  items,
  theme,
  onToggleTheme,
  onOpen,
  onOpenCredentials,
  onAdd,
  onReset,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    store.getLibCollapsed(),
  );
  const showSearch = items.length > 5;
  const q = query.trim().toLowerCase();

  const toggleSection = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      store.saveLibCollapsed(next);
      return next;
    });
  };
  // While searching, show every match — ignore collapse state.
  const isCollapsed = (name: string) => !q && collapsed.has(name);
  const filtered = useMemo(
    () =>
      q
        ? items.filter(
            (i) =>
              i.guide.title.toLowerCase().includes(q) ||
              i.guide.subtitle?.toLowerCase().includes(q) ||
              i.guide.collection?.toLowerCase().includes(q),
          )
        : items,
    [q, items],
  );
  // Memoized so section item arrays keep their identity across re-renders —
  // each CredentialsCard's field collection and subscription depend on it.
  const grouped = useMemo(() => groupByCollection(filtered), [filtered]);

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-contrast">
            <BookOpen size={20} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold leading-none text-ink">
              RunBook
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
        <>
          {grouped.collections.map((col) => (
            <section key={col.name} aria-label={`${col.name} collection`}>
              <CollectionHeader
                name={col.name}
                items={col.items}
                collapsed={isCollapsed(col.name)}
                onToggle={() => toggleSection(col.name)}
              />
              <Collapsible collapsed={isCollapsed(col.name)}>
                {!q && (
                  <CredentialsCard
                    items={col.items}
                    onOpen={() => onOpenCredentials(col.name)}
                  />
                )}
                <CardGrid
                  items={col.items}
                  theme={theme}
                  onOpen={onOpen}
                  onReset={onReset}
                  onRemove={onRemove}
                />
              </Collapsible>
            </section>
          ))}

          {grouped.standalone.length > 0 && (
            <section aria-label="Standalone guides">
              {grouped.collections.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleSection("__standalone__")}
                  aria-expanded={!isCollapsed("__standalone__")}
                  className="group mb-1 mt-8 flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-surface-2/60"
                >
                  <h2 className="font-display text-[1.05rem] font-semibold leading-none text-ink">
                    Standalone
                  </h2>
                  <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                    {grouped.standalone.length}{" "}
                    {grouped.standalone.length === 1 ? "guide" : "guides"}
                  </span>
                  <ChevronDown
                    size={17}
                    className={`ml-auto shrink-0 text-ink-faint transition-transform duration-300 ${
                      isCollapsed("__standalone__") ? "-rotate-90" : ""
                    }`}
                  />
                </button>
              )}
              <Collapsible
                collapsed={
                  grouped.collections.length > 0 && isCollapsed("__standalone__")
                }
              >
                {!q && (
                  <CredentialsCard
                    items={grouped.standalone}
                    onOpen={() => onOpenCredentials(STANDALONE_SCOPE)}
                  />
                )}
                <CardGrid
                  items={grouped.standalone}
                  theme={theme}
                  onOpen={onOpen}
                  onReset={onReset}
                  onRemove={onRemove}
                />
              </Collapsible>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A collection's entry to the Credentials view: every IP/username/password
 * its guides ask the reader to choose, gathered in one device-local place.
 * Renders nothing for groups whose guides declare no fields.
 */
function CredentialsCard({
  items,
  onOpen,
}: {
  items: LibraryItem[];
  onOpen: () => void;
}) {
  const fields = useMemo(() => collectCredentialFields(items), [items]);
  const [filled, setFilled] = useState(() =>
    countFilled(fields, store.getCredentials()),
  );
  useEffect(() => {
    setFilled(countFilled(fields, store.getCredentials()));
    return store.onCredentialsChange(() =>
      setFilled(countFilled(fields, store.getCredentials())),
    );
  }, [fields]);
  if (fields.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rb-card mt-3 flex w-full cursor-pointer items-center gap-3.5 px-4 py-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
        <Key size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1rem] font-semibold leading-snug text-ink">
          Credentials
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">
          {filled} of {fields.length} filled in · stored only on this device
        </span>
      </span>
      <ChevronDown size={17} className="shrink-0 -rotate-90 text-ink-faint" />
    </button>
  );
}

function CollectionHeader({
  name,
  items,
  collapsed,
  onToggle,
}: {
  name: string;
  items: LibraryItem[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  let done = 0;
  let total = 0;
  for (const { guide } of items) {
    done += Math.min(store.getProgressCount(guide.id), guide.totalSteps);
    total += guide.totalSteps;
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="group mb-1 mt-8 flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-surface-2/60"
    >
      <ProgressRing done={done} total={total} size={26} stroke={3.5} showLabel={false} />
      <h2 className="font-display text-[1.05rem] font-semibold leading-none text-ink">
        {name}
      </h2>
      <span className="mt-px font-mono text-[11px] tabular-nums text-ink-faint">
        {items.length} {items.length === 1 ? "guide" : "guides"} · {done}/{total} steps
      </span>
      <ChevronDown
        size={17}
        className={`ml-auto shrink-0 text-ink-faint transition-transform duration-300 ${
          collapsed ? "-rotate-90" : ""
        }`}
      />
    </button>
  );
}

/** Smooth grid-rows collapse, matching the reader's phase animation. */
function Collapsible({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      inert={collapsed || undefined}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="px-1 pb-4">{children}</div>
      </div>
    </div>
  );
}

function CardGrid({
  items,
  theme,
  onOpen,
  onReset,
  onRemove,
}: {
  items: LibraryItem[];
  theme: Theme;
  onOpen: (id: string) => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <GuideCard
          key={item.guide.id}
          item={item}
          theme={theme}
          onOpen={() => onOpen(item.guide.id)}
          onReset={() => onReset(item.guide.id)}
          onRemove={() => onRemove(item.guide.id)}
        />
      ))}
    </div>
  );
}

function GuideCard({
  item,
  theme,
  onOpen,
  onReset,
  onRemove,
}: {
  item: LibraryItem;
  theme: Theme;
  onOpen: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const { guide, origin } = item;
  const doneCount = store.getProgressCount(guide.id);
  // Per-guide accent: overrides the accent tokens for this card (ring, status,
  // left rail) and falls back to the app accent for the default palette. A
  // soft wash of the accent fades in from the rail so groups read at a glance.
  const cardStyle = {
    ...accentStyle(guide.accent, theme),
    borderLeftColor: "var(--color-accent)",
    background:
      "linear-gradient(105deg, color-mix(in srgb, var(--color-accent) 16%, var(--color-surface)) 0%, var(--color-surface) 55%)",
  };
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
      style={cardStyle}
      className="rb-card relative flex min-h-[152px] cursor-pointer flex-col gap-3 border-l-[3px] p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5"
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
