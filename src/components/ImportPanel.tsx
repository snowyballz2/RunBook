import { useEffect, useMemo, useRef, useState } from "react";
import { parseGuide } from "../lib/parseGuide";
import * as store from "../lib/storage";
import { GuideParseError, type Guide } from "../lib/types";
import { Check, Clipboard, Upload, Warning, X } from "./Icons";

type Props = {
  onClose: () => void;
  onImported: (guide: Guide) => void;
};

type Preview =
  | { state: "empty" }
  | { state: "ok"; guide: Guide }
  | { state: "error"; message: string };

const SAMPLE = `---
title: My First Runbook
subtitle: A tiny example to get you started
---

## Phase 1 — Set up

### Do the first thing
A short instruction goes here. **Bold** and \`inline code\` both work.

> [!TIP]
> Callouts come from > [!NOTE], [!TIP], [!WARNING], and [!DANGER].

\`\`\`bash
echo "commands render as copyable cards"
\`\`\`
`;

export function ImportPanel({ onClose, onImported }: Props) {
  const [text, setText] = useState("");
  const [fallbackTitle, setFallbackTitle] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = useMemo<Preview>(() => {
    if (!text.trim()) return { state: "empty" };
    try {
      return { state: "ok", guide: parseGuide(text, { fallbackTitle }) };
    } catch (err) {
      return {
        state: "error",
        message:
          err instanceof GuideParseError
            ? err.message
            : "I couldn’t read this as Markdown.",
      };
    }
  }, [text, fallbackTitle]);

  const loadFile = async (file: File) => {
    const content = await file.text();
    setFallbackTitle(file.name.replace(/\.md$/i, ""));
    setText(content);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const onSave = () => {
    if (preview.state !== "ok") return;
    const guide = store.saveImported(text, Date.now());
    onImported(guide);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a guide"
        className="animate-rise flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-paper shadow-lift sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-ink">Add a guide</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-quiet h-8 w-8 !px-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Drop zone */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging
                ? "border-accent bg-accent/8"
                : "border-line-strong hover:border-accent/60 hover:bg-surface-2/60"
            }`}
          >
            <Upload size={22} className="text-ink-faint" />
            <span className="text-sm font-medium text-ink">
              Drop a <code className="font-mono text-[0.85em]">.md</code> file, or
              click to choose
            </span>
            <span className="text-xs text-ink-faint">
              It stays on this device — nothing is uploaded.
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
            }}
          />

          {/* Paste area */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="paste"
                className="flex items-center gap-1.5 text-sm font-medium text-ink"
              >
                <Clipboard size={16} className="text-ink-faint" /> Or paste Markdown
              </label>
              <button
                type="button"
                onClick={() => {
                  setFallbackTitle(undefined);
                  setText(SAMPLE);
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Insert example
              </button>
            </div>
            <textarea
              id="paste"
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              placeholder="Paste a procedure written in Markdown…"
              className="h-44 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
            />
          </div>

          {/* Live preview / validation */}
          <PreviewLine preview={preview} />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <p className="hidden text-xs leading-snug text-ink-faint sm:block">
            Built-in guides live in{" "}
            <code className="font-mono text-[0.85em]">src/guides/</code> — drop a
            file there to ship it with the app.
          </p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={preview.state !== "ok"}
              className="btn btn-primary"
            >
              <Check size={16} /> Add to library
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PreviewLine({ preview }: { preview: Preview }) {
  if (preview.state === "empty") return null;

  if (preview.state === "error") {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-3 text-sm text-ink"
      >
        <Warning size={17} className="mt-0.5 shrink-0 text-danger" />
        <span>{preview.message}</span>
      </div>
    );
  }

  const { guide } = preview;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-3.5 py-3 text-sm text-ink">
      <Check size={17} className="shrink-0 text-accent" />
      <span>
        <strong className="font-semibold">{guide.title}</strong> · {guide.phases.length}{" "}
        {guide.phases.length === 1 ? "phase" : "phases"} · {guide.totalSteps}{" "}
        {guide.totalSteps === 1 ? "step" : "steps"}
      </span>
    </div>
  );
}
