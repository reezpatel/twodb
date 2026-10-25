import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Archive, Bot, Check, CodeXml, MessageSquare, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideNav, SideNavContent } from "./side-nav";
import { SideNavHeader } from "./side-nav-header";
import { SideNavTab, SideNavTabs } from "./side-nav-tabs";
import { NavSection, NavSectionAction, NavSectionActions, NavSectionContent, NavSectionHeader, NavSectionInput, NavSectionTitle } from "./nav-section";
import { NavItem, NavItemActions, NavItemLabel, NavItemMeta, type NavItemStatus } from "./nav-item";
import { NavEmptyState } from "./nav-empty-state";
import { NavFooter } from "./nav-footer";
import { NavFooterItem } from "./nav-footer-item";

const meta = {
  title: "Blocks/Side Nav/SideNav",
  component: SideNav,
  parameters: { layout: "centered" },
} satisfies Meta<typeof SideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

const TABS = [
  { name: "Code", icon: <CodeXml /> },
  { name: "Assistant", icon: <MessageSquare /> },
  { name: "Collabs", icon: <Users /> },
];
const SECTIONS = [
  { name: "twodb", items: ["Fix runner build", "Sidebar blocks", "Storybook setup"] },
  { name: "docs", items: ["Write onboarding"] },
];

function Preview() {
  const [tab, setTab] = useState("Code");
  const [selected, setSelected] = useState("Sidebar blocks");
  const [archive, setArchive] = useState(false);

  return (
    <div className="bg-card h-[32rem] w-72 border">
      <SideNav>
        <SideNavHeader title="Sessions">
          <Button variant="ghost" size="icon-sm">
            <Plus />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <Search />
          </Button>
        </SideNavHeader>
        <SideNavTabs>
          {TABS.map((t) => (
            <SideNavTab key={t.name} icon={t.icon} label={t.name} active={tab === t.name} onClick={() => setTab(t.name)} />
          ))}
        </SideNavTabs>
        <SideNavContent>
          {SECTIONS.map((section) => (
            <NavSection key={section.name} collapsible>
              <NavSectionHeader>
                <NavSectionTitle>{section.name}</NavSectionTitle>
                <NavSectionActions>
                  <NavSectionAction title="New session">
                    <Plus />
                  </NavSectionAction>
                </NavSectionActions>
              </NavSectionHeader>
              <NavSectionContent>
                {section.items.map((item) => (
                  <NavItem key={item} active={selected === item} onClick={() => setSelected(item)}>
                    <NavItemLabel>{item}</NavItemLabel>
                    <NavItemMeta>2h</NavItemMeta>
                    <NavItemActions>
                      <button type="button" title="Options" onClick={(event) => event.stopPropagation()}>
                        <MoreHorizontal />
                      </button>
                    </NavItemActions>
                  </NavItem>
                ))}
              </NavSectionContent>
            </NavSection>
          ))}
        </SideNavContent>
        <NavFooter>
          <NavFooterItem icon={<Archive />} active={archive} onClick={() => setArchive((value) => !value)}>
            Archive
            {archive ? <Check className="ml-auto" /> : null}
          </NavFooterItem>
          <NavFooterItem disabled>Skills &amp; tools</NavFooterItem>
        </NavFooter>
      </SideNav>
    </div>
  );
}

function RenamePreview() {
  const [editing, setEditing] = useState(false);
  return (
    <div className="bg-card w-72 border">
      <NavSection>
        <NavSectionHeader data-testid="header">
          {editing ? (
            <NavSectionInput autoFocus aria-label="Name" defaultValue="twodb" onBlur={() => setEditing(false)} />
          ) : (
            <NavSectionTitle>twodb</NavSectionTitle>
          )}
          {editing ? null : (
            <NavSectionActions>
              <NavSectionAction title="Rename" onClick={() => setEditing(true)}>
                <Plus />
              </NavSectionAction>
            </NavSectionActions>
          )}
        </NavSectionHeader>
      </NavSection>
    </div>
  );
}

export const Renaming: Story = {
  render: () => <RenamePreview />,
};

const STATUSES: { status: NavItemStatus; label: string }[] = [
  { status: "none", label: "No status" },
  { status: "running", label: "Running" },
  { status: "completed", label: "Completed" },
  { status: "need-attention", label: "Needs attention" },
];

export const Statuses: Story = {
  render: () => (
    <div className="bg-card w-72 border py-2">
      {STATUSES.map(({ status, label }) => (
        <NavItem key={status} status={status}>
          <NavItemLabel>{label}</NavItemLabel>
          <NavItemMeta>{status}</NavItemMeta>
        </NavItem>
      ))}
    </div>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <div className="bg-card w-72 border">
      <NavEmptyState icon={<Bot />} title="No personas yet" description="Personas are reusable agents with their own instructions and work directory.">
        <Button size="sm" variant="outline">
          <Plus /> Create persona
        </Button>
      </NavEmptyState>
    </div>
  ),
};

export const Default: Story = {
  render: () => <Preview />,
};
