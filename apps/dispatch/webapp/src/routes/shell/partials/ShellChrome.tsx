import { Boxes, Cpu, Download, KeyRound, LayoutDashboard, ListTree, ScrollText } from "lucide-react";
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
import type { Microvm, Runner } from "../../../lib/dispatch-client.js";

export interface ShellChromeProps {
  runners: Runner[];
  microvms: Microvm[];
  activeId: string;
  onSelect: (id: string) => void;
  userName: string;
  onSignOut: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  onToggleNav: () => void;
  header: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

/** Dumb chrome — nav (Dashboard, MicroVMs, Runners section; Jobs, Enrollment keys, Install, Sign out in the footer) + the
 * shared app header, both stateless. */
export function ShellChrome(props: ShellChromeProps) {
  const groups: NavGroupData[] = [
    {
      heading: "Overview",
      items: [
        { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
        { id: "microvms", title: "MicroVMs", icon: Boxes },
      ],
    },
    {
      heading: "Runners",
      items: props.runners.map((r) => ({ id: `runners:${r.name}`, title: r.name, icon: Cpu })),
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
            { id: "jobs", title: "Jobs", icon: ScrollText },
            { id: "enroll", title: "Enrollment keys", icon: KeyRound },
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
          activeWorkspace={props.userName || "Dispatch"}
        />
        <AppShellMain>
          <AppShellHeader className="h-12 gap-2 border-b border-outline px-4 sm:gap-3 sm:px-6">
            <NavSidebarToggle open={props.navOpen} onToggle={props.onToggleNav} aria-label={props.navOpen ? "Hide navigation" : "Show navigation"} />
            <div className="min-w-0 flex-1">{props.header}</div>
          </AppShellHeader>
          <AppShellContent>
            <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">{props.children}</div>
          </AppShellContent>
        </AppShellMain>
        {props.sidebar}
      </AppShellBody>
    </AppShell>
  );
}
