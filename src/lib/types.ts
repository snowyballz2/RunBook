/** The parsed data model the whole app renders from. */

export type CalloutKind = "note" | "tip" | "warning" | "danger";

export type Callout = {
  kind: CalloutKind;
  /** Optional custom title after the marker, e.g. `> [!NOTE] Heads up`. */
  title?: string;
  html: string;
};

export type Block =
  | { type: "prose"; html: string }
  | { type: "command"; language: string; code: string }
  | { type: "callout"; data: Callout }
  /** A collapsed-by-default expandable section for granular how-to depth. */
  | { type: "details"; title: string; blocks: Block[] };

export type Step = {
  /** Stable slug of the title, unique within the guide. Persistence key. */
  id: string;
  title: string;
  blocks: Block[];
};

export type Phase = {
  id: string;
  title: string;
  /** Content that appears under the phase heading but before the first step. */
  intro?: Block[];
  steps: Step[];
};

export type Guide = {
  /** Stable slug from the title — the persistence key for progress. */
  id: string;
  title: string;
  subtitle?: string;
  /** Optional name of the build this guide belongs to; groups guides in the Library. */
  collection?: string;
  /** Optional position within its collection (lower first). Lives in frontmatter, not filenames. */
  order?: number;
  /** Optional palette accent override from frontmatter. */
  accent?: string;
  /** Content before the first phase heading. */
  intro?: Block[];
  phases: Phase[];
  totalSteps: number;
};

/** Where a guide in the library came from. */
export type GuideOrigin = "bundled" | "imported";

/** A thrown, human-readable parse failure surfaced in the UI. */
export class GuideParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuideParseError";
  }
}
