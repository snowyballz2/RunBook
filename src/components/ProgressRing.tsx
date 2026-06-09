import { Check } from "./Icons";

type Props = {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  /** Show "n/total" or a check in the middle. */
  showLabel?: boolean;
};

export function ProgressRing({
  done,
  total,
  size = 46,
  stroke = 4,
  showLabel = true,
}: Props) {
  const fraction = total > 0 ? done / total : 0;
  const complete = total > 0 && done >= total;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - fraction);
  const pct = Math.round(fraction * 100);

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${done} of ${total} steps complete, ${pct}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {showLabel && (complete || done > 0) && (
        <span className="absolute grid place-items-center">
          {complete ? (
            <Check size={size * 0.4} className="text-accent" />
          ) : (
            <span
              className="font-mono tabular-nums text-ink-soft"
              style={{ fontSize: size * 0.26 }}
            >
              {pct}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
