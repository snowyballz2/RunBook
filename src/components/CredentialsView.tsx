import { useEffect, useMemo, useState } from "react";
import { accentStyle } from "../lib/accents";
import {
  collectCredentialFields,
  countFilled,
  countSaved,
  groupCredentialSections,
  STANDALONE_SCOPE,
} from "../lib/credentials";
import * as store from "../lib/storage";
import type { Theme } from "../lib/storage";
import { CredentialInput } from "./CredentialInput";
import { ArrowLeft, ChevronDown, Key, Trash } from "./Icons";
import type { LibraryItem } from "./LibraryView";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  items: LibraryItem[];
  /** Limit to one collection's fields (or STANDALONE_SCOPE); undefined = all. */
  scope?: string;
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
};

export function CredentialsView({ items, scope, theme, onToggleTheme, onBack }: Props) {
  // Scope by filtering the guides themselves (the same way the Library card
  // does), so a key shared across scopes shows up wherever it is declared.
  const fields = useMemo(() => {
    const scoped = !scope
      ? items
      : scope === STANDALONE_SCOPE
        ? items.filter((i) => !i.guide.collection)
        : items.filter((i) => i.guide.collection === scope);
    return collectCredentialFields(scoped);
  }, [items, scope]);

  // One section per subject, not per page — see groupCredentialSections.
  const sections = useMemo(() => groupCredentialSections(fields), [fields]);

  // The saved map drives every count (header and per-section); refresh it on
  // any change from an input here or inside a guide.
  const [saved, setSaved] = useState<Record<string, string>>(() => store.getCredentials());
  useEffect(() => {
    setSaved(store.getCredentials());
    return store.onCredentialsChange(() => setSaved(store.getCredentials()));
  }, [fields]);
  const filledTotal = countFilled(fields, saved);
  const savedTotal = countSaved(fields, saved);

  // Sections start condensed; the page is long, and a header row that reads
  // "6/9" says most of what a section needs to say.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = sections.length > 0 && sections.every((s) => open.has(s.id));

  const accentFor = (guideId: string) =>
    accentStyle(items.find((i) => i.guide.id === guideId)?.guide.accent, theme);

  const scopeLabel = scope === STANDALONE_SCOPE ? "Standalone" : scope;

  const onClearAll = () => {
    const question = scope
      ? `Clear the saved ${scopeLabel} credentials on this device? Pre-filled logins like root stay.`
      : "Clear every saved credential on this device? Pre-filled logins like root stay.";
    if (!window.confirm(question)) return;
    // Scoped view clears only its own keys; the unscoped view clears everything.
    store.clearCredentials(scope ? fields.map((f) => f.key) : undefined);
  };

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className="btn btn-quiet h-9 w-9 shrink-0 !px-0"
            aria-label="Back to library"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[15px] font-semibold leading-tight text-ink">
              Credentials
            </h1>
            <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-ink-soft">
              {scope ? `${scopeLabel} · ` : ""}
              {filledTotal}/{fields.length} filled in
            </p>
          </div>

          <div className="flex shrink-0 items-center">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              type="button"
              onClick={onClearAll}
              className="btn btn-quiet h-9 w-9 !px-0"
              aria-label="Clear saved credentials"
              title="Clear saved credentials"
              disabled={savedTotal === 0}
            >
              <Trash size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Every IP, username, and password the guides ask you to choose, in one
          place. Logins that ship fixed — like <code>root</code> — come already
          filled in. Values are stored only in this browser — never synced or
          uploaded — and the same fields appear inside the guides, so filling
          one in here fills it in there too.
        </p>

        {fields.length === 0 ? (
          <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-ink-faint">
              <Key size={26} />
            </span>
            <h2 className="font-display text-xl font-semibold text-ink">
              Nothing to fill in yet
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              Guides declare credential fields as you go — when one asks you to
              pick an IP or create a login, it will show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between px-1">
              <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                {sections.length} sections
              </span>
              <button
                type="button"
                onClick={() =>
                  setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.id)))
                }
                className="btn btn-quiet h-8 px-2 text-[12px] font-medium"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>

            {sections.map((section) => {
              const isOpen = open.has(section.id);
              const filled = countFilled(section.fields, saved);
              const bodyId = `cred-section-${section.id}`;
              return (
                <section
                  key={section.id}
                  aria-label={`${section.title} credentials`}
                  className="mt-3 rounded-2xl border border-line bg-surface/40"
                  style={accentFor(section.accentGuideId)}
                >
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                    <span className="min-w-0 flex-1 truncate font-display text-[1.05rem] font-semibold leading-tight text-ink">
                      {section.title}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[11px] tabular-nums ${
                        filled === section.fields.length ? "text-accent" : "text-ink-soft"
                      }`}
                    >
                      {filled}/{section.fields.length}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-ink-faint transition-transform duration-300 ${
                        isOpen ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div id={bodyId} className="space-y-2.5 px-3 pb-3">
                      {section.fields.map((f) => (
                        <CredentialInput
                          key={f.key}
                          fieldKey={f.key}
                          label={f.label}
                          placeholder={f.placeholder}
                          defaultValue={f.defaultValue}
                          secret={f.secret}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
