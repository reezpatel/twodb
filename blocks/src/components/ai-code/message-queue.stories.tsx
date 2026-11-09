import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageQueue, type QueuedMessage } from "./message-queue";

const meta = {
  title: "Blocks/AICode/MessageQueue",
  component: MessageQueue,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof MessageQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { items: [] },
  render: () => {
    const [items, setItems] = React.useState<QueuedMessage[]>([
      { id: "q1", content: "Compare the mobile navigation states." },
      { id: "q2", content: "Add the results to the implementation plan.", attachments: 2 },
      { id: "q3", content: "Check the spacing in dark mode." },
      { id: "q4", content: "Refactor the tab close handler.", status: "sending" },
    ]);
    const [status, setStatus] = React.useState("");
    return (
      <div className="w-[560px] p-6">
        <MessageQueue
          items={items}
          onReorder={setItems}
          onRemove={(id) => setItems((c) => c.filter((i) => i.id !== id))}
          onSendNow={(id) => {
            setStatus(`Steered: ${items.find((i) => i.id === id)?.content}`);
            setItems((c) => c.filter((i) => i.id !== id));
          }}
          onMoveToTop={(id) =>
            setItems((c) => {
              const sel = c.find((i) => i.id === id);
              return sel ? [sel, ...c.filter((i) => i.id !== id)] : c;
            })
          }
        />
        <p className="mt-2 px-1 text-[12px] text-muted-foreground">{status}</p>
      </div>
    );
  },
};

export const Empty: Story = {
  args: { items: [] },
  render: () => (
    <div className="w-[560px] p-6">
      <MessageQueue items={[]} />
    </div>
  ),
};
