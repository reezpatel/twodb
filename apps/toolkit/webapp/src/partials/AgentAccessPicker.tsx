import { cn } from "../lib/cn.js";
import type { AgentInfo } from "../lib/toolkit-client.js";

/**
 * Agent access picker: empty selection = ALL agents (default); selecting
 * specific agents restricts the tool to them. Chips toggle; a second click
 * on the last selected chip returns to "all agents".
 */
export function AgentAccessPicker({ agents, value, onChange, disabled }: {
  agents: AgentInfo[];
  value: string[];
  onChange: (agentIds: string[]) => void;
  disabled?: boolean;
}) {
  const known = new Set(agents.map((a) => a.id));
  const chips = [...agents, ...value.filter((id) => !known.has(id)).map((id) => ({ id, name: id, type: "unknown", description: null }))];

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={value.length === 0} onClick={() => !disabled && onChange([])} disabled={disabled}>
          All agents
        </Chip>
        {chips.length > 1 ? <span className="mx-1 text-[11px] text-ink-muted">or only</span> : null}
        {chips.map((a) => (
          <Chip key={a.id} active={value.includes(a.id)} onClick={() => toggle(a.id)} disabled={disabled} title={a.description ?? a.type}>
            {a.name}
          </Chip>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted">
        {value.length === 0
          ? "Every agent sees these tools (default)."
          : `Only ${value.length} selected agent${value.length === 1 ? "" : "s"} can list/call these tools.`}
      </p>
    </div>
  );
}

function Chip({ active, onClick, children, disabled, title }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active ? "border-accent bg-accent/10 text-accent-foreground" : "border-outline/60 text-ink-muted hover:border-outline-strong hover:text-ink",
        disabled && "opacity-60",
      )}
    >
      {children}
    </button>
  );
}

export function agentAccessSummary(agentIds: string[], agents: AgentInfo[]): string {
  if (agentIds.length === 0) return "all agents";
  return agentIds.map((id) => agents.find((a) => a.id === id)?.name ?? id).join(", ");
}
