import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolDock } from "../board-diagram/ToolDock";
import type { Tool } from "../board-diagram/hooks/useBoardDiagram";
import type { ArmedSpec } from "../board-diagram/hooks/usePlacement";
import { noop } from "./fixtures";

const meta = {
  title: "Diagram/ToolDock",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

function DockDemo({ tool: initialTool = "select" as Tool, armed = null as ArmedSpec | null }) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const [spec, setSpec] = useState<ArmedSpec | null>(armed);
  return (
    <div className="relative" style={{ width: "100vw", height: "100vh", background: "var(--paper)" }}>
      <ToolDock tool={tool} onTool={setTool} armed={spec} arm={setSpec} addImage={() => {}} disabled={false} />
    </div>
  );
}

/** The left-edge pill: pointer/hand toggle, quick shapes, flyouts. Click around. */
export const Interactive: StoryObj = { render: () => <DockDemo /> };
export const HandTool: StoryObj = { render: () => <DockDemo tool="hand" /> };
export const NoteArmed: StoryObj = { render: () => <DockDemo armed={{ kind: "sticky", color: "#fbcfe8" }} /> };
export const DrawToolActive: StoryObj = { render: () => <DockDemo tool="pen" /> };

export const ReadOnly: StoryObj = {
  render: () => (
    <div className="relative" style={{ width: "100vw", height: "100vh", background: "var(--paper)" }}>
      <ToolDock tool="select" onTool={noop} armed={null} arm={noop} addImage={noop} disabled />
    </div>
  ),
};
