import { useEffect, useState, type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { useAppShellContext } from "./app-shell-context";

type AppNavigationProps = ComponentProps<"aside"> & {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
};

export function AppNavigation({ defaultWidth = 288, minWidth = 224, maxWidth = 480, className, children, style, ...props }: AppNavigationProps) {
  const { variant, navigationOpen, attachedNavigationVisible, openNavigation, closeNavigation, holdNavigation, releaseNavigation } = useAppShellContext();
  const [width, setWidth] = useState(defaultWidth);
  const [resizing, setResizing] = useState(false);
  const attached = variant === "attached";
  const floating = variant === "floating";

  useEffect(() => {
    if (!navigationOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNavigation();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeNavigation, navigationOpen]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!attached || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) => {
      setWidth(Math.min(maxWidth, Math.max(minWidth, startWidth + moveEvent.clientX - startX)));
    };
    const onPointerUp = () => {
      setResizing(false);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  return (
    <>
      {floating ? (
        <div
          data-slot="app-shell-navigation-edge-trigger"
          className="fixed inset-y-12 left-0 z-40 hidden w-[30px] lg:block"
          onMouseEnter={openNavigation}
          aria-hidden="true"
        />
      ) : null}

      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={navigationOpen && !floating ? 0 : -1}
        onClick={closeNavigation}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          navigationOpen ? "opacity-100" : "pointer-events-none opacity-0",
          attached && "lg:hidden",
          floating && "lg:hidden",
        )}
      />

      <aside
        data-slot="app-shell-navigation"
        data-state={navigationOpen ? "open" : "closed"}
        className={cn(
          "bg-card safe-top safe-bottom fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-none shrink-0 flex-col md:w-72 md:max-w-[85vw] border-r shadow-xl transition-transform duration-200 ease-out",
          navigationOpen ? "translate-x-0" : "-translate-x-full",
          attached && "lg:relative lg:z-auto lg:h-full lg:max-w-none lg:translate-x-0 lg:shadow-none",
          attached && !resizing && "lg:transition-[width,visibility] lg:duration-200",
          attached && resizing && "lg:transition-none",
          attached && attachedNavigationVisible && "lg:visible lg:w-(--app-navigation-width)",
          attached && !attachedNavigationVisible && "lg:pointer-events-none lg:invisible lg:w-0 lg:overflow-clip lg:border-r-0",
          !attached && "lg:top-12",
          !navigationOpen && !attached && "pointer-events-none",
          className,
        )}
        onMouseEnter={() => floating && holdNavigation()}
        onMouseLeave={() => floating && releaseNavigation()}
        style={{ "--app-navigation-width": `${width}px`, ...style } as CSSProperties}
        {...props}
      >
        {/*<div className={cn("flex h-12 shrink-0 items-center justify-end border-b px-2", attached && "lg:hidden")}>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeNavigation}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <X className="size-4" />
          </button>
        </div>*/}
        <div
          data-slot="app-shell-navigation-content"
          className="flex min-h-0 flex-1 [&>:first-child]:shrink-0 [&>:last-child]:min-w-0 [&>:last-child]:flex-1 [&>:last-child]:overflow-clip"
        >
          {children}
        </div>
        {attached && attachedNavigationVisible ? (
          <div
            data-slot="app-shell-navigation-resize-handle"
            role="separator"
            aria-label="Resize side navigation"
            aria-orientation="vertical"
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth}
            aria-valuenow={width}
            tabIndex={0}
            className="after:bg-border hover:after:bg-ring focus-visible:after:bg-ring absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors lg:block"
            onPointerDown={startResize}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const delta = event.key === "ArrowLeft" ? -16 : 16;
              setWidth((current) => Math.min(maxWidth, Math.max(minWidth, current + delta)));
            }}
          />
        ) : null}
      </aside>
    </>
  );
}
