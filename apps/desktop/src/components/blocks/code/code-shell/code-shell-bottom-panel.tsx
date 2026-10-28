import { useRef, useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { useCodeShellContext } from "./code-shell-context";

const KEYBOARD_STEP = 16;

export function CodeShellBottomPanel({ className, children, style, ...props }: ComponentProps<"section">) {
  const { bottomPanelVisible, bottomPanelHeight, minBottomPanelHeight, maxBottomPanelHeight, reservedMainHeight, onBottomPanelHeightChange } =
    useCodeShellContext();
  const panelRef = useRef<HTMLElement>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  if (!bottomPanelVisible) return null;

  const height = dragHeight ?? bottomPanelHeight;

  const clamp = (value: number) => {
    const available = (panelRef.current?.parentElement?.clientHeight ?? window.innerHeight) - reservedMainHeight;
    const max = Math.max(minBottomPanelHeight, Math.min(maxBottomPanelHeight ?? Infinity, available));
    return Math.min(max, Math.max(minBottomPanelHeight, value));
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    let latest = startHeight;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      latest = clamp(startHeight + startY - moveEvent.clientY);
      setDragHeight(latest);
    };
    const onPointerUp = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setDragHeight(null);
      if (latest !== startHeight) onBottomPanelHeightChange?.(latest);
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const next = clamp(height + (event.key === "ArrowUp" ? KEYBOARD_STEP : -KEYBOARD_STEP));
    if (next !== height) onBottomPanelHeightChange?.(next);
  };

  return (
    <section
      ref={panelRef}
      data-slot="code-shell-bottom-panel"
      className={cn("bg-card relative flex shrink-0 flex-col overflow-hidden border-t", className)}
      style={{ height, minHeight: minBottomPanelHeight, maxHeight: `calc(100% - ${reservedMainHeight}px)`, ...style } as CSSProperties}
      {...props}
    >
      <div
        data-slot="code-shell-bottom-panel-resize-handle"
        role="separator"
        aria-label="Resize bottom panel"
        aria-orientation="horizontal"
        aria-valuemin={minBottomPanelHeight}
        aria-valuemax={maxBottomPanelHeight}
        aria-valuenow={height}
        tabIndex={0}
        className="after:bg-border hover:after:bg-ring focus-visible:after:bg-ring absolute inset-x-0 top-0 z-10 h-1.5 cursor-row-resize touch-none outline-none after:absolute after:inset-x-0 after:top-0 after:h-px after:transition-colors"
        onPointerDown={startResize}
        onKeyDown={resizeWithKeyboard}
      />
      {children}
    </section>
  );
}
