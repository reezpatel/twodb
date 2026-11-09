import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderKanban, Hash, Calendar, Users } from "lucide-react";
import { NavSection, type NavGroupData } from "./nav-item";

const meta = {
  title: "Blocks/AppShell/Nav/NavSection",
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const group: NavGroupData = {
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
      badge: 8,
      children: [
        { id: "t-design", title: "Designers", icon: Hash },
        { id: "t-eng", title: "Engineering", icon: Hash },
      ],
    },
  ],
};

export const Default: Story = {
  render: () => {
    const [active, setActive] = React.useState("calendar");
    return (
      <div className="w-64 bg-paper p-3">
        <NavSection group={group} activeId={active} onSelect={setActive} />
      </div>
    );
  },
};
