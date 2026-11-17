import { ChevronDown, MessageSquare, Braces, Terminal, GitBranch, FileDiff, ScanSearch, Palette, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, useLargeViewport } from "@twodb/blocks";
import { cn } from "../../../lib/cn.js";

export type SessionTabId = "chat" | "editor" | "terminal" | "changes" | "checkpoints" | "canvas" | "inspector";

export const SESSION_TABS: Array<{ id: SessionTabId; label: string; icon: LucideIcon }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "editor", label: "Editor", icon: Braces },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "changes", label: "Changes", icon: FileDiff },
  { id: "checkpoints", label: "Checkpoints", icon: GitBranch },
  { id: "canvas", label: "Canvas", icon: Palette },
  { id: "inspector", label: "Inspector", icon: ScanSearch },
];

/** Tab strip (icon buttons) on lg+; on mobile one button showing the active tab that opens the list. */
export function SessionTabs(props: { active: SessionTabId; onChange: (id: SessionTabId) => void }) {
  const isLarge = useLargeViewport();
  if (!isLarge) {
    const current = SESSION_TABS.find((t) => t.id === props.active) ?? SESSION_TABS[0];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" data-slot="session-tabs-menu" aria-label={`View: ${current.label}`} className="flex h-8 items-center gap-1.5 rounded-md bg-surface-muted px-2.5 text-[13px] text-ink">
            <current.icon className="size-4" />
            {current.label}
            <ChevronDown className="size-3.5 text-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SESSION_TABS.map((tab) => (
            <DropdownMenuItem key={tab.id} onSelect={() => props.onChange(tab.id)} className={tab.id === props.active ? "bg-surface-muted" : undefined}>
              <tab.icon className="size-4" /> {tab.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
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
