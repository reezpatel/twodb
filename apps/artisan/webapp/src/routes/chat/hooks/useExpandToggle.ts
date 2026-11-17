import { useCallback, useEffect, useState } from "react";

export const TOGGLE_EXPAND_EVENT = "artisan:toggle-expand";
export const EXPAND_STATE_EVENT = "artisan:expand-state";

/** Fire the app-wide "expand / collapse all thinking + tool blocks" toggle (ChatView owns the state). */
export function toggleExpand() {
  window.dispatchEvent(new CustomEvent(TOGGLE_EXPAND_EVENT));
}

/** Tell listeners (header button) whether blocks are currently force-expanded. */
export function announceExpandState(expanded: boolean) {
  window.dispatchEvent(new CustomEvent(EXPAND_STATE_EVENT, { detail: expanded }));
}

/** Business hook for a toggle button: mirrors ChatView's expand state and triggers the toggle. */
export function useExpandToggle() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const onState = (e: Event) => setExpanded(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EXPAND_STATE_EVENT, onState);
    return () => window.removeEventListener(EXPAND_STATE_EVENT, onState);
  }, []);
  return { expanded, toggle: useCallback(toggleExpand, []) };
}

/** True when the key event came from somewhere the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']") !== null;
}
