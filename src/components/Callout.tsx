import type { Callout as CalloutData } from "../lib/types";
import { Danger, Info, Lightbulb, Warning } from "./Icons";

const META = {
  note: { label: "Note", Glyph: Info },
  tip: { label: "Tip", Glyph: Lightbulb },
  warning: { label: "Warning", Glyph: Warning },
  danger: { label: "Danger", Glyph: Danger },
} as const;

export function Callout({ data }: { data: CalloutData }) {
  const { label, Glyph } = META[data.kind];
  return (
    <div className={`callout callout-${data.kind}`} role="note">
      <div
        className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--c)" }}
      >
        <Glyph size={15} />
        <span>{data.title || label}</span>
      </div>
      <div
        className="prose-rb text-[0.92rem]"
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  );
}
