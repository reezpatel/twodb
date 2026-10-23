import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router";
import type { LucideIcon } from "lucide-react";
import { Resizable } from "re-resizable";
import { cn } from "@/lib/utils";
import { useMobileNav } from "./mobile-nav-context";

interface SideNavProps {
  className?: string;
  children: ReactNode;
  /** Desktop width in px — when set with onWidthChange the nav is resizable (right edge). */
  width?: number;
  onWidthChange?: (width: number) => void;
  minNavWidth?: number;
  maxNavWidth?: number;
}

function SideNav({ className, children, width, onWidthChange, minNavWidth = 180, maxNavWidth = 420 }: SideNavProps) {
  const { isMobile, sideNavTarget, setSideNavActive } = useMobileNav();

  useEffect(() => {
    if (!isMobile) return;
    setSideNavActive(true);
    return () => setSideNavActive(false);
  }, [isMobile, setSideNavActive]);

  if (isMobile) {
    if (!sideNavTarget) return null;
    return createPortal(<aside className={cn("flex flex-col gap-3", className)}>{children}</aside>, sideNavTarget);
  }

  const resizable = width !== undefined && onWidthChange !== undefined;

  // Non-resizable apps keep the simple aside.
  if (!resizable) {
    return (
      <aside className={cn("bg-muted/20 flex h-full min-h-0 w-[220px] shrink-0 flex-col gap-3 overflow-y-auto border-r p-4 px-3", className)}>
        {children}
      </aside>
    );
  }

  return (
    <Resizable
      size={{ width, height: "100%" }}
      minWidth={minNavWidth}
      maxWidth={maxNavWidth}
      enable={{ right: true }}
      handleStyles={{ right: { width: "5px", right: "-2px", height: "100%", cursor: "col-resize" } }}
      handleComponent={{
        right: (
          <div
            className="bg-border hover:bg-primary/60 absolute inset-y-0 right-0 z-10 w-1 translate-x-1/2 cursor-col-resize transition-colors"
            title="Drag to resize"
          />
        ),
      }}
      onResizeStop={(_e, _dir, _ref, delta) => onWidthChange(width + delta.width)}
      className="shrink-0"
    >
      <aside className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>{children}</aside>
    </Resizable>
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
  const { isMobile, closeNav } = useMobileNav();
  const closeOnMobile = () => {
    if (isMobile) closeNav();
  };
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
      <NavLink to={to} onClick={closeOnMobile} className={({ isActive }) => classes(isActive)}>
        {content}
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.();
        closeOnMobile();
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
