import { Download, LayoutDashboard, ListTree, Plug } from "lucide-react";
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
  /** PWA: show the nav's Install item (app not installed yet). */
  canInstall?: boolean;
  /** PWA: Install item tapped (native prompt when offered, else manual hint). */
  onInstall?: () => void;
  navOpen: boolean;
  onToggleNav: () => void;
  /** Overlay sheet visibility changes (backdrop click / Escape below lg). */
  onNavOpenChange: (open: boolean) => void;
  header: ReactNode;
  /** Optional right-docked panel (connection detail) — sits beside
   * AppShellMain inside AppShellBody so it reaches the shell's right edge. */
  sidebar?: ReactNode;
  children: ReactNode;
}

/** Dumb chrome — nav (Dashboard, one entry per connection, Manage last) +
 * the shared app header, both stateless. The nav docks inline on lg+ and
 * floats as a backdrop sheet below lg. */
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
          variant="responsive"
          open={props.navOpen}
          onOpenChange={props.onNavOpenChange}
          groups={groups}
          footerItems={[
            ...(props.canInstall ? [{ id: "install", title: "Install app", icon: Download }] : []),
            { id: "logout", title: "Sign out", icon: ListTree },
          ]}
          activeId={props.activeId}
          onSelect={(id) => {
            if (id === "logout") return props.onSignOut();
            if (id === "install") return props.onInstall?.();
            props.onSelect(id);
          }}
          workspaces={[]}
          activeWorkspace={props.userName || "TwoRoute"}
        />
        <AppShellMain>
          <AppShellHeader className="h-14 gap-2 border-b border-outline px-4 sm:gap-3 sm:px-6">
            <NavSidebarToggle open={props.navOpen} onToggle={props.onToggleNav} aria-label={props.navOpen ? "Hide navigation" : "Show navigation"} />
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">{props.header}</div>
          </AppShellHeader>
          <AppShellContent>{props.children}</AppShellContent>
        </AppShellMain>
        {props.sidebar}
      </AppShellBody>
    </AppShell>
  );
}
