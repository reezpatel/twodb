import { useEffect } from "react";
import type { CalendarSceneState } from "./use-calendar-scene";

/** Google Calendar keys: c create, d/x/w/m/y/a views, t today, j/n next, k/p previous, / search, e edit, Delete, Esc. */
export function useCalendarShortcuts(s: CalendarSceneState) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, [contenteditable=true], [role=dialog]")) return;
      const map: Record<string, () => void> = {
        c: () => s.openEditor({}),
        d: () => s.setView("day"),
        x: () => s.setView("4day"),
        w: () => s.setView("week"),
        m: () => s.setView("month"),
        y: () => s.setView("year"),
        a: () => s.setView("agenda"),
        t: s.goToday,
        j: s.next,
        n: s.next,
        k: s.prev,
        p: s.prev,
        "/": () => s.setPanel("search"),
        e: () => s.selected && s.openEditor({ eventId: s.selected.eventId, occurrence: s.selected }),
        Escape: () => s.setSelected(null),
      };
      const run = map[e.key];
      if (run) {
        e.preventDefault();
        run();
      } else if ((e.key === "Delete" || e.key === "Backspace") && s.selected) {
        e.preventDefault();
        const o = s.selected;
        s.withScope(o, "Delete", (scope) => s.removeEvent.mutate({ occurrence: o, scope }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);
}
