import { Keyboard } from "lucide-react";

/** Type a code (or let a USB scanner type it) — Enter submits. */
export function ManualEntry({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string }) {
  return (
    <form
      className="flex items-center gap-2 rounded-2xl border border-outline bg-paper px-3 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Keyboard className="size-4 shrink-0 text-ink-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Type a code or scan with a USB scanner…"}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="h-8 min-w-0 flex-1 bg-transparent font-mono text-sm tracking-wide outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-muted"
      />
      <button type="submit" disabled={!value.trim()} className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper disabled:opacity-30">
        Go
      </button>
    </form>
  );
}
