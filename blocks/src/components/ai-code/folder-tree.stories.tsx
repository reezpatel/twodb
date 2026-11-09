import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderTree, type FolderNode } from "./folder-tree";

const meta = {
  title: "Blocks/AICode/FolderTree",
  component: FolderTree,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof FolderTree>;

export default meta;
type Story = StoryObj<typeof meta>;

const NODES: FolderNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "components",
        type: "folder",
        children: [
          {
            name: "appshell",
            type: "folder",
            children: [
              { name: "shell", type: "folder", children: [{ name: "shell.tsx", type: "file" }] },
              { name: "tabs", type: "folder", children: [{ name: "tabs.tsx", type: "file" }, { name: "tabs.stories.tsx", type: "file" }] },
              { name: "status-bar", type: "folder", children: [{ name: "status-bar.tsx", type: "file" }] },
            ],
          },
          { name: "ui", type: "folder", children: [{ name: "button.tsx", type: "file" }, { name: "chip.tsx", type: "file" }] },
        ],
      },
      { name: "styles", type: "folder", children: [{ name: "index.css", type: "file" }] },
    ],
  },
  { name: "THEME.MD", type: "file" },
  { name: "package.json", type: "file" },
];

export const Default: Story = {
  args: { nodes: NODES },
  render: (args) => (
    <div className="w-[320px] p-6">
      <FolderTree {...args} />
    </div>
  ),
};

export const WithSelection: Story = {
  args: { nodes: NODES },
  render: (args) => {
    const [selected, setSelected] = React.useState<string | undefined>("src/components/appshell/tabs/tabs.tsx");
    return (
      <div className="w-[320px] p-6">
        <FolderTree {...args} selected={selected} onSelect={setSelected} />
      </div>
    );
  },
};
