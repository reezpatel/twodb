import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowLeftRight, Bell, LogOut, Boxes, Calendar, LayoutDashboard, Mail, Settings } from "lucide-react";
import { AppShell } from "./app-shell";
import type { AppShellVariant } from "./app-shell-context";
import { AppShellBody } from "./app-shell-body";
import { AppShellContent } from "./app-shell-content";
import { AppShellWorkspace } from "./app-shell-workspace";
import { AppSideNavigation } from "./app-side-navigation";
import { AppNavigation } from "./app-navigation";
import { SimpleHeader } from "./simple-header";
import { FooterBar } from "../footer/footer-bar";
import { FooterWidget } from "../footer/footer-widget";
import { NavRail } from "../nav-rail/nav-rail";
import { NavRailItem } from "../nav-rail/nav-rail-item";
import { NavRailSeparator } from "../nav-rail/nav-rail-separator";
import { NavRailSpacer } from "../nav-rail/nav-rail-spacer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavRailUser } from "../nav-rail/nav-rail-user";

const meta = {
  title: "Blocks/App Shell/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function ShellPreview({ variant }: { variant: AppShellVariant }) {
  return (
    <AppShell variant={variant}>
      <SimpleHeader title={`Twodb · ${variant}`} />

      <AppShellBody>
        <AppShellWorkspace>
          <AppNavigation>
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
            <AppSideNavigation className="p-4 text-sm">Side navigation</AppSideNavigation>
          </AppNavigation>

          <AppShellContent>
            <section className="p-6">
              <h1 className="text-lg font-semibold capitalize">{variant} navigation</h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm">
                The primary navigation and app side navigation move together. On mobile, every variant uses the hamburger-triggered sliding drawer. Floating
                mode also opens when the pointer enters the leftmost 30 pixels or hovers over the hamburger button.
              </p>
            </section>
          </AppShellContent>
        </AppShellWorkspace>
      </AppShellBody>

      <FooterBar>
        <FooterWidget aria-label="Spaces" icon={<Boxes />}>
          All spaces
        </FooterWidget>
      </FooterBar>
    </AppShell>
  );
}

export const Attached: Story = {
  render: () => <ShellPreview variant="attached" />,
};

export const Floating: Story = {
  render: () => <ShellPreview variant="floating" />,
};

export const Sliding: Story = {
  render: () => <ShellPreview variant="sliding" />,
};
