import * as React from "react";
import { cn } from "../../../lib/utils";
import { useLargeViewport } from "../use-large-viewport";
import { NavSection, NavItem, type NavGroupData, type NavItemData } from "./nav-item";
import { WorkspaceSwitcher, type WorkspaceSwitcherProps } from "./workspace-switcher";

export interface NavSidebarProps {
  /** Controls visibility: docked it clips to 0 width, overlay it slides off-screen. */
  open?: boolean;
  /**
   * "responsive" docks inline (push) on lg+ screens and floats as an overlay
   * sheet (togglable via `open`, with a backdrop) below lg — the common
   * desktop-dock / mobile-sheet pattern. Requires a `relative` ancestor
   * (e.g. `AppShellBody`, which is `relative` by default).
   */
  variant?: "fixed" | "responsive";
  /** Called when the overlay backdrop is clicked or Escape is pressed. Only relevant when floating (responsive, below lg). */
  onOpenChange?: (open: boolean) => void;
  /** Initial/uncontrolled width in px. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Controlled width in px — pairs with onWidthChange. */
  width?: number;
  onWidthChange?: (width: number) => void;
  /** Show the drag handle on the right edge, shared with the main content. Defaults to true. Ignored while floating as an overlay. */
  resizable?: boolean;
  workspaces?: WorkspaceSwitcherProps["workspaces"];
  activeWorkspace?: string;
  onWorkspaceChange?: WorkspaceSwitcherProps["onChange"];
  onCreateWorkspace?: WorkspaceSwitcherProps["onCreate"];
  groups: NavGroupData[];
  footerItems?: NavItemData[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

const KEYBOARD_STEP = 16;

/** Closes an overlay panel on Escape while it is open. */
function useEscapeToClose(active: boolean, onClose?: (open: boolean) => void) {
  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, onClose]);
}

/** The collapsible, labeled, resizable second layer of a two-layer side nav (pairs with IconRail). */
function NavSidebar({
  open = true,
  variant = "fixed",
  onOpenChange,
  defaultWidth = 260,
  minWidth = 200,
  maxWidth = 420,
  width: controlledWidth,
  onWidthChange,
  resizable = true,
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCreateWorkspace,
  groups,
  footerItems,
  activeId,
  onSelect,
  className,
}: NavSidebarProps) {
  // responsive: lg+ docks inline, below lg floats as an overlay sheet whose
  // visibility is the `open` prop.
  const isLarge = useLargeViewport();
  const isOverlay = variant === "responsive" && !isLarge;
  useEscapeToClose(isOverlay && open, onOpenChange);

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
      setWidth(clamp(startWidth + (moveEvent.clientX - startX)));
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
    setWidth(clamp(width + (event.key === "ArrowRight" ? KEYBOARD_STEP : -KEYBOARD_STEP)));
  };

  const resizeHandle = resizable && open && !isOverlay ? (
    <div
      data-slot="nav-sidebar-resize-handle"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      className="absolute inset-y-0 right-0 z-10 w-1.5 translate-x-1/2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:right-1/2 after:w-px after:bg-transparent after:transition-colors hover:after:bg-ion-deep focus-visible:after:bg-ion-deep"
      onPointerDown={startResize}
      onKeyDown={resizeWithKeyboard}
    />
  ) : null;

  const body = (
    <div className="flex h-full flex-col p-3" style={isOverlay ? undefined : { width }}>
      {workspaces?.length && activeWorkspace ? (
        <div className="px-0 pb-4">
          <WorkspaceSwitcher workspaces={workspaces} value={activeWorkspace} onChange={onWorkspaceChange} onCreate={onCreateWorkspace} />
        </div>
      ) : null}

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, index) => (
          <NavSection key={group.heading ?? index} group={group} activeId={activeId} onSelect={onSelect} />
        ))}
      </div>

      {footerItems?.length ? (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-outline/50 pt-4">
          {footerItems.map((item) => (
            <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );

  if (isOverlay) {
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
        <div
          data-slot="nav-sidebar"
          data-mode="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            "absolute inset-y-0 left-0 z-40 h-full overflow-hidden border-r border-outline/50 bg-card transition-transform duration-300 ease-in-out",
            open ? "translate-x-0" : "-translate-x-full",
            className,
          )}
          style={{ width }}
        >
          {body}
        </div>
      </>
    );
  }

  return (
    <div
      data-slot="nav-sidebar"
      aria-hidden={!open}
      className={cn("relative h-full shrink-0 overflow-hidden border-r border-outline/50 bg-card/50 transition-[width,opacity] duration-300 ease-in-out", className)}
      style={{ width: open ? width : 0, opacity: open ? 1 : 0 }}
    >
      {resizeHandle}
      {body}
    </div>
  );
}

export { NavSidebar };
