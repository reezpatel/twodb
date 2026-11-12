import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { cn } from "@twodb/blocks";

export function SidebarLink({ to, icon, children, end }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn("flex h-[30px] items-center gap-2 rounded-md px-2 text-[13.5px] hover:bg-ink/[0.05]", isActive ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/85")}
    >
      <span className="flex size-4 items-center justify-center text-ink-muted">{icon}</span>
      {children}
    </NavLink>
  );
}

export function SidebarSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="group/sec flex h-6 items-center justify-between px-2">
        <span className="text-[11.5px] font-semibold text-ink-muted">{title}</span>
        <span className="opacity-0 group-hover/sec:opacity-100">{action}</span>
      </div>
      {children}
    </div>
  );
}
