import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { AppShellContext, type AppShellVariant } from "./app-shell-context";

type AppShellProps = ComponentProps<"div"> & {
  variant?: AppShellVariant;
};

export function AppShell({ variant = "attached", className, children, ...props }: AppShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [attachedNavigationVisible, setAttachedNavigationVisible] = useState(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdNavigation = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const openNavigation = useCallback(() => {
    holdNavigation();
    setNavigationOpen(true);
  }, [holdNavigation]);
  const closeNavigation = useCallback(() => {
    holdNavigation();
    setNavigationOpen(false);
  }, [holdNavigation]);
  const releaseNavigation = useCallback(() => {
    if (variant !== "floating") return;
    holdNavigation();
    closeTimer.current = setTimeout(() => setNavigationOpen(false), 150);
  }, [holdNavigation, variant]);
  const toggleAttachedNavigation = useCallback(() => setAttachedNavigationVisible((visible) => !visible), []);

  useEffect(() => () => holdNavigation(), [holdNavigation]);
  useEffect(() => closeNavigation(), [closeNavigation, variant]);
  useEffect(() => {
    if (variant === "floating") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || (!event.metaKey && !event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (!window.matchMedia("(min-width: 64rem)").matches) return;
      event.preventDefault();
      if (variant === "attached") {
        toggleAttachedNavigation();
      } else {
        setNavigationOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleAttachedNavigation, variant]);

  const context = useMemo(
    () => ({
      variant,
      navigationOpen,
      attachedNavigationVisible,
      openNavigation,
      closeNavigation,
      holdNavigation,
      releaseNavigation,
      toggleAttachedNavigation,
    }),
    [attachedNavigationVisible, closeNavigation, holdNavigation, navigationOpen, openNavigation, releaseNavigation, toggleAttachedNavigation, variant],
  );

  return (
    <AppShellContext.Provider value={context}>
      <div
        data-slot="app-shell"
        data-variant={variant}
        className={cn("bg-background safe-top safe-bottom flex h-screen flex-col overflow-clip", className)}
        {...props}
      >
        {children}
      </div>
    </AppShellContext.Provider>
  );
}
