import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sidebar, SidebarHeader, SidebarContent, SidebarSection } from "./sidebar";
import { Button } from "../../ui/button/button";
import { Chip } from "../../ui/chip/chip";

const meta = {
  title: "Blocks/AppShell/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  argTypes: {
    side: { control: "select", options: ["left", "right"] },
    mode: { control: "select", options: ["push", "overlay"] },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: () => (
    <div className="flex h-[480px] bg-paper">
      <div className="flex-1 p-4 text-ink-muted">Main content — the sidebar docks to the right. Drag its left edge to resize.</div>
      <Sidebar side="right">
        <SidebarHeader>Legend</SidebarHeader>
        <SidebarContent>
          <SidebarSection title="Zones">
            <Chip zone="ion" selected>
              Ion beam
            </Chip>
            <Chip zone="tritium">Tritium target</Chip>
            <Chip zone="transmute">Transmutation</Chip>
            <Chip zone="materials">Materials testing</Chip>
          </SidebarSection>
        </SidebarContent>
      </Sidebar>
    </div>
  ),
};

export const Left: Story = {
  render: () => (
    <div className="flex h-[480px] bg-paper">
      <Sidebar side="left">
        <SidebarHeader>Explorer</SidebarHeader>
        <SidebarContent>
          <SidebarSection title="Files">
            <div className="px-1 text-[13px] text-ink">reactor.ts</div>
            <div className="px-1 text-[13px] text-ink">target.ts</div>
            <div className="px-1 text-[13px] text-ink">README.md</div>
          </SidebarSection>
        </SidebarContent>
      </Sidebar>
      <div className="flex-1 p-4 text-ink-muted">Main content — the sidebar docks to the left. Drag its right edge to resize.</div>
    </div>
  ),
};

export const BothSides: Story = {
  render: () => (
    <div className="flex h-[480px] bg-paper">
      <Sidebar side="left" defaultWidth={220}>
        <SidebarHeader>Explorer</SidebarHeader>
        <SidebarContent>
          <SidebarSection title="Files">
            <div className="px-1 text-[13px] text-ink">reactor.ts</div>
            <div className="px-1 text-[13px] text-ink">target.ts</div>
          </SidebarSection>
        </SidebarContent>
      </Sidebar>
      <div className="flex-1 p-4 text-ink-muted">Main content between two docked sidebars.</div>
      <Sidebar side="right">
        <SidebarHeader>Legend</SidebarHeader>
        <SidebarContent>
          <SidebarSection title="Zones">
            <Chip zone="ion" selected>
              Ion beam
            </Chip>
            <Chip zone="tritium">Tritium target</Chip>
          </SidebarSection>
        </SidebarContent>
      </Sidebar>
    </div>
  ),
};

export const NotResizable: Story = {
  render: () => (
    <div className="flex h-[360px] bg-paper">
      <div className="flex-1 p-4 text-ink-muted">Fixed-width sidebar, no drag handle.</div>
      <Sidebar side="right" resizable={false} defaultWidth={240}>
        <SidebarHeader>Details</SidebarHeader>
        <SidebarContent>
          <p className="px-1 text-[13px] text-ink-muted">Cross-section, 1:20</p>
        </SidebarContent>
      </Sidebar>
    </div>
  ),
};

/** "push" mode (the default) sits inline and shrinks the main content when toggled closed. */
export const PushMode: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex h-[420px] bg-paper">
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Button size="sm" className="self-start" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Open"} panel
          </Button>
          <p className="text-ink-muted">Main content reflows to fill the space as the panel collapses — no overlap, no backdrop.</p>
        </div>
        <Sidebar side="right" mode="push" open={open}>
          <SidebarHeader>Details</SidebarHeader>
          <SidebarContent>
            <p className="px-1 text-[13px] text-ink-muted">Cross-section, 1:20</p>
          </SidebarContent>
        </Sidebar>
      </div>
    );
  },
};

/** "overlay" mode floats above the content with a backdrop, leaving the main content's width untouched. */
export const OverlayMode: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div className="relative flex h-[420px] overflow-hidden bg-paper">
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Button size="sm" className="self-start" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Open"} panel
          </Button>
          <p className="text-ink-muted">The panel floats above this content with a backdrop; click the backdrop (or close it) to dismiss.</p>
        </div>
        <Sidebar side="right" mode="overlay" open={open} onOpenChange={setOpen}>
          <SidebarHeader>Details</SidebarHeader>
          <SidebarContent>
            <p className="px-1 text-[13px] text-ink-muted">Cross-section, 1:20</p>
          </SidebarContent>
        </Sidebar>
      </div>
    );
  },
};
