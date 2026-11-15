import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Canvas } from "../svg-canvas/Canvas";
import type { ItemMap } from "../lib/item-store";
import { WithDiagram, noop, sampleItems } from "./fixtures";

const meta = {
  title: "Canvas/Canvas",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

function Playground({ initial }: { initial: ItemMap }) {
  const [selection, setSelection] = useState<string[]>([]);
  return (
    <WithDiagram>
      <div style={{ width: "100vw", height: "100vh" }}>
        <Canvas
          items={initial}
          canEdit
          tool="select"
          armed={null}
          penColor="#4f63ad"
          flash={new Set()}
          selection={selection}
          setSelection={setSelection}
          fitSignal={0}
          cmd={{ moveEnded: noop, resizeEnded: noop, connect: noop, createAt: noop, drawEnded: noop, eraseHit: noop }}
        />
      </div>
    </WithDiagram>
  );
}

/** The whole engine: pan (wheel / Space-drag), zoom (Ctrl+wheel), click to select, drag to move — against no-op commands. */
export const Board: StoryObj = {
  render: () => <Playground initial={sampleItems()} />,
};

export const Preselected: StoryObj = {
  render: () => {
    const [selection, setSelection] = useState<string[]>(["n1"]);
    return (
      <WithDiagram>
        <div style={{ width: "100vw", height: "100vh" }}>
          <Canvas
            items={sampleItems()}
            canEdit
            tool="select"
            armed={null}
            penColor="#4f63ad"
            flash={new Set()}
            selection={selection}
            setSelection={setSelection}
            fitSignal={0}
            cmd={{ moveEnded: noop, resizeEnded: noop, connect: noop, createAt: noop, drawEnded: noop, eraseHit: noop }}
          />
        </div>
      </WithDiagram>
    );
  },
};
