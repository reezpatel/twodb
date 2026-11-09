import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CanvasSidebar } from "./canvas-sidebar";

const meta = {
  title: "Blocks/AICode/CanvasSidebar",
  component: CanvasSidebar,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof CanvasSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { open: true, title: "Preview", width: 400, children: null },
  render: (args) => (
    <div className="flex h-80 bg-stone">
      <div className="flex-1 p-4 text-ink-muted">Main chat area.</div>
      <CanvasSidebar {...args}>
        <div className="rounded-[8px] border border-outline bg-stone p-4 font-mono text-[12px] text-ink">
          <p># Isometric Lab</p>
          <p className="mt-2 text-muted-foreground">A rendered preview of the artifact goes here.</p>
        </div>
      </CanvasSidebar>
    </div>
  ),
};

export const Collapsible: Story = {
  args: { open: true, title: "Preview", width: 400, children: null },
  render: (args) => {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex h-80 bg-stone">
        <div className="flex flex-1 flex-col gap-2 p-4">
          <button type="button" onClick={() => setOpen((o) => !o)} className="w-fit rounded-[6px] border border-outline bg-paper px-2 py-1 text-[12px] text-ink">
            Toggle canvas
          </button>
          <div className="text-ink-muted">Main chat area.</div>
        </div>
        <CanvasSidebar {...args} open={open} onClose={() => setOpen(false)}>
          <div className="rounded-[8px] border border-outline bg-stone p-4 font-mono text-[12px] text-ink">
            <p># Isometric Lab</p>
          </div>
        </CanvasSidebar>
      </div>
    );
  },
};
