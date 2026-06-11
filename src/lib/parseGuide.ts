import { marked } from "marked";
import {
  GuideParseError,
  type Block,
  type Callout,
  type CalloutKind,
  type Guide,
  type Phase,
  type Step,
} from "./types";

marked.setOptions({ gfm: true, breaks: false });

export type ParseOptions = {
  /** Used as the title when a file has neither frontmatter nor an `#` heading. */
  fallbackTitle?: string;
};

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Stable, URL-safe slug used for persistence keys. */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "section";
}

/** Render Markdown to HTML (synchronously) and lightly sanitize it. */
function md2html(src: string): string {
  const raw = marked.parse(src, { async: false }) as string;
  return sanitize(raw);
}

/**
 * Minimal defensive sanitizer. Guides are local and author-trusted, but this
 * removes the obvious script/handler vectors so a pasted file can't run code.
 */
function sanitize(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|style)\b[^>]*\/?\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const ADMONITION_RE = /^>\s*\[!(note|tip|warning|danger|details|input|secret)\]\s*(.*)$/i;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/* -------------------------------------------------------------------------- */
/* Frontmatter                                                                */
/* -------------------------------------------------------------------------- */

type Frontmatter = {
  title?: string;
  subtitle?: string;
  accent?: string;
  collection?: string;
  order?: number;
};

function extractFrontmatter(lines: string[]): {
  meta: Frontmatter;
  rest: string[];
} {
  if (lines[0]?.trim() !== "---") return { meta: {}, rest: lines };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "---" || t === "...") {
      end = i;
      break;
    }
  }
  // No closing fence -> treat the document as having no frontmatter.
  if (end === -1) return { meta: {}, rest: lines };

  const meta: Frontmatter = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === "title") meta.title = value;
    else if (key === "subtitle") meta.subtitle = value;
    else if (key === "accent") meta.accent = value;
    else if (key === "collection") meta.collection = value;
    else if (key === "order") {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n)) meta.order = n;
    }
  }
  return { meta, rest: lines.slice(end + 1) };
}

/* -------------------------------------------------------------------------- */
/* Block splitting (fence- and admonition-aware)                              */
/* -------------------------------------------------------------------------- */

function splitBlocks(raw: string): Block[] {
  const lines = raw.split("\n");
  const blocks: Block[] = [];
  let prose: string[] = [];

  const flushProse = () => {
    const text = prose.join("\n").trim();
    if (text) blocks.push({ type: "prose", html: md2html(text) });
    prose = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code -> command block.
    const fence = line.match(FENCE_RE);
    if (fence) {
      flushProse();
      const marker = fence[2][0];
      const minLen = fence[2].length;
      const language = fence[3].trim().split(/\s+/)[0] ?? "";
      const code: string[] = [];
      i++;
      const closeRe = new RegExp(`^\\s*${marker === "`" ? "`" : "~"}{${minLen},}\\s*$`);
      while (i < lines.length && !closeRe.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "command",
        language,
        code: code.join("\n").replace(/\s+$/, ""),
      });
      continue;
    }

    // GitHub-style admonition -> callout, or [!DETAILS] -> expandable section.
    const adm = line.match(ADMONITION_RE);
    if (adm) {
      flushProse();
      const kindRaw = adm[1].toLowerCase();
      const customTitle = adm[2].trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && /^>/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      i--; // step back; outer loop will advance

      if (kindRaw === "details") {
        // Recurse so command cards (and anything else) work inside details.
        blocks.push({
          type: "details",
          title: customTitle || "More detail",
          blocks: splitBlocks(body.join("\n")),
        });
        continue;
      }

      if (kindRaw === "input" || kindRaw === "secret") {
        // > [!INPUT] key | Label | placeholder | default
        // (placeholder and default optional — a default pre-fills the field
        // for logins that ship fixed, like root; any quoted body lines
        // become help text under the field)
        const [keyRaw, labelRaw, placeholderRaw, defaultRaw] = customTitle
          .split("|")
          .map((s) => s.trim());
        if (!keyRaw) {
          throw new GuideParseError(
            `An [!${kindRaw.toUpperCase()}] field needs a key — write “> [!${kindRaw.toUpperCase()}] my-key | Label”.`,
          );
        }
        const hint = body.join("\n").trim();
        blocks.push({
          type: "input",
          key: slugify(keyRaw),
          label: labelRaw || keyRaw,
          ...(placeholderRaw ? { placeholder: placeholderRaw } : {}),
          ...(defaultRaw ? { defaultValue: defaultRaw } : {}),
          secret: kindRaw === "secret",
          ...(hint ? { hintHtml: md2html(hint) } : {}),
        });
        continue;
      }

      const kind = kindRaw as CalloutKind;
      const callout: Callout = {
        kind,
        html: md2html(body.join("\n").trim()),
      };
      if (customTitle) callout.title = customTitle;
      blocks.push({ type: "callout", data: callout });
      continue;
    }

    prose.push(line);
  }

  flushProse();
  return blocks;
}

/* -------------------------------------------------------------------------- */
/* Main parse                                                                 */
/* -------------------------------------------------------------------------- */

export function parseGuide(markdown: string, opts: ParseOptions = {}): Guide {
  if (!markdown || !markdown.trim()) {
    throw new GuideParseError(
      "This guide looks empty. Add a title and at least one “### step”.",
    );
  }

  const allLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const { meta, rest } = extractFrontmatter(allLines);

  let title = meta.title?.trim() || "";
  const phases: Phase[] = [];
  let currentPhase: Phase | null = null;
  let currentStep: Step | null = null;

  // Raw line buffers for each container; flushed into Block[] at the end.
  let guideIntro: string[] = [];
  const buffersForStep = new Map<Step, string[]>();
  const buffersForPhaseIntro = new Map<Phase, string[]>();

  const target = (): string[] => {
    if (currentStep) return buffersForStep.get(currentStep)!;
    if (currentPhase) return buffersForPhaseIntro.get(currentPhase)!;
    return guideIntro;
  };

  let inFence = false;
  let fenceClose = "";

  for (const line of rest) {
    // Track fenced regions so `#` inside code is never read as a heading.
    if (!inFence) {
      const f = line.match(FENCE_RE);
      if (f) {
        inFence = true;
        const marker = f[2][0];
        fenceClose = `${marker}`.repeat(f[2].length);
        target().push(line);
        continue;
      }
    } else {
      target().push(line);
      if (new RegExp(`^\\s*${fenceClose[0] === "`" ? "`" : "~"}{${fenceClose.length},}\\s*$`).test(line)) {
        inFence = false;
      }
      continue;
    }

    const h = line.match(HEADING_RE);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();

      if (level === 1) {
        if (!title) {
          title = text;
        } else {
          target().push(line); // extra H1 -> keep as prose
        }
        continue;
      }

      if (level === 2) {
        currentPhase = { id: "", title: text, steps: [] };
        currentStep = null;
        buffersForPhaseIntro.set(currentPhase, []);
        phases.push(currentPhase);
        continue;
      }

      if (level === 3) {
        if (!currentPhase) {
          // A step before any phase -> implicit, unlabeled phase.
          currentPhase = { id: "", title: "", steps: [] };
          buffersForPhaseIntro.set(currentPhase, []);
          phases.push(currentPhase);
        }
        currentStep = { id: "", title: text || "Step", blocks: [] };
        buffersForStep.set(currentStep, []);
        currentPhase.steps.push(currentStep);
        continue;
      }

      // h4–h6: keep inline as prose so sub-structure renders.
      target().push(line);
      continue;
    }

    target().push(line);
  }

  // Resolve the title (frontmatter > first H1 > fallback) or fail clearly.
  if (!title) {
    if (opts.fallbackTitle && opts.fallbackTitle.trim()) {
      title = opts.fallbackTitle.trim();
    } else {
      throw new GuideParseError(
        "I couldn’t find a title. Add YAML frontmatter with a “title:” field, or start the file with a “# Heading”.",
      );
    }
  }

  // Build blocks and assign stable, unique ids.
  const usedStepIds = new Set<string>();
  const usedPhaseIds = new Set<string>();
  const uniqueId = (base: string, used: Set<string>): string => {
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  };

  let totalSteps = 0;
  for (const phase of phases) {
    phase.id = uniqueId(slugify(phase.title || "phase"), usedPhaseIds);
    const intro = splitBlocks((buffersForPhaseIntro.get(phase) ?? []).join("\n"));
    if (intro.length) phase.intro = intro;
    for (const step of phase.steps) {
      step.id = uniqueId(slugify(step.title), usedStepIds);
      step.blocks = splitBlocks((buffersForStep.get(step) ?? []).join("\n"));
      totalSteps++;
    }
  }

  const intro = splitBlocks(guideIntro.join("\n"));

  // Something renderable must exist.
  const hasContent = totalSteps > 0 || phases.length > 0 || intro.length > 0;
  if (!hasContent) {
    throw new GuideParseError(
      "This guide has a title but no content. Add a “## Phase” and one or more “### steps”.",
    );
  }

  const guide: Guide = {
    id: slugify(title),
    title,
    phases,
    totalSteps,
  };
  if (meta.subtitle) guide.subtitle = meta.subtitle;
  if (meta.accent) guide.accent = meta.accent;
  if (meta.collection) guide.collection = meta.collection;
  if (meta.order !== undefined) guide.order = meta.order;
  if (intro.length) guide.intro = intro;

  return guide;
}
