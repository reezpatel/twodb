import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface GroupInputProps {
  value: string[];
  onChange: (groups: string[]) => void;
  suggestions: string[];
}

export function GroupInput({ value, onChange, suggestions }: GroupInputProps) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const name = raw.trim();
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(draft.toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((g) => (
          <Badge key={g} variant="secondary" className="gap-1">
            {g}
            <button type="button" aria-label={`Remove ${g}`} onClick={() => onChange(value.filter((v) => v !== g))}>
              <X size={10} />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder="Add group, press Enter"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
      />
      {unused.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {unused.map((s) => (
            <button key={s} type="button" className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
