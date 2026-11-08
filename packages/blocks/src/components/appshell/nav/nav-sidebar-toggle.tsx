import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavSidebarToggleProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  open: boolean;
  onToggle: () => void;
}

/** Small icon button for a header/toolbar that opens or collapses a NavSidebar. */
function NavSidebarToggle({ open, onToggle, className, ...props }: NavSidebarToggleProps) {
  return (
    <button
      type="button"
      data-slot="nav-sidebar-toggle"
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      onClick={onToggle}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      {open ? <PanelLeftClose className="size-[18px]" strokeWidth={1.5} /> : <PanelLeftOpen className="size-[18px]" strokeWidth={1.5} />}
    </button>
  );
}

export { NavSidebarToggle };
