import * as React from "react";
import { cn } from "@/lib/utils";
import { NavSection, NavItem, type NavGroupData, type NavItemData } from "./nav-item";
import { WorkspaceSwitcher, type WorkspaceSwitcherProps } from "./workspace-switcher";

export interface NavSidebarProps {
  /** Controls the collapse animation; the sidebar stays mounted, just clips to 0 width. */
  open?: boolean;
  /** Initial/uncontrolled width in px. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Controlled width in px — pairs with onWidthChange. */
  width?: number;
  onWidthChange?: (width: number) => void;
  /** Show the drag handle on the right edge, shared with the main content. Defaults to true. */
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

/** The collapsible, labeled, resizable second layer of a two-layer side nav (pairs with IconRail). */
function NavSidebar({
  open = true,
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

  return (
    <div
      data-slot="nav-sidebar"
      aria-hidden={!open}
      className={cn("relative h-full shrink-0 overflow-hidden border-r border-outline bg-stone transition-[width,opacity] duration-200 ease-out", className)}
      style={{ width: open ? width : 0, opacity: open ? 1 : 0 }}
    >
      {resizable && open ? (
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
      ) : null}

      <div className="flex h-full flex-col p-2" style={{ width }}>
        {workspaces && activeWorkspace ? (
          <div className="px-0 pb-2">
            <WorkspaceSwitcher workspaces={workspaces} value={activeWorkspace} onChange={onWorkspaceChange} onCreate={onCreateWorkspace} />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group, index) => (
            <NavSection key={group.heading ?? index} group={group} activeId={activeId} onSelect={onSelect} />
          ))}
        </div>

        {footerItems?.length ? (
          <div className="mt-auto flex flex-col gap-0.5 border-t border-outline pt-2">
            {footerItems.map((item) => (
              <NavItem key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { NavSidebar };
