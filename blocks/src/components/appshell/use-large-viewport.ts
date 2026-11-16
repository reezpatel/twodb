import * as React from "react";

/** lg breakpoint of the default blocks/Tailwind theme (1024px). */
export const LARGE_VIEWPORT_QUERY = "(min-width: 1024px)";

/** SSR-safe live viewport test — false below lg, true on lg+. */
export function isLargeViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(LARGE_VIEWPORT_QUERY).matches;
}

/**
 * Re-renders when the viewport crosses the lg breakpoint, so shell panels
 * (Sidebar, NavSidebar) can swap between docked (push) and floating
 * (overlay/sheet) behavior without remounting.
 */
export function useLargeViewport(): boolean {
  const [large, setLarge] = React.useState(isLargeViewport);
  React.useEffect(() => {
    const mql = window.matchMedia(LARGE_VIEWPORT_QUERY);
    const onChange = () => setLarge(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return large;
}
