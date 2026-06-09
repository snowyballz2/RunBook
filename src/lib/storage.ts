/**
 * Local-first persistence: imported guides, per-step progress, collapsed
 * phases, and theme. All in localStorage, all behind try/catch so the app
 * still works in private-mode browsers where storage can throw.
 */

import { parseGuide } from "./parseGuide";
import type { Guide } from "./types";

const NS = "runbook";
const K = {
  imported: `${NS}:guides`,
  theme: `${NS}:theme`,
  progress: (id: string) => `${NS}:progress:${id}`,
  collapsed: (id: string) => `${NS}:collapsed:${id}`,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable / full — degrade gracefully */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Imported guides                                                            */
/* -------------------------------------------------------------------------- */

export type StoredGuide = {
  id: string;
  title: string;
  markdown: string;
  addedAt: number;
};

export function listImported(): StoredGuide[] {
  return read<StoredGuide[]>(K.imported, []);
}

/** Add or replace an imported guide (keyed by guide id). Returns the parsed guide. */
export function saveImported(markdown: string, now: number): Guide {
  const guide = parseGuide(markdown); // throws GuideParseError on bad input
  const all = listImported().filter((g) => g.id !== guide.id);
  all.unshift({ id: guide.id, title: guide.title, markdown, addedAt: now });
  write(K.imported, all);
  return guide;
}

export function removeImported(id: string): void {
  write(
    K.imported,
    listImported().filter((g) => g.id !== id),
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export function getProgress(guideId: string): Set<string> {
  return new Set(read<string[]>(K.progress(guideId), []));
}

export function getProgressCount(guideId: string): number {
  return read<string[]>(K.progress(guideId), []).length;
}

export function saveProgress(guideId: string, done: Set<string>): void {
  if (done.size === 0) remove(K.progress(guideId));
  else write(K.progress(guideId), [...done]);
}

export function resetProgress(guideId: string): void {
  remove(K.progress(guideId));
}

/* -------------------------------------------------------------------------- */
/* Collapsed phases                                                           */
/* -------------------------------------------------------------------------- */

export function getCollapsed(guideId: string): Set<string> {
  return new Set(read<string[]>(K.collapsed(guideId), []));
}

export function saveCollapsed(guideId: string, collapsed: Set<string>): void {
  if (collapsed.size === 0) remove(K.collapsed(guideId));
  else write(K.collapsed(guideId), [...collapsed]);
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  const saved = read<Theme | null>(K.theme, null);
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function saveTheme(theme: Theme): void {
  write(K.theme, theme);
}
