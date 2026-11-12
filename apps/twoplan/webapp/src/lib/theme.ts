export type Theme = "light" | "dark" | "system";
const KEY = "twoplan.theme";
export const getTheme = (): Theme => (localStorage.getItem(KEY) as Theme) || "system";
export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  applyStoredTheme();
}
export function applyStoredTheme() {
  const t = getTheme();
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}
