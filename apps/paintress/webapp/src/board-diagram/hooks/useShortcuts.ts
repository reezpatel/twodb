import { useEffect, useRef } from "react";

export interface ShortcutActions {
  undo(): void;
  redo(): void;
  remove(): void;
  duplicate(): void;
  copy(): void;
  paste(): void;
  fit(): void;
  selectTool(): void;
  handTool(): void;
  addSticky(): void;
  addText(): void;
  addRectangle(): void;
  addEllipse(): void;
  addGroup(): void;
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/** Business hook: Miro-style keyboard shortcuts (ignored while typing in a field). */
export function useShortcuts(actions: ShortcutActions) {
  const a = useRef(actions);
  a.current = actions;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod) {
        if (k === "z") (e.preventDefault(), e.shiftKey ? a.current.redo() : a.current.undo());
        else if (k === "y") (e.preventDefault(), a.current.redo());
        else if (k === "d") (e.preventDefault(), a.current.duplicate());
        else if (k === "c") a.current.copy();
        else if (k === "v") a.current.paste();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") return void (e.preventDefault(), a.current.remove());
      const map: Record<string, () => void> = {
        v: a.current.selectTool,
        h: a.current.handTool,
        n: a.current.addSticky,
        t: a.current.addText,
        r: a.current.addRectangle,
        o: a.current.addEllipse,
        g: a.current.addGroup,
        f: a.current.fit,
      };
      if (map[k] && !e.altKey) (e.preventDefault(), map[k]!());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
