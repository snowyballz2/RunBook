import { useEffect, useMemo, useRef, useState } from "react";
import type { Guide, Phase, Step } from "../lib/types";
import { Blocks } from "./Blocks";
import { ArrowLeft, Check, ChevronDown } from "./Icons";

type Slide =
  | { kind: "intro" }
  | { kind: "step"; phase: Phase; step: Step; phaseNo: number; stepNo: number }
  | { kind: "complete" };

type Props = {
  guide: Guide;
  done: Set<string>;
  onToggleStep: (phase: Phase, step: Step) => void;
  onBack: () => void;
};

/**
 * The phone reader: every step is a fullscreen slide in a horizontal
 * scroll-snap deck. Native momentum does the swiping; the footer's big
 * button checks the current step and advances.
 */
export function SwipeView({ guide, done, onToggleStep, onBack }: Props) {
  const total = guide.totalSteps;
  const doneCount = useMemo(
    () =>
      guide.phases.reduce(
        (n, p) => n + p.steps.filter((s) => done.has(s.id)).length,
        0,
      ),
    [guide, done],
  );
  const complete = total > 0 && doneCount === total;

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    if (guide.subtitle || (guide.intro && guide.intro.length > 0)) {
      out.push({ kind: "intro" });
    }
    let stepNo = 0;
    let phaseNo = 0;
    for (const phase of guide.phases) {
      phaseNo++;
      for (const step of phase.steps) {
        stepNo++;
        out.push({ kind: "step", phase, step, phaseNo, stepNo });
      }
    }
    if (complete) out.push({ kind: "complete" });
    return out;
  }, [guide, complete]);

  const deckRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = (i: number, smooth = true) => {
    const deck = deckRef.current;
    if (!deck) return;
    const clamped = Math.max(0, Math.min(i, slides.length - 1));
    deck.scrollTo({
      left: clamped * deck.clientWidth,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Resume: open on the first unchecked step (or the intro on a fresh guide).
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    let target = 0;
    if (done.size > 0) {
      const firstUnchecked = slides.findIndex(
        (s) => s.kind === "step" && !done.has(s.step.id),
      );
      target = firstUnchecked === -1 ? slides.length - 1 : firstUnchecked;
    }
    setIndex(target);
    // Two frames so layout has settled before the instant jump.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => scrollToIndex(target, false)),
    );
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.id]);

  const onScroll = () => {
    const deck = deckRef.current;
    if (!deck || deck.clientWidth === 0) return;
    const i = Math.round(deck.scrollLeft / deck.clientWidth);
    if (i !== index) setIndex(Math.max(0, Math.min(i, slides.length - 1)));
  };

  const current = slides[index];

  const onPrimary = () => {
    if (!current) return;
    if (current.kind === "intro") {
      scrollToIndex(index + 1);
      return;
    }
    if (current.kind === "complete") {
      onBack();
      return;
    }
    const wasDone = done.has(current.step.id);
    onToggleStep(current.phase, current.step);
    if (!wasDone && index < slides.length - 1) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => scrollToIndex(index + 1), 320);
    }
  };

  const currentDone = current?.kind === "step" && done.has(current.step.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The deck ---------------------------------------------------------- */}
      <div
        ref={deckRef}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") scrollToIndex(index + 1);
          if (e.key === "ArrowLeft") scrollToIndex(index - 1);
        }}
        tabIndex={0}
        aria-label="Guide steps, one per screen — swipe sideways to move"
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <section
            key={
              slide.kind === "step" ? slide.step.id : `${slide.kind}-${i}`
            }
            aria-hidden={i !== index}
            className="h-full w-full shrink-0 snap-center snap-always overflow-y-auto overscroll-y-contain"
          >
            <div className="mx-auto max-w-xl px-5 pb-10 pt-6">
              {slide.kind === "intro" && (
                <>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                    {guide.title} · {total} {total === 1 ? "step" : "steps"}
                  </p>
                  {guide.subtitle && (
                    <h2 className="mt-2 font-display text-[1.45rem] font-semibold leading-snug text-ink">
                      {guide.subtitle}
                    </h2>
                  )}
                  {guide.intro && guide.intro.length > 0 && (
                    <div className="mt-5">
                      <Blocks blocks={guide.intro} />
                    </div>
                  )}
                </>
              )}

              {slide.kind === "step" && (
                <>
                  {slide.phase.intro &&
                    slide.phase.intro.length > 0 &&
                    slide.phase.steps[0]?.id === slide.step.id && (
                      <div className="mb-6 border-b border-line pb-6 text-ink-soft">
                        {slide.phase.title && (
                          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                            {slide.phase.title}
                          </p>
                        )}
                        <div className="mt-3">
                          <Blocks blocks={slide.phase.intro} />
                        </div>
                      </div>
                    )}
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                    <span className="shrink-0 tabular-nums text-accent">
                      Step {slide.stepNo} of {total}
                    </span>
                    {slide.phase.title && (
                      <span className="truncate">· {slide.phase.title}</span>
                    )}
                  </p>
                  <h2
                    className={`mt-2 font-display text-[1.45rem] font-semibold leading-snug ${
                      done.has(slide.step.id) ? "text-ink-soft" : "text-ink"
                    }`}
                  >
                    {slide.step.title}
                  </h2>
                  {slide.step.blocks.length > 0 && (
                    <div className="mt-5">
                      <Blocks blocks={slide.step.blocks} />
                    </div>
                  )}
                </>
              )}

              {slide.kind === "complete" && (
                <div className="flex h-full flex-col items-center justify-center pt-16 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-contrast">
                    <Check size={32} strokeWidth={3} />
                  </span>
                  <h2 className="mt-6 font-display text-2xl font-semibold text-ink">
                    Every step complete.
                  </h2>
                  <p className="mt-2 text-[15px] text-ink-soft">
                    Nicely done. The build is yours now.
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Footer controls ---------------------------------------------------- */}
      <div className="border-t border-line bg-paper/90 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToIndex(index - 1)}
            disabled={index === 0}
            className="btn btn-quiet h-12 w-12 shrink-0 !px-0 disabled:opacity-30"
            aria-label="Previous step"
          >
            <ChevronDown size={20} className="rotate-90" />
          </button>

          <button
            type="button"
            onClick={onPrimary}
            className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors duration-200 ${
              current?.kind === "complete"
                ? "bg-surface-2 text-ink"
                : currentDone
                  ? "border border-line-strong bg-surface text-ink-soft"
                  : "bg-accent text-accent-contrast"
            }`}
          >
            {current?.kind === "intro" ? (
              "Begin"
            ) : current?.kind === "complete" ? (
              <>
                <ArrowLeft size={17} /> Back to the library
              </>
            ) : currentDone ? (
              <>
                <Check size={17} strokeWidth={3} /> Done — tap to undo
              </>
            ) : (
              "Mark step done"
            )}
          </button>

          <button
            type="button"
            onClick={() => scrollToIndex(index + 1)}
            disabled={index >= slides.length - 1}
            className="btn btn-quiet h-12 w-12 shrink-0 !px-0 disabled:opacity-30"
            aria-label="Next step"
          >
            <ChevronDown size={20} className="-rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
