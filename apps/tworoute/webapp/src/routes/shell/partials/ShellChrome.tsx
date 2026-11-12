import { LayoutDashboard, ListTree, Plug } from "lucide-react";
import {
  AppShell,
  AppShellBody,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  NavSidebar,
  NavSidebarToggle,
  type NavGroupData,
} from "@twodb/blocks";
import type { ReactNode } from "react";
import type { Connection } from "../../../lib/tworoute-client.js";

export interface ShellChromeProps {
  connections: Connection[];
  activeId: string;
  onSelect: (id: string) => void;
  userName: string;
  onSignOut: () => void;
  navOpen: boolean;
  onToggleNav: () => void;
  header: ReactNode;
  /** Optional right-docked panel (connection detail) — sits beside
   * AppShellMain inside AppShellBody so it reaches the shell's right edge. */
  sidebar?: ReactNode;
  children: ReactNode;
}

/** Dumb chrome — nav (Dashboard, one entry per connection, Manage last) +
 * the shared app header, both stateless. */
export function ShellChrome(props: ShellChromeProps) {
  const groups: NavGroupData[] = [
    {
      heading: "Overview",
      items: [{ id: "dashboard", title: "Dashboard", icon: LayoutDashboard }],
    },
    {
      heading: "Connections",
      items: [
        ...props.connections.map((c) => ({ id: c.name, title: c.name, icon: Plug })),
      ],
    },
  ];

  return (
    <AppShell>
      <AppShellBody>
        <NavSidebar
          open={props.navOpen}
          groups={groups}
          footerItems={[{ id: "logout", title: "Sign out", icon: ListTree }]}
          activeId={props.activeId}
          onSelect={(id) => (id === "logout" ? props.onSignOut() : props.onSelect(id))}
          workspaces={[]}
          activeWorkspace={props.userName || "TwoRoute"}
        />
        <AppShellMain>
          <AppShellHeader className="h-12 gap-3 border-b border-outline px-6">
            <NavSidebarToggle open={props.navOpen} onToggle={props.onToggleNav} aria-label={props.navOpen ? "Hide navigation" : "Show navigation"} />
            <div className="min-w-0 flex-1">{props.header}</div>
          </AppShellHeader>
          <AppShellContent>{props.children}</AppShellContent>
        </AppShellMain>
        {props.sidebar}
      </AppShellBody>
    </AppShell>
  );
}
