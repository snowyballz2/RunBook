import { describe, expect, it } from "vitest";
import { parseGuide } from "./parseGuide";
import { buildSearchIndex, searchIndex, stripHtml } from "./search";

const md = `---
title: When Something Breaks
search: true
---

## Host

### The server resets by itself
Power or hardware. Check the <code>journal</code> &amp; the cables.

> [!NOTE]
> A kernel panic hangs rather than reboots.

## Home Assistant

### Home Assistant is unreachable and its console says "You are in rescue mode"
Both slots marked bad.

\`\`\`bash
rauc status mark-good
\`\`\`

### A lock times out
Reload the Matter integration.
`;

describe("stripHtml", () => {
  it("drops tags, decodes entities, collapses whitespace", () => {
    expect(stripHtml("Check the <code>journal</code> &amp;  the\n cables.")).toBe("Check the journal & the cables.");
  });
});

describe("search index", () => {
  const guide = parseGuide(md);
  const index = buildSearchIndex(guide);

  it("reads the search flag from frontmatter", () => {
    expect(guide.search).toBe(true);
  });

  it("indexes phase title, step title, prose, callouts and commands", () => {
    expect(index).toHaveLength(3);
    expect(searchIndex(index, "rauc").map((e) => e.title)).toEqual([
      'Home Assistant is unreachable and its console says "You are in rescue mode"',
    ]);
    expect(searchIndex(index, "kernel panic")[0].title).toBe("The server resets by itself");
  });

  it("requires every word, in any order, case-insensitively", () => {
    expect(searchIndex(index, "RESCUE slots")).toHaveLength(1);
    expect(searchIndex(index, "rescue cables")).toHaveLength(0);
  });

  it("puts title matches before body matches", () => {
    // "assistant" is in the Home Assistant entry's head and only in the body of nothing else;
    // "lock" is in a title; "reload" only in a body.
    const hits = searchIndex(index, "home assistant");
    expect(hits[0].phaseTitle).toBe("Home Assistant");
    expect(searchIndex(index, "lock")[0].title).toBe("A lock times out");
  });

  it("returns nothing for an empty query", () => {
    expect(searchIndex(index, "   ")).toEqual([]);
  });
});
