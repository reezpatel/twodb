import { useEffect, useState } from "react";

function read(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Business hook: is the app in dark mode? Follows `data-theme` on <html> when
 * set explicitly, otherwise the OS preference (same rule as blocks/styles.css).
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(read());
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);
  return dark;
}
