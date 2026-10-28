import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CodePlan, type CodePlanItem, type CodePlanProps } from "./code-plan";

const MIXED: CodePlanItem[] = [
  { id: "1", title: "Read the existing sidebar and list the sections it renders", status: "completed" },
  { id: "2", title: "Extract the plan markup into presentational blocks", status: "completed" },
  { id: "3", title: "Write stories for every plan state", status: "in-progress" },
  { id: "4", title: "Wire the route to the new blocks", status: "pending" },
  { id: "5", title: "Run tsc, prettier and the diff check", status: "pending" },
];

const meta = {
  title: "Blocks/Code/CodeSidebar/Plan",
  component: CodePlan,
  parameters: { layout: "centered" },
  args: { items: MIXED },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof CodePlan>;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ children }: { children: ReactNode }) {
  return <div className="bg-background w-72 rounded-md border">{children}</div>;
}

const withStatus = (status: CodePlanItem["status"]) => MIXED.map((item) => ({ ...item, status }));

export const InProgress: Story = {};

export const WithProgress: Story = {
  args: {
    items: MIXED.map((item) => (item.status === "in-progress" ? { ...item, progress: 60, detail: "60%" } : item)),
  },
};

export const NotStarted: Story = { args: { items: withStatus("pending") } };

export const Complete: Story = { args: { items: withStatus("completed"), defaultOpen: true, collapseOnComplete: false } };

export const WithCancelled: Story = {
  args: { items: MIXED.map((item, index) => (index === 3 ? { ...item, status: "cancelled" as const } : item)) },
};

export const Empty: Story = { args: { items: [] } };

export const Collapsed: Story = { args: { defaultOpen: false } };

export const ManySteps: Story = {
  args: {
    items: Array.from({ length: 14 }, (_, index): CodePlanItem => ({
      id: String(index),
      title: `Step ${index + 1}: migrate one more route onto the shared blocks`,
      status: index < 9 ? "completed" : index === 9 ? "in-progress" : "pending",
    })),
  },
};

export const LongTitles: Story = {
  args: {
    items: [
      {
        id: "1",
        title:
          "Migrate every route that still renders its own markup for the transcript, the footer and the side panel onto the shared blocks without changing behavior",
        status: "in-progress",
      },
      { id: "2", title: "Short step", status: "pending" },
    ],
  },
};

function Advancing(props: Omit<CodePlanProps, "items">) {
  const [current, setCurrent] = useState(2);
  const [extra, setExtra] = useState(0);
  const items = [...MIXED, ...Array.from({ length: extra }, (_, index): CodePlanItem => ({ id: `extra-${index}`, title: `Follow-up step ${index + 1}` }))].map(
    (item, index): CodePlanItem => ({ ...item, status: index < current ? "completed" : index === current ? "in-progress" : "pending" }),
  );

  return (
    <div className="flex flex-col">
      <CodePlan items={items} {...props} />
      <div className="flex gap-2 border-t p-2">
        <Button size="xs" variant="outline" onClick={() => setCurrent((value) => Math.min(items.length, value + 1))}>
          Advance
        </Button>
        <Button size="xs" variant="outline" onClick={() => setExtra((value) => value + 1)}>
          Add a step
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            setCurrent(2);
            setExtra(0);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <Advancing />,
};

export const CollapsesWhenComplete: Story = {
  render: () => <Advancing collapseOnComplete />,
};
