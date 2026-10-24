import { useCallback, useEffect, useState } from "react";

/**
 * Theme preference: "system" follows the browser/OS `prefers-color-scheme`
 * and is the default; "light" and "dark" force that theme.
 *
 * Dark mode is class-based (see index.css): the resolved theme is applied
 * by toggling `.dark` on <html>. The preference is stored in localStorage
 * so it survives reloads, and an inline script in index.html applies it
 * before first paint to avoid a flash of the wrong theme.
 */

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "twodb.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable (private mode etc.) — fall through to default.
  }
  return "system";
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures — the theme still applies for this session.
  }
  applyResolvedTheme();
}

/** Resolve "system" against the current browser preference. */
function resolve(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Toggle `.dark` on <html> based on the stored preference. */
export function applyResolvedTheme() {
  const resolved = resolve(getThemePreference());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  // Keep the PWA chrome color in sync with the resolved theme.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#111111" : "#f7f5f2");
}

/**
 * React hook for the theme preference. Returns the stored preference (not
 * the resolved theme) plus a setter that persists it. When the preference
 * is "system", changes to the browser theme are followed live.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemePreference(next);
    setPreference(next);
  }, []);

  useEffect(() => {
    applyResolvedTheme();
    if (preference !== "system") return;

    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => applyResolvedTheme();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preference]);

  return { preference, setTheme };
}