import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeChatUsage, CodeChatUsageContext, CodeChatUsageStat, type CodeChatUsageBreakdownItem } from "./code-chat-usage";

const BREAKDOWN: CodeChatUsageBreakdownItem[] = [
  { label: "System prompt", value: "6.2k" },
  { label: "Tools", value: "9.8k" },
  { label: "Messages", value: "78k" },
  { label: "Tool results", value: "41k" },
];

const meta = {
  title: "Blocks/Code/CodeChatFooter/UsageContext",
  component: CodeChatUsageContext,
  parameters: { layout: "centered" },
  args: { percent: 34, label: "68k / 200k" },
  decorators: [
    (Story) => (
      <CodeChatUsage>
        <Story />
      </CodeChatUsage>
    ),
  ],
} satisfies Meta<typeof CodeChatUsageContext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Low: Story = { args: { percent: 8, label: "16k / 200k" } };

export const Half: Story = {};

export const Warning: Story = { args: { percent: 86, label: "172k / 200k" } };

export const Danger: Story = { args: { percent: 97, label: "194k / 200k" } };

export const Full: Story = { args: { percent: 100, label: "200k / 200k" } };

export const UnknownWindow: Story = { args: { percent: null, label: "68k" } };

export const WithBreakdown: Story = { args: { percent: 67, label: "135k / 200k", breakdown: BREAKDOWN } };

export const InRow: Story = {
  render: (args) => (
    <CodeChatUsage>
      <CodeChatUsageStat>↑ 120k</CodeChatUsageStat>
      <CodeChatUsageStat>↓ 8.4k</CodeChatUsageStat>
      <CodeChatUsageContext {...args} />
    </CodeChatUsage>
  ),
  args: { percent: 67, label: "135k / 200k", breakdown: BREAKDOWN },
};

export const Interactive: Story = {
  render: function InteractiveStory() {
    const [percent, setPercent] = useState(50);
    const limit = 200_000;
    const used = Math.round((percent / 100) * limit);
    return (
      <div className="flex w-72 flex-col gap-4">
        <CodeChatUsageContext percent={percent} label={`${Math.round(used / 1000)}k / 200k`} breakdown={BREAKDOWN} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPercent((cur) => Math.min(100, cur + 10))}>
            Add 10%
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPercent(0)}>
            Reset
          </Button>
        </div>
      </div>
    );
  },
};
