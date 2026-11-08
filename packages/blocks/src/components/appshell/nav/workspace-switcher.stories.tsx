import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkspaceSwitcher } from "./workspace-switcher";

const meta = {
  title: "Blocks/AppShell/Nav/WorkspaceSwitcher",
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = React.useState("Acme Corp");
    return (
      <div className="w-64 bg-paper p-2">
        <WorkspaceSwitcher workspaces={["Acme Corp", "Personal Workspace", "Client Sandbox"]} value={value} onChange={setValue} onCreate={() => {}} />
      </div>
    );
  },
};
