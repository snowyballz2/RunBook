import { useEffect, useMemo, useRef, useState } from "react";
import { accentStyle } from "../lib/accents";
import { buildSearchIndex, searchIndex } from "../lib/search";
import * as store from "../lib/storage";
import type { Theme } from "../lib/storage";
import type { Guide, Phase, Step } from "../lib/types";
import { Blocks } from "./Blocks";
import { ArrowLeft, ChevronDown, Printer, Refresh, Rows, Search, Stack, X } from "./Icons";
import { SpineCell } from "./ProgressSpine";
import { StepCard } from "./StepCard";
import { SwipeView } from "./SwipeView";
import { ThemeToggle } from "./ThemeToggle";

/** True below Tailwind's `sm` breakpoint — the phone reader's trigger. */
function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = matchMedia("(max-width: 639px)");
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isPhone;
}

type Props = {
  guide: Guide;
  /** Open scrolled to this step — the library's step-level search lands here. */
  initialStepId?: string;
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
};

type StepView = {
  step: Step;
  globalIndex: number;
  done: boolean;
  current: boolean;
  isLast: boolean;
  upperFilled: boolean;
  lowerFilled: boolean;
};

type PhaseView = {
  phase: Phase;
  label: string;
  doneInPhase: number;
  complete: boolean;
  active: boolean;
  isFirstStation: boolean;
  stationUpper: boolean;
  stationLower: boolean;
  steps: StepView[];
};

export function ReaderView({ guide, initialStepId, theme, onToggleTheme, onBack }: Props) {
  const [done, setDone] = useState<Set<string>>(() => store.getProgress(guide.id));
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    initialCollapsed(guide, store.getProgress(guide.id), store.getCollapsed(guide.id)),
  );

  // Phones default to the one-step-at-a-time deck; the header button swaps
  // back to the long page, and the choice sticks. A deep link to a step opens
  // the long page regardless, so the step can be scrolled into view.
  const isPhone = useIsPhone();
  const [readerMode, setReaderMode] = useState(() =>
    initialStepId ? "scroll" : store.getReaderMode(),
  );
  const toggleReaderMode = () => {
    setReaderMode((m) => {
      const next = m === "swipe" ? "scroll" : "swipe";
      store.saveReaderMode(next);
      return next;
    });
  };

  // Search: a symptom-first page (frontmatter `search: true`) opens with the
  // box showing; every other guide has it behind the header's magnifier.
  // While a query is live, only matching steps render, every phase open.
  const [searchOpen, setSearchOpen] = useState(Boolean(guide.search));
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => buildSearchIndex(guide), [guide]);
  const q = query.trim();
  const hits = useMemo(
    () => (q ? new Set(searchIndex(index, q).map((e) => e.stepId)) : null),
    [index, q],
  );
  const swipeActive = isPhone && readerMode === "swipe" && guide.totalSteps > 0 && !hits;

  // Persist whenever progress/collapse changes.
  useEffect(() => store.saveProgress(guide.id, done), [guide.id, done]);
  useEffect(() => store.saveCollapsed(guide.id, collapsed), [guide.id, collapsed]);

  const view = useMemo(() => buildView(guide, done), [guide, done]);
  const { phaseViews, doneCount, total, frontierId, guideComplete } = view;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Resume: on open, scroll to the linked step if there is one, otherwise to
  // the first unchecked step (once, on mount). The swipe deck does its own
  // resuming, so skip when it owns the screen. No "already ran" ref here:
  // StrictMode's development double-mount would set it on the first pass,
  // cancel that pass's pending scroll in cleanup, and skip the second.
  useEffect(() => {
    if (swipeActive) return;
    let target: string | null = null;
    if (initialStepId && guide.phases.some((p) => p.steps.some((s) => s.id === initialStepId))) {
      target = initialStepId;
      const phase = guide.phases.find((p) => p.steps.some((s) => s.id === initialStepId));
      if (phase)
        setCollapsed((c) => {
          const next = new Set(c);
          next.delete(phase.id);
          return next;
        });
    } else if (frontierId && done.size > 0) {
      // Only jump when there's progress to resume; a fresh guide opens at the top.
      target = frontierId;
    }
    if (!target) return;
    // A linked step is a jump, not a resume: land on it instantly, so neither
    // a long page nor a mid-flight re-render can leave the scroll short.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = target === initialStepId || reduce;
    const t = setTimeout(() => {
      const el = document.getElementById(`step-${target}`);
      el?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Print the whole guide: pop every closed <details> open for the print run,
  // then restore. (Collapsed phases are handled in CSS via .phase-collapser.)
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const onBefore = () => {
      document
        .querySelectorAll<HTMLDetailsElement>("details.rb-details:not([open])")
        .forEach((d) => {
          d.open = true;
          opened.push(d);
        });
    };
    const onAfter = () => {
      opened.splice(0).forEach((d) => (d.open = false));
    };
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
    };
  }, []);

  const toggleStep = (phase: Phase, step: Step) => {
    const willComplete = !done.has(step.id);
    const completesPhase =
      willComplete && phase.steps.every((s) => s.id === step.id || done.has(s.id));

    setDone((prev) => {
      const nextDone = new Set(prev);
      if (willComplete) nextDone.add(step.id);
      else nextDone.delete(step.id);
      return nextDone;
    });

    // Auto-collapse a phase the moment its last step is checked — and anchor
    // the view on its header. The last step sits at the bottom of the phase,
    // so the content folding away is above the viewport; Safari has no scroll
    // anchoring, and would otherwise land the reader well past the next phase.
    // The header sits above the fold, so its position is already final.
    if (completesPhase && !hits) {
      setCollapsed((c) => new Set(c).add(phase.id));
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(`phase-${phase.id}`)
        ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  const togglePhase = (phaseId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const onReset = () => {
    if (
      doneCount > 0 &&
      !window.confirm(`Reset all progress for “${guide.title}”?`)
    )
      return;
    store.resetProgress(guide.id);
    setDone(new Set());
  };

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setQuery("");
      return !open;
    });
  };
  useEffect(() => {
    if (searchOpen && !guide.search) searchRef.current?.focus();
  }, [searchOpen, guide.search]);

  // What the long page shows: everything, or only the steps the query hits.
  const shownViews = useMemo(() => {
    if (!hits) return phaseViews;
    return phaseViews
      .map((pv) => ({ ...pv, steps: pv.steps.filter((sv) => hits.has(sv.step.id)) }))
      .filter((pv) => pv.steps.length > 0);
  }, [phaseViews, hits]);
  const hitCount = hits ? hits.size : 0;

  const rootStyle = accentStyle(guide.accent, theme);

  return (
    <div
      className={`reader ${swipeActive ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh"}`}
      style={rootStyle}
    >
      {/* Sticky header ----------------------------------------------------- */}
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className="btn btn-quiet h-9 w-9 shrink-0 !px-0"
            aria-label="Back to library"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[15px] font-semibold leading-tight text-ink">
              {guide.title}
            </h1>
            <div className="mt-1.5 flex items-center gap-2.5">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Guide progress"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-soft">
                {total > 0 ? `${doneCount}/${total} · ${pct}%` : "reference"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            {guide.totalSteps > 0 && (
              <button
                type="button"
                onClick={toggleSearch}
                className="btn btn-quiet h-9 w-9 !px-0"
                aria-label={searchOpen ? "Hide search" : "Search this guide"}
                aria-pressed={searchOpen}
                title={searchOpen ? "Hide search" : "Search this guide"}
              >
                <Search size={17} />
              </button>
            )}
            {guide.totalSteps > 0 && (
              <button
                type="button"
                onClick={toggleReaderMode}
                className="btn btn-quiet h-9 w-9 !px-0 sm:hidden"
                aria-label={
                  readerMode === "swipe"
                    ? "Switch to full-page view"
                    : "Switch to one-step-at-a-time view"
                }
                title={readerMode === "swipe" ? "Full page" : "One step at a time"}
              >
                {readerMode === "swipe" ? <Rows size={17} /> : <Stack size={17} />}
              </button>
            )}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-quiet hidden h-9 w-9 !px-0 sm:inline-flex"
              aria-label="Print or save as PDF"
              title="Print / save as PDF"
            >
              <Printer size={17} />
            </button>
            <button
              type="button"
              onClick={onReset}
              className="btn btn-quiet h-9 w-9 !px-0"
              aria-label="Reset progress"
              title="Reset progress"
              disabled={doneCount === 0}
            >
              <Refresh size={17} />
            </button>
          </div>
        </div>

        {searchOpen && guide.totalSteps > 0 && (
          <div className="mx-auto max-w-3xl px-4 pb-2.5">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={guide.search ? "Search symptoms — rescue mode, no frames, cannot join…" : "Find in this guide…"}
                aria-label={guide.search ? "Search symptoms" : "Find in this guide"}
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-24 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {hits && (
                  <span className="font-mono text-[11px] tabular-nums text-ink-faint" aria-live="polite">
                    {hitCount} of {total}
                  </span>
                )}
                {q && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="btn btn-quiet h-7 w-7 !px-0"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Body -------------------------------------------------------------- */}
      {swipeActive ? (
        <SwipeView
          guide={guide}
          done={done}
          onToggleStep={toggleStep}
          onBack={onBack}
        />
      ) : (
        <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 [overflow-anchor:none]">
          {!hits && guide.subtitle && (
            <p className="mb-6 text-[15px] leading-relaxed text-ink-soft">
              {guide.subtitle}
            </p>
          )}

          {!hits && guide.intro && guide.intro.length > 0 && (
            <div className="mb-8 rounded-2xl border border-line bg-surface-2/60 px-5 py-4">
              <Blocks blocks={guide.intro} />
            </div>
          )}

          {!hits && guideComplete && (
            <div className="animate-rise mb-6 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
              <span aria-hidden>✓</span> Every step complete. Nicely done.
            </div>
          )}

          {hits && shownViews.length === 0 && (
            <p className="mt-10 text-center text-sm text-ink-soft">
              Nothing in this guide matches “{q}”.
            </p>
          )}

          {shownViews.map((pv, pi) => (
            <PhaseSection
              key={pv.phase.id}
              pv={pv}
              isFirst={pi === 0}
              collapsed={!hits && collapsed.has(pv.phase.id)}
              guideComplete={guideComplete}
              doneSet={done}
              onTogglePhase={() => togglePhase(pv.phase.id)}
              onToggleStep={(s) => toggleStep(pv.phase, s)}
            />
          ))}
        </main>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Phase section                                                              */
/* -------------------------------------------------------------------------- */

function PhaseSection({
  pv,
  isFirst,
  collapsed,
  guideComplete,
  doneSet,
  onTogglePhase,
  onToggleStep,
}: {
  pv: PhaseView;
  isFirst: boolean;
  collapsed: boolean;
  guideComplete: boolean;
  doneSet: Set<string>;
  onTogglePhase: () => void;
  onToggleStep: (step: Step) => void;
}) {
  const { phase } = pv;
  const total = phase.steps.length;

  return (
    <section id={`phase-${phase.id}`} className={`scroll-mt-20 ${isFirst ? "" : "mt-2"}`}>
      {/* Phase header row */}
      <div className="spine-grid">
        <SpineCell
          variant="station"
          label={pv.label}
          filled={pv.complete}
          activePhase={pv.active}
          upperFilled={pv.stationUpper}
          lowerFilled={pv.stationLower}
          isFirst={pv.isFirstStation}
        />
        <button
          type="button"
          onClick={onTogglePhase}
          aria-expanded={!collapsed}
          className="group flex w-full items-start gap-3 rounded-lg px-1 pb-2 pt-5 text-left transition-colors hover:bg-surface-2/50"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[1.35rem] font-semibold leading-tight text-ink">
              {phase.title || "Steps"}
            </span>
            {total > 0 && (
              <span className="mt-1 inline-flex items-center gap-2 font-mono text-[11px] text-ink-faint">
                <span className="tabular-nums">
                  {pv.doneInPhase}/{total} steps
                </span>
                {pv.complete && (
                  <span className="rounded-full bg-accent/12 px-1.5 py-0.5 font-medium text-accent">
                    done
                  </span>
                )}
              </span>
            )}
          </span>
          <ChevronDown
            size={20}
            className={`mt-1 shrink-0 text-ink-faint transition-transform duration-300 ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </button>
      </div>

      {/* Collapsible steps (and the phase intro, which collapses with them) */}
      <div
        className="phase-collapser grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="spine-grid pt-2">
            {phase.intro && phase.intro.length > 0 && (
              <>
                <SpineCell
                  variant="rail"
                  filled={false}
                  upperFilled={pv.stationLower}
                  lowerFilled={pv.stationLower}
                />
                <div className="pb-3 text-ink-soft">
                  <Blocks blocks={phase.intro} />
                </div>
              </>
            )}
            {pv.steps.map((sv) => (
              <SpineRow key={sv.step.id}>
                <SpineCell
                  variant="node"
                  filled={sv.done}
                  current={sv.current}
                  isLast={sv.isLast}
                  guideComplete={guideComplete}
                  upperFilled={sv.upperFilled}
                  lowerFilled={sv.lowerFilled}
                />
                <div className="pb-3">
                  <StepCard
                    step={sv.step}
                    done={doneSet.has(sv.step.id)}
                    active={sv.current}
                    index={phase.steps.indexOf(sv.step)}
                    onToggle={() => onToggleStep(sv.step)}
                  />
                </div>
              </SpineRow>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A single (spine cell, content) pair — both are direct grid children. */
function SpineRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */
/* View model                                                                 */
/* -------------------------------------------------------------------------- */

function buildView(guide: Guide, done: Set<string>) {
  const total = guide.totalSteps;

  // Frontier = index of the first unchecked step (in global order), or `total`
  // when the guide is complete, or -1 when there are no steps at all.
  let frontier = -1;
  let frontierId: string | null = null;
  if (total > 0) {
    let g = 0;
    let found = false;
    for (const phase of guide.phases) {
      for (const step of phase.steps) {
        if (!done.has(step.id)) {
          frontier = g;
          frontierId = step.id;
          found = true;
          break;
        }
        g++;
      }
      if (found) break;
    }
    if (!found) frontier = total;
  }

  const guideComplete = total > 0 && frontier === total;
  const reached = (i: number) => frontier >= 0 && i <= frontier;

  const phaseViews: PhaseView[] = [];
  let gi = 0;
  let doneCount = 0;
  let phaseIndex = 0;

  for (const phase of guide.phases) {
    phaseIndex++;
    const firstStepGlobal = gi;
    const stepCount = phase.steps.length;
    const doneInPhase = phase.steps.reduce((n, s) => n + (done.has(s.id) ? 1 : 0), 0);
    const complete = stepCount > 0 && doneInPhase === stepCount;
    const active =
      frontier >= 0 &&
      frontier < total &&
      firstStepGlobal <= frontier &&
      frontier < firstStepGlobal + stepCount;

    const steps: StepView[] = phase.steps.map((step) => {
      const globalIndex = gi++;
      const isDone = done.has(step.id);
      if (isDone) doneCount++;
      return {
        step,
        globalIndex,
        done: isDone,
        current: globalIndex === frontier && frontier < total,
        isLast: globalIndex === total - 1,
        upperFilled: reached(globalIndex),
        lowerFilled: reached(globalIndex) && globalIndex < frontier,
      };
    });

    phaseViews.push({
      phase,
      label: String(phaseIndex),
      doneInPhase,
      complete,
      active,
      isFirstStation: phaseIndex === 1,
      stationUpper: reached(firstStepGlobal),
      stationLower: reached(firstStepGlobal),
      steps,
    });
  }

  return { phaseViews, doneCount, total, frontierId, guideComplete };
}

/** Completed phases start collapsed, except the one holding the next step. */
function initialCollapsed(
  guide: Guide,
  done: Set<string>,
  stored: Set<string>,
): Set<string> {
  const result = new Set(stored);
  let frontierFound = false;
  for (const phase of guide.phases) {
    const complete =
      phase.steps.length > 0 && phase.steps.every((s) => done.has(s.id));
    const holdsFrontier =
      !frontierFound && phase.steps.some((s) => !done.has(s.id));
    if (holdsFrontier) {
      frontierFound = true;
      result.delete(phase.id); // keep the active phase open
    } else if (complete) {
      result.add(phase.id);
    }
  }
  return result;
}
