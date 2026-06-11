import { describe, expect, it } from "vitest";
import { parseGuide, slugify } from "./parseGuide";
import { GuideParseError, type Block } from "./types";

// The exact worked example from Section C of the build spec, assembled as
// lines to avoid fighting nested code fences in a template literal.
const SPEC_EXAMPLE = [
  "---",
  "title: Proxmox Home Server Build",
  "subtitle: Bare-metal to full local stack on the 8700K",
  "accent: spruce",
  "---",
  "",
  "## Phase 1 — Prep & BIOS",
  "",
  "### Save anything off the PC first",
  "Installing Proxmox wipes the drive, Windows and all. Pull any files you want to keep.",
  "",
  "> [!WARNING]",
  "> This step is irreversible. The target drive is fully erased.",
  "",
  "### Set BIOS for virtualization",
  "Enable VT-x and VT-d, enable the integrated graphics, and turn on C-states.",
  "",
  "> [!TIP]",
  "> VT-d is what makes USB and drive passthrough work later. Do not skip it.",
  "",
  "## Phase 2 — Install Proxmox",
  "",
  "### Flash the installer",
  "Write the Proxmox ISO to a USB stick with Balena Etcher, then boot from it.",
  "",
  "### Run the installer",
  "Follow the prompts for disk, hostname, root password, and a static IP.",
  "",
  "```bash",
  "# After install, reach the web UI from another machine:",
  "https://your-ip:8006",
  "```",
  "",
  "> [!NOTE]",
  "> Proxmox has no desktop. You administer it from a browser at that address.",
  "",
  "### Post-install cleanup",
  "Run the community post-install script to set repos and remove the subscription nag.",
  "",
  "```bash",
  'bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/post-pve-install.sh)"',
  "```",
].join("\n");

const find = (blocks: Block[], type: Block["type"]) =>
  blocks.filter((b) => b.type === type);

describe("parseGuide — Section C worked example", () => {
  const guide = parseGuide(SPEC_EXAMPLE);

  it("reads frontmatter", () => {
    expect(guide.title).toBe("Proxmox Home Server Build");
    expect(guide.subtitle).toBe("Bare-metal to full local stack on the 8700K");
    expect(guide.accent).toBe("spruce");
  });

  it("derives a stable slug id from the title", () => {
    expect(guide.id).toBe("proxmox-home-server-build");
  });

  it("builds two phases with the right step counts", () => {
    expect(guide.phases).toHaveLength(2);
    expect(guide.phases[0].title).toBe("Phase 1 — Prep & BIOS");
    expect(guide.phases[1].title).toBe("Phase 2 — Install Proxmox");
    expect(guide.phases[0].steps).toHaveLength(2);
    expect(guide.phases[1].steps).toHaveLength(3);
    expect(guide.totalSteps).toBe(5);
  });

  it("gives every step a unique, slug-based id", () => {
    const ids = guide.phases.flatMap((p) => p.steps.map((s) => s.id));
    expect(ids).toEqual([
      "save-anything-off-the-pc-first",
      "set-bios-for-virtualization",
      "flash-the-installer",
      "run-the-installer",
      "post-install-cleanup",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("parses prose + a WARNING callout in the first step", () => {
    const step = guide.phases[0].steps[0];
    const prose = find(step.blocks, "prose");
    const callouts = find(step.blocks, "callout");
    expect(prose.length).toBe(1);
    expect(callouts.length).toBe(1);
    expect(callouts[0]).toMatchObject({ type: "callout" });
    if (callouts[0].type === "callout") {
      expect(callouts[0].data.kind).toBe("warning");
      expect(callouts[0].data.html).toContain("irreversible");
    }
  });

  it("parses a bash command block and a NOTE callout in 'Run the installer'", () => {
    const step = guide.phases[1].steps[1];
    const commands = find(step.blocks, "command");
    const callouts = find(step.blocks, "callout");
    expect(commands.length).toBe(1);
    if (commands[0].type === "command") {
      expect(commands[0].language).toBe("bash");
      expect(commands[0].code).toContain("https://your-ip:8006");
      expect(commands[0].code).toContain("# After install");
    }
    expect(callouts.length).toBe(1);
    if (callouts[0].type === "callout") expect(callouts[0].data.kind).toBe("note");
  });

  it("copies command code verbatim, including comments", () => {
    const step = guide.phases[1].steps[2];
    const command = find(step.blocks, "command")[0];
    if (command.type === "command") {
      expect(command.code).toBe(
        'bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/post-pve-install.sh)"',
      );
    }
  });
});

describe("parseGuide — titles & fallbacks", () => {
  it("uses the first # heading as the title when there is no frontmatter", () => {
    const g = parseGuide("# My Procedure\n\n## Phase\n\n### Do it\nbody");
    expect(g.title).toBe("My Procedure");
    expect(g.id).toBe("my-procedure");
  });

  it("accepts a fallback title (e.g. from a dropped filename)", () => {
    const g = parseGuide("## Phase\n\n### Do it\nbody", {
      fallbackTitle: "rescued-from-filename",
    });
    expect(g.title).toBe("rescued-from-filename");
  });

  it("creates an implicit phase for steps that precede any phase", () => {
    const g = parseGuide("# T\n\n### Lonely step\nbody");
    expect(g.phases).toHaveLength(1);
    expect(g.phases[0].steps).toHaveLength(1);
    expect(g.totalSteps).toBe(1);
  });
});

describe("parseGuide — friendly errors", () => {
  it("rejects an empty file", () => {
    expect(() => parseGuide("   \n  ")).toThrow(GuideParseError);
  });

  it("rejects a file with no resolvable title", () => {
    expect(() => parseGuide("## Phase\n### Step\nbody")).toThrow(/title/i);
  });

  it("rejects a title with no content", () => {
    expect(() => parseGuide("# Only a title")).toThrow(/no content/i);
  });
});

describe("parseGuide — [!DETAILS] expandable sections", () => {
  const md = [
    "# T",
    "",
    "## Phase",
    "",
    "### Step with depth",
    "Short body.",
    "",
    "> [!DETAILS] How to choose a static IP",
    "> Find your gateway first:",
    ">",
    "> ```bash",
    "> ipconfig",
    "> ```",
    ">",
    "> Then pick an address outside the DHCP pool.",
    "",
    "> [!DETAILS]",
    "> Body with no custom title.",
  ].join("\n");

  const guide = parseGuide(md);
  const blocks = guide.phases[0].steps[0].blocks;

  it("parses a titled details block, collapsed content intact", () => {
    const details = blocks.filter((b) => b.type === "details");
    expect(details).toHaveLength(2);
    if (details[0].type === "details") {
      expect(details[0].title).toBe("How to choose a static IP");
      expect(details[0].blocks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("renders command cards inside details (recursion)", () => {
    const d = blocks.find((b) => b.type === "details");
    if (d?.type === "details") {
      const cmd = d.blocks.find((b) => b.type === "command");
      expect(cmd).toBeTruthy();
      if (cmd?.type === "command") {
        expect(cmd.language).toBe("bash");
        expect(cmd.code).toBe("ipconfig");
      }
    }
  });

  it("falls back to a default title", () => {
    const second = blocks.filter((b) => b.type === "details")[1];
    if (second.type === "details") expect(second.title).toBe("More detail");
  });

  it("keeps plain callouts working alongside details", () => {
    const g = parseGuide(
      "# T\n\n### S\n> [!WARNING]\n> careful\n\n> [!DETAILS] More\n> depth",
    );
    const b = g.phases[0].steps[0].blocks;
    expect(b.some((x) => x.type === "callout")).toBe(true);
    expect(b.some((x) => x.type === "details")).toBe(true);
  });
});

describe("[!INPUT] / [!SECRET] credential fields", () => {
  it("parses key, label, and placeholder", () => {
    const g = parseGuide(
      "# T\n\n### S\n> [!INPUT] proxmox-ip | Proxmox server IP | 192.168.1.50",
    );
    const b = g.phases[0].steps[0].blocks[0];
    expect(b.type).toBe("input");
    if (b.type === "input") {
      expect(b.key).toBe("proxmox-ip");
      expect(b.label).toBe("Proxmox server IP");
      expect(b.placeholder).toBe("192.168.1.50");
      expect(b.secret).toBe(false);
      expect(b.hintHtml).toBeUndefined();
    }
  });

  it("marks [!SECRET] fields and captures the quoted body as hint", () => {
    const g = parseGuide(
      "# T\n\n### S\n> [!SECRET] root-password | Root password\n> Use a **long** passphrase.",
    );
    const b = g.phases[0].steps[0].blocks[0];
    if (b.type === "input") {
      expect(b.secret).toBe(true);
      expect(b.hintHtml).toContain("<strong>long</strong>");
    }
  });

  it("reads a default value from the fourth segment", () => {
    const g = parseGuide(
      "# T\n\n### S\n> [!INPUT] proxmox-user | Proxmox web UI username | | root",
    );
    const b = g.phases[0].steps[0].blocks[0];
    if (b.type === "input") {
      expect(b.defaultValue).toBe("root");
      expect(b.placeholder).toBeUndefined(); // empty third segment
    }
  });

  it("slugifies the key and falls back to it as label", () => {
    const g = parseGuide("# T\n\n### S\n> [!INPUT] My Key!");
    const b = g.phases[0].steps[0].blocks[0];
    if (b.type === "input") {
      expect(b.key).toBe("my-key");
      expect(b.label).toBe("My Key!");
    }
  });

  it("throws a clear error when the key is missing", () => {
    expect(() => parseGuide("# T\n\n### S\n> [!INPUT]")).toThrow(/needs a key/);
  });

  it("parses inside [!DETAILS] blocks (double-quoted nesting)", () => {
    const g = parseGuide(
      "# T\n\n### S\n> [!DETAILS] More\n> Text first.\n>\n> > [!INPUT] nested-key | Nested",
    );
    const d = g.phases[0].steps[0].blocks.find((x) => x.type === "details");
    expect(d).toBeTruthy();
    if (d?.type === "details") {
      const inp = d.blocks.find((x) => x.type === "input");
      expect(inp).toBeTruthy();
      if (inp?.type === "input") expect(inp.key).toBe("nested-key");
    }
  });
});

describe("bundled guides", () => {
  // Mirrors bundledGuides.ts: `-2.md` donor drafts are not part of the app.
  const files = import.meta.glob(["../guides/*.md", "!../guides/*-2.md"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("ship at least one guide", () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  it("all parse without errors and have steps", () => {
    for (const [path, raw] of Object.entries(files)) {
      const guide = parseGuide(raw, { fallbackTitle: path });
      expect(guide.totalSteps, `${path} should have steps`).toBeGreaterThan(0);
    }
  });
});

describe("slugify", () => {
  it("is stable and url-safe", () => {
    expect(slugify("Phase 1 — Prep & BIOS")).toBe("phase-1-prep-bios");
    expect(slugify("  Café déjà vu  ")).toBe("cafe-deja-vu");
    expect(slugify("!!!")).toBe("section");
  });
});
