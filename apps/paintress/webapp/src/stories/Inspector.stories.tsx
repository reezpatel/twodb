import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inspector } from "../board-diagram/partials/Inspector";
import { item, noop } from "./fixtures";

const meta = {
  title: "Diagram/Inspector",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

function Host({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ width: "100vw", height: "100vh", background: "var(--paper)" }}>
      {children}
    </div>
  );
}

export const Shape: StoryObj = {
  render: () => (
    <Host>
      <Inspector
        item={item({ type: "shape", width: 160, height: 80, data: { pack: "basic", shape: "rounded", text: "API", fill: "#bfdbfe" } })}
        disabled={false}
        onPatch={noop}
        onDelete={noop}
        onDuplicate={noop}
        onAddLane={noop}
      />
    </Host>
  ),
};

export const Edge: StoryObj = {
  render: () => (
    <Host>
      <Inspector
        item={item({ type: "edge", data: { from: { itemId: "a" }, to: { itemId: "b" }, label: "calls", kind: "async", routing: "orthogonal", endCap: "arrow" } })}
        disabled={false}
        onPatch={noop}
        onDelete={noop}
        onDuplicate={noop}
        onAddLane={noop}
      />
    </Host>
  ),
};

export const Sticky: StoryObj = {
  render: () => (
    <Host>
      <Inspector item={item({ type: "sticky", width: 180, height: 180, data: { text: "Note", color: "#fde68a" } })} disabled={false} onPatch={noop} onDelete={noop} onDuplicate={noop} onAddLane={noop} />
    </Host>
  ),
};

export const Pool: StoryObj = {
  render: () => (
    <Host>
      <Inspector item={item({ type: "pool", width: 520, height: 320, data: { title: "Checkout flow" } })} disabled={false} onPatch={noop} onDelete={noop} onDuplicate={noop} onAddLane={noop} />
    </Host>
  ),
};

export const Entity: StoryObj = {
  render: () => (
    <Host>
      <Inspector
        item={item({ type: "entity", width: 240, height: 112, data: { name: "users", columns: [{ id: "id", name: "id", type: "uuid", pk: true }] } })}
        disabled={false}
        onPatch={noop}
        onDelete={noop}
        onDuplicate={noop}
        onAddLane={noop}
      />
    </Host>
  ),
};
