import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeSubagents, type CodeSubagent } from "./code-subagents";

const SUBAGENTS: CodeSubagent[] = [
  { id: "1", title: "Audit the migrations folder", status: "running", detail: "depth 1 · running" },
  { id: "2", title: "Summarise the failing tests", status: "idle", detail: "depth 1 · idle · headless" },
  { id: "3", title: "Draft the release notes", status: "closed", detail: "depth 2 · closed" },
];

const meta = {
  title: "Blocks/Code/CodeSidebar/Subagents",
  component: CodeSubagents,
  parameters: { layout: "centered" },
  args: { subagents: SUBAGENTS, onSelect: () => {} },
  decorators: [
    (Story) => (
      <div className="bg-background w-72 rounded-md border p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeSubagents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllRunning: Story = { args: { subagents: SUBAGENTS.map((s) => ({ ...s, status: "running" as const })) } };

export const Single: Story = { args: { subagents: SUBAGENTS.slice(0, 1) } };

export const LongTitle: Story = {
  args: {
    subagents: [
      {
        id: "x",
        title: "Investigate why the nightly sync job fails only on the second Tuesday of every month",
        status: "running",
        detail: "depth 3 · running · headless",
      },
    ],
  },
};

/** Past four rows the list scrolls; running ones stay on top, closed ones sink. */
export const Many: Story = {
  args: {
    subagents: Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      title: `Subagent task ${i + 1}`,
      status: (["closed", "running", "idle", "closed", "running", "idle", "closed", "closed", "running"] as const)[i],
      detail: "depth 1",
    })),
  },
};
