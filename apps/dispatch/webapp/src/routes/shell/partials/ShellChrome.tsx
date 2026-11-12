import { ListTree, Cpu, ScrollText, Boxes, Gauge, KeyRound } from "lucide-react";
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
  navOpen: boolean;
  onToggleNav: () => void;
  header: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

/** Dumb chrome — nav (Runners, Jobs, Microvms + one entry per VM) + the
 * shared app header, both stateless. */
export function ShellChrome(props: ShellChromeProps) {
  const groups: NavGroupData[] = [
    {
      heading: "Dispatch",
      items: [
        { id: "runners", title: "Runners", icon: Cpu },
        { id: "jobs", title: "Jobs", icon: ScrollText },
        { id: "enroll", title: "Enroll tokens", icon: KeyRound },
      ],
    },
    {
      heading: "Microvms",
      items: [
        { id: "microvms", title: "All microvms", icon: Boxes },
        ...props.microvms.map((vm) => ({ id: `microvms:${vm.identifier}`, title: vm.identifier, icon: Gauge })),
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
          activeWorkspace={props.userName || "Dispatch"}
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
