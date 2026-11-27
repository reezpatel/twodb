import { FileCode2, Terminal, Trash2, Sparkles } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import { fuzzyScore } from "../../../lib/fuzzy.js";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  group: "Skills" | "Commands";
  /** Full skill content — appended as a fenced block on send. */
  content?: string;
}

/** Built-in slash commands (skills arrive live from the session). */
export const BUILTIN_COMMANDS: SlashCommandItem[] = [
  { id: "cmd:compact", label: "compact", description: "Summarize older history — keeps recent context", group: "Commands" },
  { id: "cmd:clear", label: "clear", description: "Drop prior context — fresh thread without a new session", group: "Commands" },
  { id: "cmd:new", label: "new", description: "Start a new thread", group: "Commands" },
];

export function useSlashCommands(skills: Array<{ id: string; name: string; description: string; content: string }>): SlashCommandItem[] {
  return [
    ...skills.map((s) => ({ id: `skill:${s.id}`, label: s.name, description: s.description || "skill", group: "Skills" as const, content: s.content })),
    ...BUILTIN_COMMANDS,
  ];
}

/** Fuzzy: name matches rank above description matches (description score is discounted). */
export function filterCommands(items: SlashCommandItem[], query: string, limit = 9): SlashCommandItem[] {
  const q = query.trim();
  if (!q) return items.slice(0, limit);
  return items
    .map((c, i) => {
      const name = fuzzyScore(c.label, q);
      const desc = fuzzyScore(c.description, q);
      const s = name !== null ? name + 20 : desc !== null ? desc : null;
      return { c, i, s };
    })
    .filter((x): x is { c: SlashCommandItem; i: number; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}

/** `/` slash palette: filtered skills + commands, keyboard navigable. */
export function SlashPopup(props: {
  query: string;
  items: SlashCommandItem[];
  activeIndex: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const matches = filterCommands(props.items, props.query);
  if (matches.length === 0) return null;
  let lastGroup: string | null = null;
  return (
    <div data-slot="slash-popup" role="listbox" className="absolute bottom-full left-0 z-40 mb-1 max-h-64 w-96 overflow-y-auto rounded-md border border-outline bg-surface shadow-lg">
      {matches.map((item, i) => {
        const header = item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        const Icon = item.group === "Skills" ? FileCode2 : item.id === "cmd:clear" ? Trash2 : item.id === "cmd:new" ? Sparkles : Terminal;
        return (
          <div key={item.id}>
            {header ? <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{header}</p> : null}
            <button
              type="button"
              role="option"
              aria-selected={i === props.activeIndex}
              className={cn("flex w-full items-center gap-2 px-2.5 py-1.5 text-left", i === props.activeIndex ? "bg-surface-muted" : "")}
              onMouseEnter={() => props.onHover(i)}
              onClick={() => props.onPick(i)}
            >
              <Icon className="size-3.5 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[12px]", i === props.activeIndex ? "text-ink" : "text-ink")}>/{item.label}</span>
                <span className="block truncate text-[10px] text-ink-muted">{item.description}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
