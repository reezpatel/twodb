import { useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTagSuggestions } from "./use-workspace";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

/** Chips + free-text input with suggestions from the shared llm tag list. */
export function TagInput({ id, value, onChange, placeholder = "add tag…" }: TagInputProps) {
  const inputId = useId();
  const suggestions = useTagSuggestions();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return (suggestions.data ?? []).filter((t) => !value.includes(t) && (!q || t.toLowerCase().includes(q))).slice(0, 6);
  }, [suggestions.data, value, draft]);

  const addTag = (tag: string) => {
    const next = tag.trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setDraft("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "border-input bg-background flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-md border px-2 py-1 text-sm",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 text-[10px]">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="hover:text-foreground text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter((t) => t !== tag));
            }}
          >
            <X size={10} />
          </button>
        </Badge>
      ))}
      <div className="relative min-w-20 flex-1">
        <input
          id={id ?? inputId}
          ref={inputRef}
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          value={draft}
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {open && matches.length > 0 && (
          <ul className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 max-h-40 w-44 overflow-auto rounded-md border p-1 shadow-md">
            {matches.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className="hover:bg-accent hover:text-accent-foreground w-full rounded-sm px-2 py-1 text-left text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(tag);
                  }}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
