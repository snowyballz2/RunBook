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
  // A field that ships a default is a FIXED, public value (e.g. `root`) that
  // lives in the guide source. It is read-only on purpose: you can't type your
  // own credential into it, so nothing private ever lands in a defaulted field.
  // Your secrets go only into the blank (no-default) fields, which save locally.
  const locked = defaultValue != null && defaultValue.trim() !== "";

  const [value, setValue] = useState(() => store.getCredential(fieldKey) || "");
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<"saved" | "copied" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync when the same key is edited elsewhere (reader <-> credentials
  // view) — but never while this input is focused (would fight the user
  // mid-edit), and never for locked fields (their value is fixed).
  useEffect(
    () =>
      store.onCredentialsChange(() => {
        if (locked) return;
        if (inputRef.current && document.activeElement === inputRef.current) return;
        setValue((v) => {
          const latest = store.getCredential(fieldKey) || "";
          return latest === v ? v : latest;
        });
      }),
    [fieldKey, locked],
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

  // Locked fields always show their fixed default; editable fields show the
  // value saved on this device.
  const shownValue = locked ? (defaultValue as string) : value;

  const onCopy = async () => {
    if (!shownValue) return;
    try {
      await navigator.clipboard.writeText(shownValue);
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
        {locked ? (
          <span className="ml-auto text-[10.5px] font-medium text-ink-faint" title="A fixed default from the guide — type your own values only into the blank fields.">
            Fixed default
          </span>
        ) : (
          <span
            aria-live="polite"
            className={`ml-auto text-[10.5px] font-medium transition-opacity duration-300 ${
              flash ? "opacity-100" : "opacity-0"
            } ${flash === "copied" ? "text-accent" : "text-ink-faint"}`}
          >
            {flash === "copied" ? "Copied" : flash === "saved" ? "Saved on this device" : ""}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        <input
          ref={inputRef}
          id={`cred-${fieldKey}`}
          type={!locked && secret && !revealed ? "password" : "text"}
          value={shownValue}
          readOnly={locked}
          onChange={locked ? undefined : (e) => onChange(e.target.value)}
          onBlur={
            locked
              ? undefined
              : () =>
                  // A field left empty falls back to its saved value.
                  setValue((v) => (v.trim() ? v : store.getCredential(fieldKey) || ""))
          }
          placeholder={placeholder ?? (secret ? "••••••••" : "")}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-readonly={locked || undefined}
          className={`min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-mono text-[13px] outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)] ${
            locked ? "cursor-default text-ink-soft" : "text-ink"
          }`}
        />
        {secret && !locked && (
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
          disabled={!shownValue}
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
