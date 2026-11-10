import type { Meta, StoryObj } from "@storybook/react-vite";
import { DraggableWidgetGrid, type WidgetItem } from "./widget-grid";

const meta = {
  title: "Blocks/UI/DraggableWidgetGrid",
  component: DraggableWidgetGrid,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DraggableWidgetGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: WidgetItem[] = [
  { id: "w1", size: "wide", label: "Runs" },
  { id: "w2", size: "sm", label: "Status" },
  { id: "w3", size: "sm", label: "Cost" },
  { id: "w4", size: "sm", label: "Errors" },
  { id: "w5", size: "wide", label: "Traces" },
  { id: "w6", size: "lg", label: "Tokens by model" },
];

export const Default: Story = {
  render: () => (
    <div className="max-w-4xl">
      <DraggableWidgetGrid
        items={ITEMS}
        renderItem={(item) => (
          <div className="flex h-full flex-col gap-3 p-4">
            <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{item.label}</p>
            <p className="text-[28px] leading-none tracking-tight text-ink">12,345</p>
            <p className="mt-auto text-[13px] text-ink-muted">Drag me — Alt+arrows with a keyboard.</p>
          </div>
        )}
      />
    </div>
  ),
};
