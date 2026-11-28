import { AppShellHeader, NavSidebarToggle, Button } from "@twodb/blocks";
import { Plus } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  navOpen: boolean;
  onToggleNav: () => void;
  /** Primary action on the right (e.g. "Add pin" / "Add bookmark"). */
  actionLabel?: string;
  onAction?: () => void;
}

/** Header bar: sidebar toggle, page title, and a contextual primary action. */
export function TopBar({ title, subtitle, navOpen, onToggleNav, actionLabel, onAction }: TopBarProps) {
  return (
    <AppShellHeader className="h-14 gap-2 border-b border-outline px-4 sm:gap-3 sm:px-5">
      <NavSidebarToggle open={navOpen} onToggle={onToggleNav} aria-label={navOpen ? "Hide navigation" : "Show navigation"} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="truncate text-xs leading-tight text-ink-muted">{subtitle}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button size="sm" onClick={onAction} className="shrink-0">
          <Plus className="size-4" />
          <span className="hidden sm:inline">{actionLabel}</span>
        </Button>
      ) : null}
    </AppShellHeader>
  );
}

