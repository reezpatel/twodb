import { Plus, X } from "lucide-react";
import { useState } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

/** Tag chip editor: chips with remove buttons + an input that adds on Enter/comma. */
export function TagInput({ tags, onChange, suggestions = [], placeholder = "Add tags…" }: TagInputProps) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "").toLowerCase();
    if (!t || tags.includes(t)) {
      setInput("");
      return;
    }
    onChange([...tags, t]);
    setInput("");
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  const remaining = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);

  return (
    <div className="grid gap-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-outline bg-paper px-2 py-1.5 focus-within:border-ion-deep">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-[6px] bg-ink px-2 py-0.5 text-xs font-medium text-paper">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => remove(t)} className="opacity-60 hover:opacity-100">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            } else if (e.key === "Backspace" && !input && tags.length) remove(tags[tags.length - 1]);
          }}
          placeholder={tags.length ? "" : placeholder}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => add(s)}
              className="inline-flex items-center gap-0.5 rounded-[6px] border border-dashed border-outline px-2 py-0.5 text-xs text-ink-muted hover:border-ion-deep hover:text-ink"
            >
              <Plus className="size-3" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

