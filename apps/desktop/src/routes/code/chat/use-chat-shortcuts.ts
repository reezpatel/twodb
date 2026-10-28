import { useEffect, useRef } from "react";
import { isMacPlatform } from "@/lib/shortcut-keys";

interface ChatShortcutHandlers {
  tabs: (() => void)[];
  togglePanel: () => void;
}

/** Mod+1…N selects a header tab; Mod+Alt+B toggles the right panel. Mod is ⌘ on macOS, Ctrl elsewhere. */
export function useChatShortcuts(handlers: ChatShortcutHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const mac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if ((mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) || event.shiftKey) return;

      if (event.altKey) {
        if (event.code !== "KeyB") return;
        event.preventDefault();
        latest.current.togglePanel();
        return;
      }

      const select = latest.current.tabs[Number(event.key) - 1];
      if (!select || !/^[1-9]$/.test(event.key)) return;
      event.preventDefault();
      select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
