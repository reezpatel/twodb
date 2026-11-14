import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "../../lib/cn.js";

/** Click-to-edit text. Enter / blur saves, Esc cancels. A required field (`required`) can't be emptied. */

export function InlineEdit({ value, placeholder, onSave, className, disabled, required }: { value: string; placeholder: string; onSave: (v: string) => Promise<void>; className?: string; disabled?: boolean; required?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const skip = useRef(false);
  useEffect(() => setDraft(value), [value]);

  const commit = async () => {
    setEditing(false);
    const v = draft.trim();
    if (skip.current) { skip.current = false; return setDraft(value); }
    if (v === value || (!v && required)) return setDraft(value);
    setBusy(true);
    try { await onSave(v); } catch { setDraft(value); } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { skip.current = true; (e.target as HTMLInputElement).blur(); }
        }}
        className={cn("w-full min-w-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-ink outline-none focus:ring-1 focus:ring-outline-strong", className)}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      title={disabled ? undefined : "Click to edit"}
      className={cn("group flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors", !disabled && "hover:bg-surface-muted", !value && "italic opacity-70", className)}
    >
      <span className="min-w-0 truncate">{value || placeholder}</span>
      {busy ? <Loader2 className="size-3 shrink-0 animate-spin" /> : !disabled ? <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" /> : null}
    </button>
  );
}

