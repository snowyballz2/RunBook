import { useCallback, useEffect, useMemo, useState } from "react";
import { loadBundledGuides } from "./lib/bundledGuides";
import { parseGuide } from "./lib/parseGuide";
import * as store from "./lib/storage";
import type { Theme } from "./lib/storage";
import type { Guide } from "./lib/types";
import { CredentialsView } from "./components/CredentialsView";
import { ImportPanel } from "./components/ImportPanel";
import { LibraryView, type LibraryItem } from "./components/LibraryView";
import { ReaderView } from "./components/ReaderView";

type Route =
  | { name: "library" }
  | { name: "reader"; id: string }
  | { name: "credentials"; scope?: string };

function parseHash(): Route {
  try {
    const m = location.hash.match(/^#\/g\/(.+)$/);
    if (m) return { name: "reader", id: decodeURIComponent(m[1]) };
    const c = location.hash.match(/^#\/credentials(?:\/(.+))?$/);
    if (c) {
      return { name: "credentials", ...(c[1] ? { scope: decodeURIComponent(c[1]) } : {}) };
    }
  } catch {
    // Malformed escape in a hand-edited hash — fall through to the library.
  }
  return { name: "library" };
}

/** Merge bundled + imported guides; imported overrides a bundled guide by id. */
function mergeLibrary(
  bundled: { guide: Guide; markdown: string }[],
): LibraryItem[] {
  const stored = store.listImported();
  const importedItems: (LibraryItem & { addedAt: number })[] = [];
  for (const s of stored) {
    try {
      const guide = parseGuide(s.markdown, { fallbackTitle: s.title });
      importedItems.push({
        guide,
        origin: "imported",
        markdown: s.markdown,
        addedAt: s.addedAt,
      });
    } catch {
      /* skip an imported guide that no longer parses */
    }
  }
  importedItems.sort((a, b) => b.addedAt - a.addedAt);

  const importedIds = new Set(importedItems.map((i) => i.guide.id));
  const bundledItems: LibraryItem[] = bundled
    .filter((b) => !importedIds.has(b.guide.id))
    .map((b) => ({ guide: b.guide, origin: "bundled", markdown: b.markdown }));

  return [
    ...importedItems.map(({ guide, origin, markdown }) => ({
      guide,
      origin,
      markdown,
    })),
    ...bundledItems,
  ];
}

export function App() {
  const bundled = useMemo(() => loadBundledGuides(), []);
  const [items, setItems] = useState<LibraryItem[]>(() => mergeLibrary(bundled));
  const reload = useCallback(() => setItems(mergeLibrary(bundled)), [bundled]);

  const [route, setRoute] = useState<Route>(() => parseHash());
  const [showImport, setShowImport] = useState(false);

  const [theme, setTheme] = useState<Theme>(() => store.getTheme());
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    store.saveTheme(theme);
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0E0F12" : "#FAFAF8");
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openGuide = (id: string) => {
    location.hash = `#/g/${encodeURIComponent(id)}`;
  };
  const goLibrary = () => {
    if (location.hash && location.hash !== "#/") location.hash = "";
    reload();
  };

  const onImported = (guide: Guide) => {
    reload();
    setShowImport(false);
    openGuide(guide.id);
  };

  const onReset = (id: string) => {
    store.resetProgress(id);
    reload();
  };

  const onRemove = (id: string) => {
    const item = items.find((i) => i.guide.id === id);
    if (!window.confirm(`Remove “${item?.guide.title ?? "this guide"}” from your library?`))
      return;
    store.removeImported(id);
    reload();
  };

  const current =
    route.name === "reader"
      ? items.find((i) => i.guide.id === route.id)
      : undefined;

  // A reader hash that points at nothing (removed / bad link) → back to library.
  useEffect(() => {
    if (route.name === "reader" && !current) goLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, current]);

  return (
    <>
      {current ? (
        <ReaderView
          key={current.guide.id}
          guide={current.guide}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={goLibrary}
        />
      ) : route.name === "credentials" ? (
        <CredentialsView
          items={items}
          scope={route.scope}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={goLibrary}
        />
      ) : (
        <LibraryView
          items={items}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpen={openGuide}
          onOpenCredentials={(scope) => {
            location.hash = `#/credentials/${encodeURIComponent(scope)}`;
          }}
          onAdd={() => setShowImport(true)}
          onReset={onReset}
          onRemove={onRemove}
        />
      )}

      {showImport && (
        <ImportPanel onClose={() => setShowImport(false)} onImported={onImported} />
      )}
    </>
  );
}
