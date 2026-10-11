import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayName, type EmailAddress } from "../email-api";

const ADDRESS_RE = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

/** Parses "Name <a@b.c>", "a@b.c" and comma/semicolon separated lists. */
export function parseAddresses(input: string): EmailAddress[] {
  return input
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*)<([^>]+)>$/);
      const address = (m ? m[2] : part).trim().toLowerCase();
      const name = m ? m[1].trim().replace(/^"|"$/g, "") || null : null;
      return { name, address };
    });
}

export function RecipientInput({ id, value, onChange, placeholder }: { id: string; value: EmailAddress[]; onChange: (v: EmailAddress[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const commit = () => {
    const parsed = parseAddresses(text);
    if (!parsed.length) return;
    const seen = new Set(value.map((v) => v.address));
    onChange([...value, ...parsed.filter((p) => !seen.has(p.address))]);
    setText("");
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {value.map((a) => (
        <span
          key={a.address}
          title={a.address}
          className={cn(
            "bg-muted/50 inline-flex h-7 max-w-60 items-center gap-1 rounded-full border px-2.5 text-xs",
            !ADDRESS_RE.test(a.address) && "border-destructive text-destructive",
          )}
        >
          <span className="truncate font-medium">{a.name ? displayName(a) : a.address}</span>
          <button type="button" aria-label={`Remove ${a.address}`} className="text-muted-foreground hover:text-foreground" onClick={() => onChange(value.filter((v) => v.address !== a.address))}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/[,;\n]/.test(pasted)) {
            e.preventDefault();
            const parsed = parseAddresses(pasted);
            const seen = new Set(value.map((v) => v.address));
            onChange([...value, ...parsed.filter((p) => !seen.has(p.address))]);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
            if (text.trim()) {
              e.preventDefault();
              commit();
            }
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        className="placeholder:text-muted-foreground h-7 min-w-32 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
