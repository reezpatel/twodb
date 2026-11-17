import { Download, LogOut, Plug, Server, TerminalSquare, Wrench } from "lucide-react";
import type { ReactNode } from "react";
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
import type { ConnectorInstance, McpServer } from "../lib/toolkit-client.js";

export interface ShellChromeProps {
  instances: ConnectorInstance[];
  mcpServers: McpServer[];
  activeId: string;
  onSelect: (id: string) => void;
  userName: string;
  onSignOut: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  onToggleNav: () => void;
  /** Page title + actions, rendered in the header row. */
  header: ReactNode;
  children: ReactNode;
}

/** Dumb chrome — responsive nav (docked on lg+, sheet below) + the shared app header. Overview pages, one entry per
 * connector instance and per MCP server; Install + Sign out live in the footer. */
export function ShellChrome(props: ShellChromeProps) {
  const groups: NavGroupData[] = [
    {
      heading: "Overview",
      items: [
        { id: "connectors", title: "Connectors", icon: Plug },
        { id: "mcp", title: "MCP servers", icon: Server },
        { id: "twodb", title: "TwoDB tools", icon: TerminalSquare },
      ],
    },
    ...(props.instances.length > 0
      ? [{ heading: "Instances", items: props.instances.map((i) => ({ id: `instance:${i.id}`, title: i.name, icon: Plug })) }]
      : []),
    ...(props.mcpServers.length > 0
      ? [{ heading: "MCP", items: props.mcpServers.map((s) => ({ id: `mcp:${s.id}`, title: s.name, icon: Wrench })) }]
      : []),
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
            { id: "logout", title: "Sign out", icon: LogOut },
          ]}
          activeId={props.activeId}
          onSelect={(id) => {
            if (id === "logout") return props.onSignOut();
            if (id === "install") return props.onInstall?.();
            props.onSelect(id);
          }}
          workspaces={[]}
          activeWorkspace={props.userName || "Toolkit"}
        />
        <AppShellMain>
          <AppShellHeader className="h-12 gap-2 border-b border-outline px-4 sm:gap-3 sm:px-6">
            <NavSidebarToggle open={props.navOpen} onToggle={props.onToggleNav} aria-label={props.navOpen ? "Hide navigation" : "Show navigation"} />
            <div className="min-w-0 flex-1">{props.header}</div>
          </AppShellHeader>
          <AppShellContent>{props.children}</AppShellContent>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  );
}
