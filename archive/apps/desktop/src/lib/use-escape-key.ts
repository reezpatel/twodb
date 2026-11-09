import { useEffect, useRef } from "react";

/**
 * Calls `onEscape` when Escape is pressed and nothing else claimed it.
 * Radix popovers, dialogs and menus call preventDefault() on Escape while open,
 * so closing one never triggers the handler. Pass `enabled: false` to detach.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const latest = useRef(onEscape);
  latest.current = onEscape;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.repeat) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
