import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderKanban, Hash, Calendar, Users, Settings, LogOut, LayoutDashboard, Inbox } from "lucide-react";
import { NavSidebar } from "./nav-sidebar";
import { NavSidebarToggle } from "./nav-sidebar-toggle";
import type { NavGroupData, NavItemData } from "./nav-item";

const groups: NavGroupData[] = [
  {
    items: [
      { id: "home", title: "Home", icon: LayoutDashboard },
      { id: "inbox", title: "Inbox", icon: Inbox, badge: 12 },
    ],
  },
  {
    heading: "Workspace",
    items: [
      {
        id: "projects",
        title: "Projects",
        icon: FolderKanban,
        children: [
          { id: "p-active", title: "Active", icon: Hash },
          { id: "p-archived", title: "Archived", icon: Hash },
        ],
      },
      { id: "calendar", title: "Calendar", icon: Calendar },
      { id: "team", title: "Team", icon: Users },
    ],
  },
];

const footerItems: NavItemData[] = [
  { id: "settings", title: "Settings", icon: Settings, shortcut: "⌘," },
  { id: "logout", title: "Log out", icon: LogOut },
];

const meta = {
  title: "Blocks/AppShell/Nav/NavSidebar",
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [activeId, setActiveId] = React.useState("home");
    const [workspace, setWorkspace] = React.useState("Acme Corp");
    return (
      <div className="flex h-[480px] bg-paper">
        <NavSidebar
          workspaces={["Acme Corp", "Personal Workspace", "Client Sandbox"]}
          activeWorkspace={workspace}
          onWorkspaceChange={setWorkspace}
          onCreateWorkspace={() => {}}
          groups={groups}
          footerItems={footerItems}
          activeId={activeId}
          onSelect={setActiveId}
        />
        <div className="flex-1 p-4 text-ink-muted">Main content. Drag the sidebar's right edge to resize it.</div>
      </div>
    );
  },
};

export const NotResizable: Story = {
  render: () => {
    const [activeId, setActiveId] = React.useState("home");
    return (
      <div className="flex h-[480px] bg-paper">
        <NavSidebar resizable={false} defaultWidth={240} groups={groups} footerItems={footerItems} activeId={activeId} onSelect={setActiveId} />
        <div className="flex-1 p-4 text-ink-muted">Fixed-width nav sidebar, no drag handle.</div>
      </div>
    );
  },
};

export const Collapsible: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true);
    const [activeId, setActiveId] = React.useState("home");
    return (
      <div className="flex h-[480px] flex-col bg-paper">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-outline px-2">
          <NavSidebarToggle open={open} onToggle={() => setOpen((o) => !o)} />
          <span className="font-sans text-[13px] font-medium text-ink">Toggle the nav sidebar</span>
        </div>
        <div className="flex min-h-0 flex-1">
          <NavSidebar open={open} groups={groups} footerItems={footerItems} activeId={activeId} onSelect={setActiveId} />
          <div className="flex-1 p-4 text-ink-muted">Main content. Collapsing slides the sidebar to 0 width.</div>
        </div>
      </div>
    );
  },
};
