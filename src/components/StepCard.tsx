import type { Step } from "../lib/types";
import { Blocks } from "./Blocks";
import { Check } from "./Icons";

type Props = {
  step: Step;
  done: boolean;
  active: boolean;
  index: number;
  onToggle: () => void;
};

export function StepCard({ step, done, active, index, onToggle }: Props) {
  return (
    <article
      id={`step-${step.id}`}
      data-active={active || undefined}
      data-done={done || undefined}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={[
        "rb-card animate-rise scroll-mt-24 px-4 py-3.5 transition-[border-color,box-shadow,background-color] duration-300 sm:px-5 sm:py-4",
        active ? "border-accent/60 shadow-lift ring-1 ring-accent/25" : "",
        done ? "bg-surface/60" : "",
      ].join(" ")}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <span className="relative mt-0.5 grid place-items-center">
          <input
            type="checkbox"
            checked={done}
            onChange={onToggle}
            className="peer sr-only"
          />
          <span
            className={`grid h-[22px] w-[22px] place-items-center rounded-[7px] border-[1.5px] text-accent-contrast transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent)] ${
              done ? "border-accent bg-accent" : "border-line-strong bg-surface"
            }`}
            aria-hidden="true"
          >
            <Check
              size={15}
              strokeWidth={3}
              className={`origin-center transition-all duration-200 ${
                done ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            />
          </span>
        </span>

        <h3
          className={`select-none font-medium leading-snug transition-colors ${
            done ? "text-ink-soft" : "text-ink"
          } text-[1.02rem] sm:text-[1.08rem]`}
        >
          {step.title}
        </h3>
      </label>

      {step.blocks.length > 0 && (
        <div className="mt-3 pl-[34px]">
          <Blocks blocks={step.blocks} />
        </div>
      )}
    </article>
  );
}
