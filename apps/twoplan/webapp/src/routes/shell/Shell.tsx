import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { Moon, Search, Sun } from "lucide-react";
import { AppShell, AppShellBody, AppShellContent, AppShellMain, NavSidebar } from "@twodb/blocks";
import { useShellNav } from "./useShellNav";
import { CommandPalette } from "./CommandPalette";
import { getTheme, setTheme } from "../../lib/theme";
import { authClient } from "../../lib/auth-client";

export function Shell() {
  const { groups, activeId, onSelect } = useShellNav();
  const nav = useNavigate();
  const { data: session } = authClient.useSession();
  const [palette, setPalette] = useState(false);
  const [dark, setDark] = useState(() => (getTheme() === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : getTheme() === "dark"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => { const next = dark ? "light" : "dark"; setTheme(next); setDark(!dark); };

  return (
    <AppShell>
      <AppShellBody>
        <NavSidebar
          groups={[{ items: [{ id: "__search", title: "Search", icon: Search, shortcut: "⌘K" }] }, ...groups]}
          footerItems={[{ id: "__theme", title: dark ? "Light mode" : "Dark mode", icon: dark ? Sun : Moon }, { id: "__signout", title: "Sign out" }]}
          activeId={activeId}
          activeWorkspace={session?.user?.name ?? "TwoPlan"}
          workspaces={[]}
          onSelect={(id) => (id === "__search" ? setPalette(true) : id === "__theme" ? toggleTheme() : id === "__signout" ? void authClient.signOut() : onSelect(id))}
        />
        <AppShellMain>
          <AppShellContent><Outlet /></AppShellContent>
        </AppShellMain>
      </AppShellBody>
      <CommandPalette open={palette} onOpenChange={setPalette} onGo={(path) => { setPalette(false); nav(path); }} />
    </AppShell>
  );
}
