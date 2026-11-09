import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CanvasSidebarProps extends Omit<React.ComponentProps<"aside">, "title"> {
  /** Whether the panel is shown. Defaults to true. */
  open?: boolean;
  /** Called when the close button is clicked. */
  onClose?: () => void;
  /** Title in the panel header. */
  title?: React.ReactNode;
  /** Panel width in px. Defaults to 400. */
  width?: number;
  children: React.ReactNode;
}

/** A right-docked canvas/side panel — for previews, rendered documents, or any artifact the model produces. */
function CanvasSidebar({ open = true, onClose, title, width = 400, className, children, ...props }: CanvasSidebarProps) {
  return (
    <aside
      data-slot="canvas-sidebar"
      data-state={open ? "open" : "closed"}
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-l border-outline bg-paper transition-[width] duration-200 ease-out",
        className,
      )}
      style={{ width: open ? width : 0 }}
      {...props}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-outline px-3">
        {title ? <div className="min-w-0 flex-1 truncate font-sans text-[13px] font-semibold text-ink">{title}</div> : <div className="flex-1" />}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink focus-visible:outline-2 focus-visible:outline-ion-deep"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

export { CanvasSidebar };
