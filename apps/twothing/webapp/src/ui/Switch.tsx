import { cn } from "@twodb/blocks";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-ink" : "bg-outline")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-paper shadow-sm transition-transform", checked && "translate-x-4")} />
    </button>
  );
}
