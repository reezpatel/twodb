import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box } from "lucide-react";
import { Badge } from "./badge";

const meta = {
  title: "Blocks/UI/Badge",
  component: Badge,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="info">claude-code</Badge>
      <Badge tone="warning">Personal</Badge>
      <Badge tone="success">running</Badge>
      <Badge tone="danger">failed</Badge>
      <Badge>neutral</Badge>
      <Badge tone="info" icon={<Box />}>
        with icon
      </Badge>
    </div>
  ),
};
