import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Bell, Bot, Database, Download, Palette, Server, Settings, Type, Users } from "lucide-react";
import { AppNav } from "./app-nav";
import { AppNavLink } from "./app-nav-link";
import { AppNavLinkFolder } from "./app-nav-link-folder";
import { AppNavLinks } from "./app-nav-links";
import { AppNavFileTree } from "./app-nav-file-tree";
import { PAGES, PROJECTS } from "./app-nav-file-tree.fixtures";

const meta = {
  title: "Blocks/App Nav/AppNav",
  component: AppNav,
  parameters: { layout: "centered" },
  args: { defaultSelectedId: "announcement" },
  decorators: [
    (Story) => (
      <div className="bg-card w-60 rounded-lg py-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppNav>;

export default meta;
type Story = StoryObj<typeof meta>;

function Sections() {
  return (
    <>
      <AppNavLinks title="Getting Started">
        <AppNavLink id="installation" label="Installation" icon={Download} />
      </AppNavLinks>

      <AppNavLinks title="Foundations">
        <AppNavLink id="color" label="Color" icon={Palette} />
        <AppNavLink id="typography" label="Typography" icon={Type} />
      </AppNavLinks>

      <AppNavLinks title="Base">
        <AppNavLink id="announcement" label="Announcement" />
        <AppNavLink id="avatar" label="Avatar" />
        <AppNavLinkFolder id="buttons" label="Buttons">
          <AppNavLink id="button" label="Button" />
          <AppNavLink id="button-group" label="Button Group" />
          <AppNavLink id="icon-button" label="Icon Button" />
        </AppNavLinkFolder>
        <AppNavLink id="carousel" label="Carousel" badge="New" />
        <AppNavLinkFolder id="forms" label="Form Controls" defaultExpanded>
          <AppNavLink id="input" label="Input" />
          <AppNavLink id="input-otp" label="Input OTP" badge="New" />
          <AppNavLink id="radio" label="Radio" />
        </AppNavLinkFolder>
        <AppNavLink id="pagination" label="Pagination" />
      </AppNavLinks>
    </>
  );
}

/** Branch line follows the selected link. Click around, expand a folder, collapse a section. */
export const Default: Story = {
  render: (args) => (
    <AppNav {...args}>
      <Sections />
    </AppNav>
  ),
};

/** A sliding pill marks the selection instead of the line. */
export const Pill: Story = {
  args: { variant: "pill" },
  render: (args) => (
    <AppNav {...args}>
      <Sections />
    </AppNav>
  ),
};

export const CustomActiveColor: Story = {
  args: { activeColor: "text-orange-600 dark:text-orange-500" },
  render: (args) => (
    <AppNav {...args}>
      <Sections />
    </AppNav>
  ),
};

/** The parent owns the selection. */
export const Controlled: Story = {
  render: () => {
    const [selected, setSelected] = useState("avatar");
    return (
      <div className="flex flex-col gap-2">
        <AppNav selectedId={selected} onSelect={setSelected}>
          <Sections />
        </AppNav>
        <p className="text-muted-foreground px-3 pb-1 font-mono text-xs">selected: {selected}</p>
      </div>
    );
  },
};

/** Settings-style nav: icons on every link, one section collapsed, one link disabled. */
export const SettingsLike: Story = {
  args: { defaultSelectedId: "general" },
  render: (args) => (
    <AppNav {...args}>
      <AppNavLinks title="Account">
        <AppNavLink id="general" label="General" icon={Settings} />
        <AppNavLink id="notifications" label="Notifications" icon={Bell} />
        <AppNavLink id="teams" label="Teams" icon={Users} disabled />
      </AppNavLinks>
      <AppNavLinks title="Workspace">
        <AppNavLink id="agents" label="Agents" icon={Bot} />
        <AppNavLink id="runners" label="Runners" icon={Server} badge="Beta" />
        <AppNavLink id="storage" label="Storage" icon={Database} />
      </AppNavLinks>
      <AppNavLinks title="Advanced" defaultExpanded={false}>
        <AppNavLink id="logs" label="Logs" />
      </AppNavLinks>
    </AppNav>
  ),
};

/** Links and file trees side by side in one nav. */
export const WithFileTrees: Story = {
  args: { defaultSelectedId: "p-roadmap" },
  render: (args) => (
    <AppNav {...args}>
      <AppNavLinks title="Quick links">
        <AppNavLink id="inbox" label="Inbox" />
        <AppNavLink id="today" label="Today" />
      </AppNavLinks>
      <AppNavFileTree title="Pages" nodes={PAGES} />
      <AppNavFileTree title="Projects" nodes={PROJECTS} />
    </AppNav>
  ),
};
