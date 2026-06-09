import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "./Icons";

type Props = { language: string; code: string };

const isComment = (line: string) => {
  const t = line.trimStart();
  return t.startsWith("#") || t.startsWith("//");
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CommandBlock({ language, code }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onCopy = async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1700);
  };

  const lines = code.split("\n");

  return (
    <div className="cmd-surface group/cmd relative overflow-hidden rounded-xl font-mono text-[13px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3.5 py-1.5">
        <span className="select-none text-[10.5px] uppercase tracking-[0.14em] text-white/35">
          {language || "shell"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied to clipboard" : "Copy command"}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
        >
          {copied ? (
            <>
              <Check size={14} /> Copied
            </>
          ) : (
            <>
              <Copy size={14} /> Copy
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-3">
        <code>
          {lines.map((line, i) => (
            <span
              key={i}
              className={`block whitespace-pre ${
                isComment(line) ? "text-white/35" : "text-[var(--color-cmd-fg)]"
              }`}
            >
              {line.length ? line : " "}
            </span>
          ))}
        </code>
      </pre>

      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
