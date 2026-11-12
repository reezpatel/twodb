import { MessageSquare, Braces, Terminal, GitBranch, type LucideIcon } from "lucide-react";
import { cn } from "../../../lib/cn.js";

export type SessionTabId = "chat" | "editor" | "terminal" | "checkpoints";

export const SESSION_TABS: Array<{ id: SessionTabId; label: string; icon: LucideIcon }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "editor", label: "Editor", icon: Braces },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "checkpoints", label: "Checkpoints", icon: GitBranch },
];

/** Underline tab strip (legacy code-header tabs). */
export function SessionTabs(props: { active: SessionTabId; onChange: (id: SessionTabId) => void }) {
  return (
    <div data-slot="session-tabs" className="flex items-center gap-0.5">
      {SESSION_TABS.map((tab) => {
        const active = props.active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            aria-pressed={active}
            onClick={() => props.onChange(tab.id)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              active ? "bg-surface-muted text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <tab.icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
