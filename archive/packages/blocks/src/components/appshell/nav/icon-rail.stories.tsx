import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutDashboard, Inbox, Activity, Settings } from "lucide-react";
import { IconRail, IconRailItem, IconRailSpacer } from "./icon-rail";

const meta = {
  title: "Blocks/AppShell/Nav/IconRail",
  component: IconRail,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof IconRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [active, setActive] = React.useState("home");
    return (
      <div className="h-96 bg-paper">
        <IconRail>
          <IconRailItem icon={LayoutDashboard} label="Home" active={active === "home"} onClick={() => setActive("home")} />
          <IconRailItem icon={Inbox} label="Inbox" badge={12} active={active === "inbox"} onClick={() => setActive("inbox")} />
          <IconRailItem icon={Activity} label="Analytics" active={active === "analytics"} onClick={() => setActive("analytics")} />
          <IconRailSpacer />
          <IconRailItem icon={Settings} label="Settings" active={active === "settings"} onClick={() => setActive("settings")} />
        </IconRail>
      </div>
    );
  },
};
