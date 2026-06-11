import { useEffect, useRef, useState } from "react";
import * as store from "../lib/storage";
import { Check, Copy, Eye, EyeOff, Key } from "./Icons";

type Props = {
  fieldKey: string;
  label: string;
  placeholder?: string;
  /** Pre-filled value for logins that ship fixed (e.g. `root`). */
  defaultValue?: string;
  secret: boolean;
  hintHtml?: string;
  /** Compact rows for the Credentials view; full cards in the reader. */
  compact?: boolean;
};

export function CredentialInput({
  fieldKey,
  label,
  placeholder,
  defaultValue,
  secret,
  hintHtml,
  compact = false,
}: Props) {
  const [value, setValue] = useState(
    () => store.getCredential(fieldKey) || defaultValue || "",
  );
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<"saved" | "copied" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync when the same key is edited elsewhere (reader <-> credentials
  // view) — but never while this input is focused, or re-applying the default
  // would fight the user mid-edit (clear, pause, type → merged text).
  useEffect(
    () =>
      store.onCredentialsChange(() => {
        if (inputRef.current && document.activeElement === inputRef.current) return;
        setValue((v) => {
          const latest = store.getCredential(fieldKey) || defaultValue || "";
          return latest === v ? v : latest;
        });
      }),
    [fieldKey, defaultValue],
  );

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const showFlash = (kind: "saved" | "copied") => {
    setFlash(kind);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  };

  const onChange = (next: string) => {
    setValue(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      store.setCredential(fieldKey, next);
      showFlash("saved");
    }, 400);
  };

  const onCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showFlash("copied");
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-line bg-surface px-3 py-2"
          : "rounded-xl border border-accent/25 bg-accent/5 px-3.5 py-3"
      }
    >
      <div className="flex items-center gap-1.5">
        {!compact && <Key size={13} className="shrink-0 text-accent" />}
        <label
          htmlFor={`cred-${fieldKey}`}
          className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-ink-soft"
        >
          {label}
        </label>
        <span
          aria-live="polite"
          className={`ml-auto text-[10.5px] font-medium transition-opacity duration-300 ${
            flash ? "opacity-100" : "opacity-0"
          } ${flash === "copied" ? "text-accent" : "text-ink-faint"}`}
        >
          {flash === "copied" ? "Copied" : flash === "saved" ? "Saved on this device" : ""}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        <input
          ref={inputRef}
          id={`cred-${fieldKey}`}
          type={secret && !revealed ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() =>
            // A field left empty falls back to its saved value or default.
            setValue((v) =>
              v.trim() ? v : store.getCredential(fieldKey) || defaultValue || "",
            )
          }
          placeholder={placeholder ?? (secret ? "••••••••" : "")}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-mono text-[13px] text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="btn btn-quiet h-7 w-7 shrink-0 !px-0"
            aria-label={revealed ? "Hide value" : "Show value"}
            title={revealed ? "Hide" : "Show"}
          >
            {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="btn btn-quiet h-7 w-7 shrink-0 !px-0 disabled:opacity-30"
          aria-label={`Copy ${label}`}
          title="Copy"
        >
          {flash === "copied" ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
        </button>
      </div>

      {hintHtml && !compact && (
        <div
          className="prose-rb mt-1.5 text-[12.5px] text-ink-soft"
          dangerouslySetInnerHTML={{ __html: hintHtml }}
        />
      )}
    </div>
  );
}
