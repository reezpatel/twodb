import { useState } from "react";
import { Outlet } from "react-router";
import { AppShell, AppShellBody, AppShellContent, AppShellHeader, AppShellMain, NavSidebar, NavSidebarToggle } from "@twodb/blocks";
import { Download, LogOut, Moon, Sun } from "lucide-react";
import { useShellNav } from "./useShellNav";
import { useSidebarToggle } from "../../lib/useSidebarToggle";
import { useInstallPrompt } from "../../lib/useInstallPrompt";
import { HeaderSlotContext } from "../../lib/header-slot";
import { getTheme, setTheme } from "../../lib/theme";
import { authClient } from "../../lib/auth-client";

/** Responsive chrome (nav docked on lg+, sheet below) + a header row that pages fill via `PageHeader`. Same layout as Toolkit. */
export function Shell() {
  const { groups, activeId, onSelect } = useShellNav();
  const { data: session } = authClient.useSession();
  const { open: navOpen, toggle: toggleNav, setOpen: setNavOpen, overlay: navOverlay } = useSidebarToggle("twopager.nav-open");
  const install = useInstallPrompt();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [dark, setDark] = useState(() => (getTheme() === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : getTheme() === "dark"));
  const toggleTheme = () => { const next = dark ? "light" : "dark"; setTheme(next); setDark(!dark); };
  const onInstall = async () => {
    if ((await install.install()) === "manual") alert("To install: use your browser's menu → “Install app” / “Add to Home Screen”.");
  };

  return (
    <AppShell>
      <AppShellBody>
        <NavSidebar
          variant="responsive"
          open={navOpen}
          onOpenChange={setNavOpen}
          groups={groups}
          footerItems={[
            ...(install.visible ? [{ id: "__install", title: "Install app", icon: Download }] : []),
            { id: "__theme", title: dark ? "Light mode" : "Dark mode", icon: dark ? Sun : Moon },
            { id: "__signout", title: "Sign out", icon: LogOut },
          ]}
          activeId={activeId}
          activeWorkspace={session?.user?.name ?? "TwoPager"}
          workspaces={[]}
          onSelect={(id) => {
            if (id === "__theme") return toggleTheme();
            if (id === "__install") return void onInstall();
            if (id === "__signout") return void authClient.signOut();
            onSelect(id);
            if (navOverlay) setNavOpen(false);
          }}
        />
        <AppShellMain>
          <AppShellHeader className="h-12 gap-2 border-b border-outline px-4 sm:gap-3 sm:px-6">
            <NavSidebarToggle open={navOpen} onToggle={toggleNav} aria-label={navOpen ? "Hide navigation" : "Show navigation"} />
            <div ref={setSlot} className="min-w-0 flex-1" />
          </AppShellHeader>
          <AppShellContent>
            <HeaderSlotContext.Provider value={slot}><Outlet /></HeaderSlotContext.Provider>
          </AppShellContent>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  );
}
