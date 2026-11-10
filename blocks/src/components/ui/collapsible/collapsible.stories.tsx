import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleChevron } from "./collapsible";

const meta = {
  title: "Blocks/UI/Collapsible",
  component: Collapsible,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-80 rounded-[10px] border border-outline bg-paper">
      <CollapsibleTrigger>
        Body
        <CollapsibleChevron open={open} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-outline px-3 py-2 font-mono text-[12px]">{"{ \"name\": \"Ada\" }"}</CollapsibleContent>
    </Collapsible>
  );
}

export const Default: Story = { render: () => <Demo /> };
