import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThinkingBlock } from "./thinking-block";

const meta = {
  title: "Blocks/AICode/ThinkingBlock",
  component: ThinkingBlock,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof ThinkingBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { children: "First I'll read the existing tabs implementation, then swap in the new design…" },
  render: (args) => (
    <div className="w-[480px] p-6">
      <ThinkingBlock {...args} />
    </div>
  ),
};

export const Expanded: Story = {
  args: {
    defaultOpen: true,
    children: "First I'll read the existing tabs implementation, then swap in the new design.\nThe active tab needs an inverted-radius corner so it blends into the content below.",
  },
  render: (args) => (
    <div className="w-[480px] p-6">
      <ThinkingBlock {...args} />
    </div>
  ),
};

export const Live: Story = {
  args: { live: true },
  render: (args) => (
    <div className="w-[480px] p-6">
      <ThinkingBlock {...args} />
    </div>
  ),
};
