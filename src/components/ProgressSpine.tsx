import { Check, Flag } from "./Icons";

/**
 * A single cell in the spine gutter. The continuous rail is just every cell's
 * upper/lower half-line stacked flush; `filled` lights the node, `current`
 * marks the live "you are here" position.
 */
type SpineCellProps = {
  variant: "station" | "node" | "rail";
  upperFilled: boolean;
  lowerFilled: boolean;
  filled: boolean;
  current?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  label?: string;
  activePhase?: boolean;
  guideComplete?: boolean;
};

const RAIL = "absolute left-1/2 w-[2px] -translate-x-1/2";

export function SpineCell({
  variant,
  upperFilled,
  lowerFilled,
  filled,
  current = false,
  isFirst = false,
  isLast = false,
  label,
  activePhase = false,
  guideComplete = false,
}: SpineCellProps) {
  const nodeTop = variant === "station" ? "1.85rem" : "1.7rem";

  return (
    <div
      className="relative h-full select-none"
      style={{ ["--node-top" as string]: nodeTop }}
      aria-hidden="true"
    >
      {/* upper half of the rail */}
      {!isFirst && (
        <span
          className={`${RAIL} top-0 transition-colors duration-500`}
          style={{
            height: "var(--node-top)",
            backgroundColor: upperFilled ? "var(--color-accent)" : "var(--color-line)",
          }}
        />
      )}
      {/* lower half of the rail */}
      {!isLast && (
        <span
          className={`${RAIL} bottom-0 transition-colors duration-500`}
          style={{
            top: "var(--node-top)",
            backgroundColor: lowerFilled ? "var(--color-accent)" : "var(--color-line)",
          }}
        />
      )}

      {/* marker (rail variant draws line only) */}
      {variant !== "rail" && (
        <span
          className="absolute left-1/2"
          style={{ top: "var(--node-top)", transform: "translate(-50%, -50%)" }}
        >
          {variant === "station" ? (
            <StationMarker filled={filled} active={activePhase} label={label} />
          ) : (
            <NodeMarker
              filled={filled}
              current={current}
              isLast={isLast}
              guideComplete={guideComplete}
            />
          )}
        </span>
      )}
    </div>
  );
}

function StationMarker({
  filled,
  active,
  label,
}: {
  filled: boolean;
  active: boolean;
  label?: string;
}) {
  return (
    <span
      className={[
        "grid h-7 w-7 place-items-center rounded-full border-2 font-mono text-[11px] font-semibold transition-colors duration-500",
        filled
          ? "border-accent bg-accent text-accent-contrast"
          : active
            ? "border-accent bg-paper text-accent"
            : "border-line-strong bg-paper text-ink-faint",
      ].join(" ")}
    >
      {filled ? <Check size={15} strokeWidth={3} /> : label}
    </span>
  );
}

function NodeMarker({
  filled,
  current,
  isLast,
  guideComplete,
}: {
  filled: boolean;
  current: boolean;
  isLast: boolean;
  guideComplete: boolean;
}) {
  if (isLast) {
    // Terminus — a finish flag that fills when the whole guide is done.
    return (
      <span
        className={[
          "grid h-[22px] w-[22px] place-items-center rounded-full border-2 transition-colors duration-500",
          guideComplete
            ? "border-accent bg-accent text-accent-contrast"
            : current
              ? "border-accent bg-paper text-accent"
              : "border-line-strong bg-paper text-ink-faint",
        ].join(" ")}
      >
        <Flag size={12} />
      </span>
    );
  }

  if (filled) {
    return <span className="block h-[13px] w-[13px] rounded-full bg-accent ring-2 ring-accent/30" />;
  }

  if (current) {
    return (
      <span className="relative grid h-[15px] w-[15px] place-items-center rounded-full border-2 border-accent bg-paper">
        <span className="block h-[6px] w-[6px] rounded-full bg-accent motion-safe:animate-[rb-pulse_2.2s_ease-in-out_infinite]" />
      </span>
    );
  }

  return <span className="block h-[12px] w-[12px] rounded-full border-2 border-line-strong bg-paper" />;
}
