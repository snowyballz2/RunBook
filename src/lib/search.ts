/**
 * Full-text search over a guide's steps — the symptom finder for a
 * troubleshooting page, and the step-level search behind the library box.
 * Every step is indexed as its phase title, its own title, and the text of
 * its blocks (markup stripped). A query matches when every word of it
 * appears somewhere in that text; entries whose titles carry every word sort
 * first, document order otherwise.
 */

import type { Block, Guide } from "./types";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function blockText(block: Block): string {
  switch (block.type) {
    case "prose":
      return stripHtml(block.html);
    case "command":
      return block.code;
    case "callout":
      return [block.data.title ?? "", stripHtml(block.data.html)].join(" ");
    case "details":
      return [block.title, ...block.blocks.map(blockText)].join(" ");
    case "input":
      return [block.label, block.hintHtml ? stripHtml(block.hintHtml) : ""].join(" ");
  }
}

export type SearchEntry = {
  stepId: string;
  title: string;
  phaseTitle: string;
  /** Lower-cased phase title + step title. */
  head: string;
  /** Lower-cased head + body text. */
  text: string;
};

export function buildSearchIndex(guide: Guide): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const phase of guide.phases) {
    for (const step of phase.steps) {
      const head = `${phase.title} ${step.title}`.toLowerCase();
      const body = step.blocks.map(blockText).join(" ").toLowerCase();
      entries.push({ stepId: step.id, title: step.title, phaseTitle: phase.title, head, text: `${head} ${body}` });
    }
  }
  return entries;
}

export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Entries matching every word of the query — title matches first, document order within each group. */
export function searchIndex(index: SearchEntry[], query: string): SearchEntry[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  const hits = index.filter((e) => words.every((w) => e.text.includes(w)));
  const inHead = (e: SearchEntry) => words.every((w) => e.head.includes(w));
  return [...hits.filter(inHead), ...hits.filter((e) => !inHead(e))];
}
