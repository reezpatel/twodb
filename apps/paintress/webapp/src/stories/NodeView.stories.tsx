import type { Meta, StoryObj } from "@storybook/react-vite";
import { NodeView } from "../svg-canvas/partials/NodeView";
import type { Item } from "@shared/model";
import { WithDiagram, item, noop } from "./fixtures";

const meta = {
  title: "Canvas/NodeView",
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;

function Frame(props: { item: Item; w?: number; h?: number; selected?: boolean }) {
  const w = props.w ?? props.item.width;
  const h = props.h ?? props.item.height;
  return (
    <WithDiagram>
      <svg width={w + 90} height={h + 40} style={{ overflow: "visible" }}>
        <g transform="translate(40, 10)">
          <NodeView item={props.item} rect={{ x: 0, y: 0, width: w, height: h }} selected={!!props.selected} hovered={false} dropTarget={false} flash={false} onPointerDown={noop} onClick={noop} />
        </g>
      </svg>
    </WithDiagram>
  );
}

export const Shape: StoryObj = {
  render: () => <Frame item={item({ type: "shape", width: 160, height: 80, data: { pack: "basic", shape: "rounded", text: "API" } })} />,
};

export const ShapeSelected: StoryObj = {
  render: () => <Frame selected item={item({ type: "shape", width: 160, height: 80, data: { pack: "flowchart", shape: "decision", text: "Valid?" } })} />,
};

export const IconCard: StoryObj = {
  render: () => <Frame item={item({ type: "shape", width: 120, height: 100, data: { pack: "basic", shape: "icon-card", text: "lambda", icon: "logos:aws-lambda" } })} />,
};

export const C4Person: StoryObj = {
  render: () => <Frame item={item({ type: "shape", width: 170, height: 120, data: { pack: "c4", shape: "person", text: "Customer" } })} />,
};

export const Sticky: StoryObj = {
  render: () => <Frame item={item({ type: "sticky", width: 160, height: 140, data: { text: "Remember to\ntalk to legal", color: "#fbcfe8" } })} />,
};

export const Text: StoryObj = {
  render: () => <Frame item={item({ type: "text", width: 220, height: 40, data: { text: "A free-floating label", fontSize: 18 } })} />,
};

export const Group: StoryObj = {
  render: () => <Frame item={item({ type: "group", width: 320, height: 200, data: { pack: "aws", kind: "aws-vpc", title: "VPC" } })} />,
};

export const Pool: StoryObj = {
  render: () => <Frame item={item({ type: "pool", width: 360, height: 200, data: { title: "Checkout" } })} />,
};

export const Lane: StoryObj = {
  render: () => <Frame item={item({ type: "lane", width: 360, height: 90, data: { title: "Backend" } })} />,
};

export const Entity: StoryObj = {
  render: () => (
    <Frame
      item={item({
        type: "entity",
        width: 240,
        height: 120,
        data: {
          name: "orders",
          columns: [
            { id: "id", name: "id", type: "uuid", pk: true },
            { id: "user_id", name: "user_id", type: "uuid", fk: { entity: "users", column: "id" } },
            { id: "total", name: "total", type: "numeric" },
          ],
        },
      })}
    />
  ),
};

export const DrawStroke: StoryObj = {
  render: () => (
    <Frame
      item={item({
        type: "draw",
        width: 200,
        height: 90,
        data: { points: [0, 60, 30, 20, 70, 50, 120, 10, 160, 60, 200, 30], color: "#4f63ad", width: 3, tool: "pen", nw: 200, nh: 90 },
      })}
    />
  ),
};

export const HighlighterStroke: StoryObj = {
  render: () => (
    <Frame
      item={item({
        type: "draw",
        width: 200,
        height: 90,
        data: { points: [0, 45, 50, 40, 100, 50, 150, 45, 200, 48], color: "#f59e0b", width: 16, tool: "highlighter", nw: 200, nh: 90 },
      })}
    />
  ),
};
