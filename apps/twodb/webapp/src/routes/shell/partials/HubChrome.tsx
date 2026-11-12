import { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent, NavSidebar, type NavGroupData, type NavItemData } from "@twodb/blocks";
import { KeyRound, LayoutGrid, LogOut, Boxes } from "lucide-react";
import { NavSidebarToggle } from "@twodb/blocks";
import type { ReactNode } from "react";
import type { Crumb } from "../hooks/useBreadcrumbs.js";
import { Breadcrumbs } from "./Breadcrumbs.js";

export interface HubChromeProps {
  activeId: string;
  navOpen: boolean;
  onToggleNav: () => void;
  onNavSelect: (id: string) => void;
  userEmail: string;
  userName: string;
  crumbs: Crumb[];
  children: ReactNode;
}

/** Dumb chrome only — composes blocks' AppShell + NavSidebar; state lives in useHubShell(). */
export function HubChrome(props: HubChromeProps) {
  const groups: NavGroupData[] = [
    {
      heading: "Platform",
      items: [
        { id: "apps", title: "Apps", icon: LayoutGrid },
        { id: "keys", title: "API keys", icon: KeyRound },
        { id: "spaces", title: "Spaces", icon: Boxes },
      ],
    },
  ];

  const footerItems: NavItemData[] = [{ id: "logout", title: "Sign out", icon: LogOut }];

  return (
    <AppShell>
      <AppShellBody>
        <NavSidebar
          groups={groups}
          footerItems={footerItems}
          activeId={props.activeId}
          onSelect={props.onNavSelect}
          open={props.navOpen}
          workspaces={[]}
          activeWorkspace={props.userName || "TwoDB"}
        />
        <AppShellMain>
          <AppShellHeader className="h-12 gap-3 border-b border-outline px-6 text-sm font-normal">
            <NavSidebarToggle open={props.navOpen} onToggle={props.onToggleNav} aria-label={props.navOpen ? "Hide navigation" : "Show navigation"} />
            <Breadcrumbs crumbs={props.crumbs} />
          </AppShellHeader>
          <AppShellContent>{props.children}</AppShellContent>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  );
}
