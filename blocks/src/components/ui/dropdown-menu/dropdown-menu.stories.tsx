import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "./dropdown-menu";

const meta = {
  title: "Blocks/UI/DropdownMenu",
  component: DropdownMenu,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-[6px] border border-outline p-2">
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>
          Start <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Restart</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
