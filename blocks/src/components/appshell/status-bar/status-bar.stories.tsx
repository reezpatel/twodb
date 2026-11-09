import type { Meta, StoryObj } from "@storybook/react-vite";
import { GitBranch, CircleAlert, Bell, Wifi } from "lucide-react";
import { StatusBar, StatusBarGroup, StatusBarItem } from "./status-bar";

const meta = {
  title: "Blocks/AppShell/StatusBar",
  component: StatusBar,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  argTypes: {
    tone: { control: "select", options: ["accent", "neutral"] },
  },
} satisfies Meta<typeof StatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = {
  args: { tone: "accent" },
  render: (args) => (
    <StatusBar {...args}>
      <StatusBarGroup>
        <StatusBarItem icon={<GitBranch />}>main</StatusBarItem>
        <StatusBarItem icon={<CircleAlert />}>0 problems</StatusBarItem>
      </StatusBarGroup>
      <StatusBarGroup>
        <StatusBarItem icon={<Wifi />}>Connected</StatusBarItem>
        <StatusBarItem icon={<Bell />} />
      </StatusBarGroup>
    </StatusBar>
  ),
};

export const Neutral: Story = {
  args: { tone: "neutral" },
  render: (args) => (
    <StatusBar {...args}>
      <StatusBarGroup>
        <StatusBarItem icon={<GitBranch />}>main</StatusBarItem>
      </StatusBarGroup>
      <StatusBarGroup>
        <StatusBarItem>UTF-8</StatusBarItem>
        <StatusBarItem>Ln 12, Col 4</StatusBarItem>
      </StatusBarGroup>
    </StatusBar>
  ),
};
