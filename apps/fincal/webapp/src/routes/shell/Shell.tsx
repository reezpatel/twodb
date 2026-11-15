import { useState } from "react";
import { Outlet, useNavigate, useParams, useLocation } from "react-router";
import { Moon, Sun } from "lucide-react";
import { AppShell, AppShellBody, AppShellContent, AppShellHeader, AppShellMain, NavSidebar, NavSidebarToggle } from "@twodb/blocks";
import { useShellNav } from "./useShellNav";
import { useSidebarToggle } from "../../lib/useSidebarToggle";
import { getTheme, setTheme } from "../../lib/theme";
import { authClient } from "../../lib/auth-client";
import { useSpaces } from "../../lib/queries";
import { selectCls } from "../../components/Ui";

export function Shell() {
  const { groups, activeId, onSelect } = useShellNav();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { spaceId } = useParams();
  const { data: spaces = [] } = useSpaces();
  const { data: session } = authClient.useSession();
  const { open: navOpen, toggle: toggleNav } = useSidebarToggle("fincal.nav-open");
  const [dark, setDark] = useState(() => (getTheme() === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : getTheme() === "dark"));
  const toggleTheme = () => { const next = dark ? "light" : "dark"; setTheme(next); setDark(!dark); };
  const section = pathname.split("/")[3] ?? "overview";

  return (
    <AppShell>
      <AppShellBody>
        <NavSidebar
          open={navOpen}
          groups={groups}
          footerItems={[{ id: "__theme", title: dark ? "Light mode" : "Dark mode", icon: dark ? Sun : Moon }, { id: "__signout", title: "Sign out" }]}
          activeId={activeId}
          activeWorkspace={session?.user?.name ?? "Fincal"}
          workspaces={[]}
          onSelect={(id) => (id === "__theme" ? toggleTheme() : id === "__signout" ? void authClient.signOut() : onSelect(id))}
        />
        <AppShellMain>
          <AppShellHeader className="h-12 gap-3 border-b border-outline px-6 text-sm">
            <NavSidebarToggle open={navOpen} onToggle={toggleNav} aria-label={navOpen ? "Hide navigation" : "Show navigation"} />
            {spaceId ? (
              <select className={`${selectCls} !w-auto`} value={spaceId} onChange={(e) => { localStorage.setItem("fincal.space", e.target.value); nav(`/s/${e.target.value}/${section}`); }} aria-label="Space">
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : null}
          </AppShellHeader>
          <AppShellContent><Outlet /></AppShellContent>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  );
}
