import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Square, Workflow } from "lucide-react";
import { DockButton } from "../board-diagram/partials/DockButton";
import { DockFlyout } from "../board-diagram/partials/DockFlyout";
import { DrawFlyout } from "../board-diagram/partials/DrawFlyout";
import { NotesFlyout } from "../board-diagram/partials/NotesFlyout";
import { OthersFlyout } from "../board-diagram/partials/OthersFlyout";
import { ShapeGrid } from "../board-diagram/partials/ShapeGrid";
import { GroupList } from "../board-diagram/partials/GroupList";
import { IconGrid } from "../board-diagram/partials/IconGrid";
import { PaletteItem } from "../board-diagram/partials/PaletteItem";
import { Toolbar } from "../board-diagram/partials/Toolbar";
import { Toast } from "../board-diagram/partials/Toast";
import { ColorSwatches } from "../board-diagram/partials/ColorSwatches";
import { Field, CommitInput, Select } from "../board-diagram/partials/Field";
import { InlineText } from "../board-diagram/partials/InlineText";
import { noop } from "./fixtures";

const meta = {
  title: "Diagram/Dock & chrome",
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;

export const DockButtons: StoryObj = {
  render: () => (
    <div className="flex gap-2 rounded-2xl border border-outline bg-popover p-2">
      <DockButton title="Default" onClick={noop}>
        <Square className="size-4" />
      </DockButton>
      <DockButton title="Active" active onClick={noop}>
        <Square className="size-4" />
      </DockButton>
      <DockButton title="Has flyout" flyout onClick={noop}>
        <Workflow className="size-4" />
      </DockButton>
      <DockButton title="Disabled" disabled onClick={noop}>
        <Square className="size-4" />
      </DockButton>
    </div>
  ),
};

export const NotesPanel: StoryObj = {
  render: () => (
    <DockFlyout title="Sticky notes">
      <NotesFlyout armed={{ kind: "sticky", color: "#bfdbfe" }} onArm={noop} />
    </DockFlyout>
  ),
};

export const DrawPanel: StoryObj = {
  render: () => (
    <DockFlyout title="Draw">
      <DrawFlyout tool="highlighter" onPick={noop} />
    </DockFlyout>
  ),
};

export const OthersPanel: StoryObj = {
  render: () => (
    <DockFlyout title="More">
      <OthersFlyout armed={null} onArm={noop} addImage={noop} />
    </DockFlyout>
  ),
};

export const ShapesPanel: StoryObj = {
  render: () => (
    <DockFlyout title="Shapes" wide>
      <ShapeGrid pack="basic" onPack={noop} packs={["basic", "bpmn", "c4"] as const} exclude={["basic:rectangle", "basic:ellipse"]} armed={null} onArm={noop} />
    </DockFlyout>
  ),
};

export const FlowchartPanel: StoryObj = {
  render: () => (
    <DockFlyout title="Flowchart">
      <ShapeGrid pack="flowchart" onPack={noop} packs={["flowchart"] as const} armed={null} onArm={noop} />
    </DockFlyout>
  ),
};

export const FramesPanel: StoryObj = {
  render: () => (
    <DockFlyout title="Frames">
      <GroupList armed={{ kind: "group", style: "aws-vpc" }} onArm={noop} />
    </DockFlyout>
  ),
};

export const StickersPanel: StoryObj = {
  render: () => (
    <DockFlyout title="Stickers" wide>
      <IconGrid query="" onQuery={noop} set={undefined} onSet={noop} icons={[]} searching={false} armed={null} onArm={noop} />
    </DockFlyout>
  ),
};

export const PaletteCell: StoryObj = {
  render: () => (
    <div className="grid w-48 grid-cols-2 gap-1">
      <PaletteItem title="Rectangle" label="Rectangle" payload={{ kind: "shape" }} onClick={noop}>
        <Square className="size-6 text-ink-muted" />
      </PaletteItem>
      <PaletteItem title="Rectangle (armed)" label="Armed" payload={{ kind: "shape" }} active onClick={noop}>
        <Square className="size-6 text-ink-muted" />
      </PaletteItem>
    </div>
  ),
};

export const TopToolbar: StoryObj = {
  render: () => (
    <div className="relative h-24 w-[480px]">
      <Toolbar canUndo canRedo={false} undoLabel="Add rectangle" onUndo={noop} onRedo={noop} onTidy={noop} onFit={noop} disabled={false} />
    </div>
  ),
};

export const AgentToast: StoryObj = {
  render: () => (
    <div className="relative h-24 w-[480px]">
      <Toast message="AI added 3 nodes to the board" onDismiss={noop} />
    </div>
  ),
};

export const Swatches: StoryObj = {
  render: () => <ColorSwatches value="#bfdbfe" onPick={noop} allowClear />,
};

export const FormFields: StoryObj = {
  render: () => (
    <div className="flex w-56 flex-col gap-3 rounded-md border border-outline bg-popover p-3">
      <Field label="Label">
        <CommitInput value="API gateway" onCommit={noop} />
      </Field>
      <Field label="Routing">
        <Select value="orthogonal" options={[["orthogonal", "Orthogonal"], ["straight", "Straight"], ["bezier", "Bezier"]]} onChange={noop} />
      </Field>
    </div>
  ),
};

export const InlineEditor: StoryObj = {
  render: () => (
    <div className="flex h-24 w-56 items-center justify-center rounded-md border border-outline bg-paper">
      <InlineText value="Double-clicked text" onCommit={noop} onCancel={noop} style={{ width: 140, height: 40, fontSize: 13 }} />
    </div>
  ),
};

export const DrawFlyoutInteractive: StoryObj = {
  render: function DrawDemo() {
    const [tool, setTool] = useState<"pen" | "highlighter" | "eraser">("pen");
    return (
      <DockFlyout title="Draw">
        <DrawFlyout tool={tool} onPick={setTool} />
      </DockFlyout>
    );
  },
};
