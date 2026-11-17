import { useState } from "react";

export type SettingsTabId = "instruction" | "chat" | "app";

/** Business hook for the settings dialog: which page is showing (remembered between opens). */
export function useSettingsNav() {
  const [tab, setTabState] = useState<SettingsTabId>(() => (["chat", "app"].includes(localStorage.getItem("artisan.settings.tab") ?? "") ? (localStorage.getItem("artisan.settings.tab") as SettingsTabId) : "instruction"));
  const setTab = (t: SettingsTabId) => {
    setTabState(t);
    localStorage.setItem("artisan.settings.tab", t);
  };
  return { tab, setTab };
}
