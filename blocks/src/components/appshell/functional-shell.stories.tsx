import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Hash,
  Inbox,
  Calendar,
  Activity,
  CreditCard,
  Globe,
  Terminal,
  Blocks,
  Command,
  GitBranch,
  CircleAlert,
  FileCode2,
  FileText,
} from "lucide-react";
import { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent } from "./shell/shell";
import { StatusBar, StatusBarGroup, StatusBarItem } from "./status-bar/status-bar";
import { Tabs, type TabData } from "./tabs/tabs";
import { Sidebar, SidebarHeader, SidebarContent, SidebarSection } from "./sidebar/sidebar";
import { IconRail, IconRailItem, IconRailSpacer } from "./nav/icon-rail";
import { NavSidebar } from "./nav/nav-sidebar";
import { NavSidebarToggle } from "./nav/nav-sidebar-toggle";
import type { NavGroupData, NavItemData } from "./nav/nav-item";
import { Dialog, DialogContent } from "../ui/dialog/dialog";
import { Input } from "../ui/form/input";
import { Chip } from "../ui/chip/chip";

const RAIL_SECTIONS = [
  { id: "home", icon: LayoutDashboard, label: "Home" },
  { id: "inbox", icon: Inbox, label: "Inbox", badge: 12 },
  { id: "analytics", icon: Activity, label: "Analytics" },
];

const NAV_GROUPS: NavGroupData[] = [
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
      {
        id: "team",
        title: "Team",
        icon: Users,
        children: [
          { id: "t-design", title: "Designers", icon: Hash },
          { id: "t-eng", title: "Engineering", icon: Hash },
          { id: "t-product", title: "Product", icon: Hash },
        ],
      },
      {
        id: "customers",
        title: "Customers",
        icon: Globe,
        children: [
          { id: "c-enterprise", title: "Enterprise", icon: Hash },
          { id: "c-smb", title: "SMB", icon: Hash },
        ],
      },
      { id: "finance", title: "Finance", icon: CreditCard },
    ],
  },
  {
    heading: "Developers",
    items: [
      { id: "api", title: "API keys", icon: Terminal },
      { id: "webhooks", title: "Webhooks", icon: Blocks },
    ],
  },
];

const FOOTER_ITEMS: NavItemData[] = [
  { id: "settings", title: "Settings", icon: Settings, shortcut: "⌘," },
  { id: "logout", title: "Log out", icon: LogOut },
];

const meta = {
  title: "Blocks/AppShell/Functional Shell",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A complete, working shell: the icon rail and the collapsible nav sidebar both stretch
 * the full shell height — there's no global header above them. The header lives inside
 * `AppShellMain` instead, scoped to the content pane, alongside a tabbed workspace and a
 * right-docked detail panel. A full-width status bar sits at the very bottom.
 */
export const Default: Story = {
  render: () => {
    const [railActive, setRailActive] = React.useState("home");
    const [navOpen, setNavOpen] = React.useState(true);
    const [activeId, setActiveId] = React.useState("calendar");
    const [workspace, setWorkspace] = React.useState("Acme Corp");
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [tabs, setTabs] = React.useState<TabData[]>([
      { value: "reactor", label: "reactor.ts", attention: "warning", icon: FileCode2 },
      { value: "target", label: "target.ts", attention: "danger", icon: FileCode2 },
      { value: "readme", label: "README.md", icon: FileText },
    ]);
    const [tab, setTab] = React.useState("reactor");

    const closeTab = (value: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.value !== value);
        if (tab === value) setTab(next[0]?.value ?? "");
        return next;
      });
    };

    const addTab = () => {
      const value = `scratch-${tabs.length + 1}`;
      const next = [...tabs, { value, label: `scratch-${tabs.length + 1}.ts`, icon: FileCode2 }];
      setTabs(next);
      setTab(value);
    };

    const handleSelect = (id: string) => {
      if (id === "search") {
        setSearchOpen(true);
        return;
      }
      setActiveId(id);
    };

    return (
      <AppShell style={{ height: 620 }}>
        <AppShellBody>
          <IconRail>
            {RAIL_SECTIONS.map((section) => (
              <IconRailItem
                key={section.id}
                icon={section.icon}
                label={section.label}
                badge={section.badge}
                active={railActive === section.id}
                onClick={() => setRailActive(section.id)}
              />
            ))}
            <IconRailSpacer />
            <IconRailItem icon={Settings} label="Settings" />
          </IconRail>

          <NavSidebar
            open={navOpen}
            workspaces={["Acme Corp", "Personal Workspace", "Client Sandbox"]}
            activeWorkspace={workspace}
            onWorkspaceChange={setWorkspace}
            onCreateWorkspace={() => {}}
            groups={NAV_GROUPS}
            footerItems={FOOTER_ITEMS}
            activeId={activeId}
            onSelect={handleSelect}
          />

          <AppShellMain>
            <Tabs tabs={tabs} activeValue={tab} onChange={setTab} onClose={closeTab} onReorder={setTabs} onAdd={addTab} className="flex-1">
              <div className="flex h-full flex-col">
                <AppShellHeader className="justify-between">
                  <div className="flex items-center gap-2">
                    <NavSidebarToggle open={navOpen} onToggle={() => setNavOpen((o) => !o)} />
                    <span className="text-ink-muted font-normal">{workspace}</span>
                    <span className="text-ink-muted">/</span>
                    <span className="capitalize">{activeId.replace(/-/g, " ")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-outline bg-stone px-3 py-1 text-[13px] text-ink-muted outline-none hover:bg-paper-grid"
                  >
                    <Search className="size-3.5" strokeWidth={1.5} />
                    Search
                    <kbd className="rounded-[4px] border border-outline bg-paper px-1 font-mono text-[10px]">⌘K</kbd>
                  </button>
                </AppShellHeader>

                <AppShellContent>
                  {tabs.length === 0 ? (
                    <p className="text-ink-muted">No tabs open.</p>
                  ) : (
                    <>
                      {tab === "reactor" ? <p>Ion beam source, accelerator and beamline configuration. Unsaved changes (warning dot).</p> : null}
                      {tab === "target" ? <p>Tritium target geometry and cooling loop parameters. Build failed (danger dot).</p> : null}
                      {tab === "readme" ? <p>Project notes and diagram conventions.</p> : null}
                      {!["reactor", "target", "readme"].includes(tab) ? <p>New scratch tab.</p> : null}
                    </>
                  )}
                </AppShellContent>
              </div>
            </Tabs>
          </AppShellMain>

          <Sidebar side="right">
            <SidebarHeader>Legend</SidebarHeader>
            <SidebarContent>
              <SidebarSection title="Zones">
                <Chip zone="ion" selected>
                  Ion beam
                </Chip>
                <Chip zone="tritium">Tritium target</Chip>
                <Chip zone="transmute">Transmutation</Chip>
                <Chip zone="materials">Materials testing</Chip>
              </SidebarSection>
            </SidebarContent>
          </Sidebar>
        </AppShellBody>

        <StatusBar tone="neutral">
          <StatusBarGroup>
            <StatusBarItem icon={<GitBranch />}>main</StatusBarItem>
            <StatusBarItem icon={<CircleAlert />}>0 problems</StatusBarItem>
          </StatusBarGroup>
          <StatusBarGroup>
            <StatusBarItem>All changes saved</StatusBarItem>
          </StatusBarGroup>
        </StatusBar>

        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent showClose={false} className="top-[20%] max-w-xl translate-y-0 p-0">
            <div className="flex items-center gap-3 border-b border-outline px-4">
              <Search className="size-[18px] shrink-0 text-ink-muted" strokeWidth={1.5} />
              <Input
                autoFocus
                placeholder="Search projects, docs, or actions..."
                className="h-auto border-none bg-transparent px-0 py-4 text-[14px] shadow-none outline-none focus-visible:outline-none"
              />
              <kbd className="shrink-0 rounded-[4px] border border-outline bg-stone px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">ESC</kbd>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Command className="size-6 text-ink-muted/50" strokeWidth={1.5} />
              <p className="font-sans text-[13px] font-medium text-ink-muted">Type a command or search…</p>
            </div>
          </DialogContent>
        </Dialog>
      </AppShell>
    );
  },
};
