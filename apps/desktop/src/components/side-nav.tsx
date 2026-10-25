import type { ReactNode } from "react";
import { NavLink } from "react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppShellContext } from "./blocks/app-shell/app-shell-context";

function SideNav({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <aside data-slot="side-nav" className={cn("flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto px-3 py-4", className)}>
      {children}
    </aside>
  );
}

function SideNavHeader({ title, description, children }: { title?: string; description?: string; children?: ReactNode }) {
  if (children) {
    return <div className="flex items-center gap-2 px-1">{children}</div>;
  }
  return (
    <div className="flex flex-col px-1">
      <h2 className="text-md font-medium">{title}</h2>
      {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
    </div>
  );
}

function SideNavGroup({ label, separated, className, children }: { label?: string; separated?: boolean; className?: string; children: ReactNode }) {
  return (
    <nav className={cn("flex flex-col gap-0.5", separated && "border-t pt-2", className)}>
      {label ? <span className="text-muted-foreground/70 px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">{label}</span> : null}
      {children}
    </nav>
  );
}

interface SideNavItemProps {
  label: string;
  icon?: LucideIcon;
  dotClassName?: string;
  count?: number;
  to?: string;
  active?: boolean;
  onSelect?: () => void;
  className?: string;
}

function SideNavItem({ label, icon: Icon, dotClassName, count, to, active, onSelect, className }: SideNavItemProps) {
  const { closeNavigation } = useAppShellContext();
  const classes = (isActive: boolean) =>
    cn(
      "hover:bg-accent/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors outline-none",
      "focus-visible:ring-ring focus-visible:ring-2",
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      className,
    );

  const content = (
    <>
      {Icon ? <Icon size={15} className="shrink-0" /> : null}
      {!Icon && dotClassName ? <span className={cn("size-2 shrink-0 rounded-sm", dotClassName)} /> : null}
      <span className="flex-1 truncate text-left">{label}</span>
      {count ? <span className="text-xs tabular-nums">{count}</span> : null}
    </>
  );

  if (to) {
    return (
      <NavLink to={to} onClick={closeNavigation} className={({ isActive }) => classes(isActive)}>
        {content}
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.();
        closeNavigation();
      }}
      className={classes(active ?? false)}
    >
      {content}
    </button>
  );
}

function SideNavFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-0.5">{children}</div>;
}

export { SideNav, SideNavHeader, SideNavGroup, SideNavItem, SideNavFooter };
