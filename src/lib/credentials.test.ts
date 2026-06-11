import { describe, expect, it } from "vitest";
import { collectCredentialFields, countFilled, countSaved } from "./credentials";
import { parseGuide } from "./parseGuide";

const mk = (lines: string[]) => ({ guide: parseGuide(lines.join("\n")) });

describe("collectCredentialFields", () => {
  it("collects fields in reading order across collections, then standalone", () => {
    const items = [
      mk([
        "---",
        "title: Second Guide",
        "collection: Build",
        "order: 2",
        "---",
        "### S",
        "> [!SECRET] second-pass | Second password",
      ]),
      mk([
        "---",
        "title: First Guide",
        "collection: Build",
        "order: 1",
        "---",
        "### S",
        "> [!INPUT] first-ip | First IP | 192.168.1.50",
      ]),
      mk(["# Loner", "### S", "> [!INPUT] loner-key | Loner"]),
    ];
    const fields = collectCredentialFields(items);
    expect(fields.map((f) => f.key)).toEqual(["first-ip", "second-pass", "loner-key"]);
    expect(fields[0]).toMatchObject({
      label: "First IP",
      placeholder: "192.168.1.50",
      secret: false,
      guideTitle: "First Guide",
    });
    expect(fields[1].secret).toBe(true);
  });

  it("dedupes repeated keys — first appearance wins", () => {
    const items = [
      mk([
        "---",
        "title: A",
        "collection: Build",
        "order: 1",
        "---",
        "### S",
        "> [!INPUT] shared-ip | Declared here",
      ]),
      mk([
        "---",
        "title: B",
        "collection: Build",
        "order: 2",
        "---",
        "### S",
        "> [!INPUT] shared-ip | Repeated later",
      ]),
    ];
    const fields = collectCredentialFields(items);
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe("Declared here");
    expect(fields[0].guideTitle).toBe("A");
  });

  it("carries defaultValue and the guide's collection", () => {
    const items = [
      mk([
        "---",
        "title: A",
        "collection: Build",
        "order: 1",
        "---",
        "### S",
        "> [!INPUT] fixed-user | Username | | root",
      ]),
      mk(["# Loner", "### S", "> [!INPUT] loner-key | Loner"]),
    ];
    const fields = collectCredentialFields(items);
    expect(fields[0].defaultValue).toBe("root");
    expect(fields[0].collection).toBe("Build");
    expect(fields[1].collection).toBeUndefined();
  });

  it("finds fields nested in [!DETAILS] and in phase intros", () => {
    const items = [
      mk([
        "# G",
        "## Phase",
        "> [!INPUT] intro-key | In phase intro",
        "### S",
        "> [!DETAILS] More",
        "> > [!SECRET] nested-key | Nested secret",
      ]),
    ];
    const fields = collectCredentialFields(items);
    expect(fields.map((f) => f.key)).toEqual(["intro-key", "nested-key"]);
    expect(fields[1].secret).toBe(true);
  });
});

describe("countFilled", () => {
  const fields = [
    { key: "a" },
    { key: "b", defaultValue: "root" },
    { key: "c" },
  ];

  it("counts saved values and pre-filled defaults", () => {
    expect(countFilled(fields, {})).toBe(1); // only the default
    expect(countFilled(fields, { a: "1.2.3.4" })).toBe(2);
    expect(countFilled(fields, { a: "x", b: "custom", c: "y" })).toBe(3);
  });

  it("ignores whitespace-only saved values", () => {
    expect(countFilled(fields, { a: "   " })).toBe(1);
  });
});

describe("countSaved", () => {
  it("counts only saved values — defaults don't count", () => {
    const fields = [{ key: "a" }, { key: "b", defaultValue: "root" }];
    expect(countSaved(fields, {})).toBe(0);
    expect(countSaved(fields, { b: "custom" })).toBe(1);
    expect(countSaved(fields, { a: "x", b: "y" })).toBe(2);
  });
});
