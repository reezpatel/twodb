import { Plus, X } from "lucide-react";

export function TagInput({
  tags,
  input,
  onInput,
  onAdd,
  onRemove,
  suggestions,
}: {
  tags: string[];
  input: string;
  onInput: (v: string) => void;
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
  suggestions: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-outline bg-paper px-2 py-1.5 focus-within:border-ink/30">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-paper">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onRemove(t)} className="opacity-60 hover:opacity-100">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => (e.target.value.endsWith(",") ? onAdd(e.target.value) : onInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(input);
            } else if (e.key === "Backspace" && !input && tags.length) onRemove(tags[tags.length - 1]);
          }}
          placeholder={tags.length ? "" : "Add tags…"}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-muted"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button type="button" key={s} onClick={() => onAdd(s)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-outline px-2 py-0.5 text-xs text-ink-muted hover:border-ink/30 hover:text-ink">
              <Plus className="size-3" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
