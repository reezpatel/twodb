import { useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { useCodeShellContext } from "./code-shell-context";

const KEYBOARD_STEP = 16;

export function CodeShellSidebar({ className, children, style, ...props }: ComponentProps<"aside">) {
  const { sidebarVisible, sidebarWidth, minSidebarWidth, maxSidebarWidth, reservedMainWidth, onSidebarWidthChange } = useCodeShellContext();
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  if (!sidebarVisible) return null;

  const currentMax = () => Math.max(minSidebarWidth, Math.min(maxSidebarWidth ?? Infinity, window.innerWidth - reservedMainWidth));
  const clamp = (value: number) => Math.min(currentMax(), Math.max(minSidebarWidth, value));
  const width = clamp(dragWidth ?? sidebarWidth);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    let latest = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      latest = clamp(startWidth + startX - moveEvent.clientX);
      setDragWidth(latest);
    };
    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setDragWidth(null);
      if (latest !== startWidth) onSidebarWidthChange?.(latest);
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = clamp(width + (event.key === "ArrowLeft" ? KEYBOARD_STEP : -KEYBOARD_STEP));
    if (next !== width) onSidebarWidthChange?.(next);
  };

  return (
    <aside
      data-slot="code-shell-sidebar"
      className={cn(
        "bg-card fixed inset-y-0 right-0 z-40 flex h-full w-[90%] max-w-[900px] shrink-0 flex-col overflow-hidden border-l shadow-xl",
        "xl:relative xl:inset-auto xl:z-auto xl:w-(--code-shell-sidebar-width) xl:max-w-[calc(100vw-var(--code-shell-reserved-main-width))] xl:shadow-none",
        className,
      )}
      style={{ "--code-shell-sidebar-width": `${width}px`, "--code-shell-reserved-main-width": `${reservedMainWidth}px`, ...style } as CSSProperties}
      {...props}
    >
      <div
        data-slot="code-shell-sidebar-resize-handle"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={minSidebarWidth}
        aria-valuemax={currentMax()}
        aria-valuenow={width}
        tabIndex={0}
        className="after:bg-border hover:after:bg-ring focus-visible:after:bg-ring absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-0 after:w-px after:transition-colors xl:block"
        onPointerDown={startResize}
        onKeyDown={resizeWithKeyboard}
      />
      {children}
    </aside>
  );
}
