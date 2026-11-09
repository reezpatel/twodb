import * as React from "react";
import { cn } from "../../../lib/utils";

export interface SidebarProps extends Omit<React.ComponentProps<"aside">, "onResize"> {
  /** Which edge of the shell this panel docks to. Defaults to "right". */
  side?: "left" | "right";
  /**
   * "push" (default) sits inline in the flex row and shrinks the main content.
   * "overlay" floats above the content with a backdrop, leaving layout width untouched —
   * use this for a transient/narrow viewport panel. Requires a `relative` ancestor
   * (e.g. `AppShellBody`, which is `relative` by default).
   */
  mode?: "push" | "overlay";
  /** Whether the panel is shown. Defaults to true. In "push" mode it animates its width to 0; in "overlay" mode it slides off-screen. */
  open?: boolean;
  /** Called when the overlay backdrop is clicked, or Escape is pressed while the panel has focus. Only relevant in "overlay" mode. */
  onOpenChange?: (open: boolean) => void;
  /** Initial/uncontrolled width in px. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Controlled width in px — pairs with onWidthChange. */
  width?: number;
  onWidthChange?: (width: number) => void;
  /** Show the drag handle on the edge shared with the main content. */
  resizable?: boolean;
}

const KEYBOARD_STEP = 16;

/** A left- or right-docked panel, resizable by dragging the edge shared with the main content, in "push" or "overlay" mode. */
function Sidebar({
  className,
  style,
  children,
  side = "right",
  mode = "push",
  open = true,
  onOpenChange,
  defaultWidth = 280,
  minWidth = 200,
  maxWidth = 480,
  width: controlledWidth,
  onWidthChange,
  resizable = true,
  ...props
}: SidebarProps) {
  const [uncontrolledWidth, setUncontrolledWidth] = React.useState(defaultWidth);
  const width = controlledWidth ?? uncontrolledWidth;
  const setWidth = (next: number) => {
    if (controlledWidth === undefined) setUncontrolledWidth(next);
    onWidthChange?.(next);
  };
  const clamp = (value: number) => Math.min(maxWidth, Math.max(minWidth, value));

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      // Right-docked: dragging left (negative delta) grows it. Left-docked: dragging right grows it.
      const delta = side === "right" ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      setWidth(clamp(startWidth + delta));
    };
    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const grow = side === "right" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
    setWidth(clamp(width + (grow ? KEYBOARD_STEP : -KEYBOARD_STEP)));
  };

  const resizeHandle = resizable ? (
    <div
      data-slot="sidebar-resize-handle"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      className={cn(
        "absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-ion-deep focus-visible:after:bg-ion-deep",
        side === "right" ? "left-0 -translate-x-1/2 after:left-1/2" : "right-0 translate-x-1/2 after:right-1/2",
      )}
      onPointerDown={startResize}
      onKeyDown={resizeWithKeyboard}
    />
  ) : null;

  if (mode === "overlay") {
    return (
      <>
        <div
          aria-hidden
          onClick={() => onOpenChange?.(false)}
          className={cn(
            "absolute inset-0 z-30 bg-ink/10 backdrop-blur-sm transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <aside
          data-slot="sidebar"
          data-side={side}
          data-mode={mode}
          className={cn(
            "absolute inset-y-0 z-40 flex h-full flex-col overflow-hidden bg-stone transition-transform duration-200 ease-out",
            side === "right" ? "right-0 border-l border-outline" : "left-0 border-r border-outline",
            open ? "translate-x-0" : side === "right" ? "translate-x-full" : "-translate-x-full",
            className,
          )}
          style={{ width, ...style }}
          {...props}
        >
          {resizeHandle}
          {children}
        </aside>
      </>
    );
  }

  return (
    <aside
      data-slot="sidebar"
      data-side={side}
      data-mode={mode}
      className={cn(
        "relative h-full shrink-0 overflow-hidden bg-stone transition-[width,opacity] duration-200 ease-out",
        side === "right" ? "border-l border-outline" : "border-r border-outline",
        className,
      )}
      style={{ width: open ? width : 0, opacity: open ? 1 : 0, ...style }}
      {...props}
    >
      <div className="relative flex h-full flex-col" style={{ width }}>
        {resizeHandle}
        {children}
      </div>
    </aside>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex h-10 shrink-0 items-center justify-between gap-2 border-b border-outline px-3 font-sans text-[13px] font-bold text-ink", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3", className)} {...props} />;
}

function SidebarSection({ title, className, children, ...props }: React.ComponentProps<"div"> & { title?: string }) {
  return (
    <div data-slot="sidebar-section" className={cn("flex flex-col gap-1.5", className)} {...props}>
      {title ? <div className="px-1 font-sans text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</div> : null}
      {children}
    </div>
  );
}

export { Sidebar, SidebarHeader, SidebarContent, SidebarSection };
