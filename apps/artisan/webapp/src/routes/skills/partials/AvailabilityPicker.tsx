import { Check } from "lucide-react";
import { Checkbox } from "@twodb/blocks";
import { cn } from "../../../lib/cn.js";
import type { AgentInfo, DirectoryInfo, ScopeMode, SpaceInfo } from "../../../lib/artisan-client.js";

interface ScopeLike { mode: ScopeMode; all: boolean; ids: string[] }

const MODES: Array<{ id: ScopeMode; label: string; hint: string }> = [
  { id: "global", label: "Global", hint: "Every agent, in every space." },
  { id: "agents", label: "Agents", hint: "Specific agents, or all agents." },
  { id: "spaces", label: "Spaces", hint: "Agents running in specific spaces, or all spaces." },
  { id: "directories", label: "Directories", hint: "Sessions in specific directories, or all directories." },
  { id: "types", label: "Agent types", hint: "Every agent of the chosen types, or all types." },
];

const BUILTIN_TYPES = ["directory", "sub_agent", "persona", "collaborator"];

export function modeLabel(mode: ScopeMode): string {
  return MODES.find((m) => m.id === mode)?.label ?? mode;
}

/** Short human summary, e.g. "3 spaces" / "All agents" / "Global". */
export function scopeSummary(scope: ScopeLike, ctx?: { agents: AgentInfo[]; spaces: SpaceInfo[]; directories?: DirectoryInfo[] }): string {
  if (scope.mode === "global") return "Global";
  const noun = scope.mode === "types" ? "agent types" : scope.mode;
  if (scope.all) return `All ${noun}`;
  const names = scope.ids.map((id) =>
    scope.mode === "agents" ? ctx?.agents.find((a) => a.id === id)?.name ?? id
    : scope.mode === "spaces" ? ctx?.spaces.find((s) => s.id === id)?.name ?? id
    : scope.mode === "directories" ? ctx?.directories?.find((d) => d.id === id)?.title ?? id
    : id.replace(/_/g, " "));
  return names.length <= 2 ? names.join(", ") : `${names.length} ${noun}`;
}

export const DEFAULT_SCOPE = { mode: "global" as const, all: true, ids: [] as string[] };

/** Choose how a skill is made available: one mode, then "all" or a multi-select list. */
export function AvailabilityPicker<S extends ScopeLike>({ scope, onChange, agents, spaces, directories }: {
  scope: S;
  onChange: (s: S) => void;
  agents: AgentInfo[];
  spaces: SpaceInfo[];
  /** Passing directories adds the "Directories" mode (MCP servers); skills omit it. */
  directories?: DirectoryInfo[];
}) {
  const modes = MODES.filter((m) => m.id !== "directories" || directories);
  const types = [...new Set([...BUILTIN_TYPES, ...agents.map((a) => a.type)])];
  const options: Array<{ id: string; label: string; sub?: string }> =
    scope.mode === "agents" ? agents.map((a) => ({ id: a.id, label: a.name, sub: a.type.replace(/_/g, " ") }))
    : scope.mode === "spaces" ? spaces.map((s) => ({ id: s.id, label: s.name }))
    : scope.mode === "directories" ? (directories ?? []).map((d) => ({ id: d.id, label: d.title, sub: `${d.runner}:${d.path}` }))
    : scope.mode === "types" ? types.map((t) => ({ id: t, label: t.replace(/_/g, " ") }))
    : [];
  const noun = scope.mode === "types" ? "agent types" : scope.mode;

  const setMode = (mode: ScopeMode) => onChange({ ...scope, mode, all: true, ids: [] });
  const toggle = (id: string) => onChange({ ...scope, all: false, ids: scope.ids.includes(id) ? scope.ids.filter((x) => x !== id) : [...scope.ids, id] });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn("flex flex-col rounded-lg px-3 py-2 text-left transition-colors", scope.mode === m.id ? "bg-primary/15" : "bg-surface-muted/40 hover:bg-surface-muted")}
          >
            <span className="text-[13px] font-medium text-ink">{m.label}</span>
            <span className="text-[11px] leading-snug text-ink-muted">{m.hint}</span>
          </button>
        ))}
      </div>

      {scope.mode !== "global" ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <Checkbox checked={scope.all} onCheckedChange={(v) => onChange({ ...scope, all: Boolean(v), ids: Boolean(v) ? [] : scope.ids })} />
            All {noun}
          </label>
          {!scope.all ? (
            options.length === 0 ? (
              <p className="text-[12px] text-ink-muted">No {noun} to choose from yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                  const on = scope.ids.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(o.id)}
                      title={o.sub}
                      className={cn("flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] transition-colors", on ? "bg-primary/15 text-ink" : "bg-surface-muted text-ink-muted hover:text-ink")}
                    >
                      {on ? <Check className="size-3" /> : null}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** True when the scope can be saved. */
export function scopeValid(scope: ScopeLike): boolean {
  return scope.mode === "global" || scope.all || scope.ids.length > 0;
}
