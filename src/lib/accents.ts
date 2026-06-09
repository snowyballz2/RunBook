import type { Theme } from "./storage";

/** Named accent palettes a guide can opt into via `accent:` frontmatter. */
const NAMED: Record<string, { light: [string, string]; dark: [string, string] }> = {
  spruce: { light: ["#0f766e", "#0b5d56"], dark: ["#2dd4bf", "#5eead4"] },
  teal: { light: ["#0f766e", "#0b5d56"], dark: ["#2dd4bf", "#5eead4"] },
  azure: { light: ["#2563eb", "#1d4ed8"], dark: ["#60a5fa", "#93c5fd"] },
  violet: { light: ["#7c3aed", "#6d28d9"], dark: ["#a78bfa", "#c4b5fd"] },
  amber: { light: ["#b45309", "#92400e"], dark: ["#fbbf24", "#fcd34d"] },
  rose: { light: ["#e11d48", "#be123c"], dark: ["#fb7185", "#fda4af"] },
  emerald: { light: ["#059669", "#047857"], dark: ["#34d399", "#6ee7b7"] },
};

/**
 * Resolve a guide's `accent` into CSS custom properties to set on the reader
 * root. Returns `{}` for the default/unknown accent so the app palette stands.
 */
export function accentStyle(
  accent: string | undefined,
  theme: Theme,
): Record<string, string> {
  if (!accent) return {};
  const key = accent.trim().toLowerCase();

  // The default spruce accent is already the app accent — no override needed.
  if (key === "spruce" || key === "teal") return {};

  let pair: [string, string] | null = null;
  if (NAMED[key]) {
    pair = NAMED[key][theme];
  } else if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(key)) {
    pair = [key, key];
  }
  if (!pair) return {};

  // Override the Tailwind color tokens directly. Overriding the intermediate
  // `--accent` would not work: `--color-accent: var(--accent)` is declared at
  // :root, so it resolves there and inherits down as an already-computed value.
  return {
    "--color-accent": pair[0],
    "--color-accent-strong": pair[1],
    "--color-accent-contrast": theme === "dark" ? "#0b0b0d" : "#ffffff",
  };
}
