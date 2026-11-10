import {
  AppShell,
  AppShellBody,
  AppShellMain,
  AppShellContent,
  NavSidebar,
  type NavGroupData,
  type NavItemData,
} from "@twodb/blocks";
import { Compass, LayoutGrid, LogOut } from "lucide-react";
import type { ReactNode } from "react";

export interface HubChromeProps {
  activeId: string;
  onNavSelect: (id: string) => void;
  userEmail: string;
  userName: string;
  children: ReactNode;
}

/** Dumb chrome only — composes blocks' AppShell + NavSidebar; state lives in useHubShell(). */
export function HubChrome(props: HubChromeProps) {
  const groups: NavGroupData[] = [
    {
      heading: "Platform",
      items: [
        { id: "explorer", title: "Gateway explorer", icon: Compass },
        { id: "apps", title: "Apps", icon: LayoutGrid },
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
          workspaces={props.userName ? [props.userName] : []}
          activeWorkspace={props.userName || "TwoDB"}
        />
        <AppShellMain>
          <AppShellContent>{props.children}</AppShellContent>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  );
}
