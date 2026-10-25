import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowLeftRight, Bell, LogOut, Calendar, LayoutDashboard, Mail, Settings } from "lucide-react";
import { NavRail } from "./nav-rail";
import { NavRailItem } from "./nav-rail-item";
import { NavRailSeparator } from "./nav-rail-separator";
import { NavRailSpacer } from "./nav-rail-spacer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavRailUser } from "./nav-rail-user";

const meta = {
  title: "Blocks/Nav Rail/NavRail",
  component: NavRail,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof NavRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="h-96 overflow-clip border">
      <NavRail>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <NavRailUser name="Ada Lovelace" email="ada@example.com" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm font-medium">Ada Lovelace</span>
              <span className="text-muted-foreground text-xs font-normal">ada@example.com</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <ArrowLeftRight />
              Switch organization
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <NavRailSeparator />
        <NavRailItem label="Notifications" icon={<Bell />} />
        <NavRailItem label="Overview" icon={<LayoutDashboard />} active />
        <NavRailItem label="Email" icon={<Mail />} />
        <NavRailItem label="Calendar" icon={<Calendar />} />
        <NavRailSpacer />
        <NavRailItem label="Settings" icon={<Settings />} />
      </NavRail>
    </div>
  ),
};
