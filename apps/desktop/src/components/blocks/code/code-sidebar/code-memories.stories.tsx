import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { CodeMemories, type CodeMemory } from "./code-memories";

const MEMORIES: CodeMemory[] = [
  {
    id: "1",
    title: "Repo conventions",
    group: "global",
    content: "Repo uses pnpm + Kysely; migrations live in apps/server/src/migrations.\nRoutes stay free of styling — blocks own the markup.",
  },
  { id: "2", title: "Release checklist", group: "global", content: "Tag from main, then publish the desktop build." },
  { id: "3", title: "Dev ports", group: "project", content: "API on :3001, desktop dev on :5173 via the /api proxy." },
  { id: "4", title: "Runner network rules", group: "project", content: "Runners connect outbound; never expose runner ports." },
  { id: "5", title: "Review style", group: "local", content: "Prefers concise answers. Lead with the verdict, then the reasons." },
];

const meta = {
  title: "Blocks/Code/CodeSidebar/Memories",
  component: CodeMemories,
  parameters: { layout: "centered" },
  args: { memories: MEMORIES },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof CodeMemories>;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ children }: { children: ReactNode }) {
  return <div className="bg-background w-72 rounded-md border p-3">{children}</div>;
}

/** Click a chip to read its content. */
export const Default: Story = {};

export const WithForget: Story = {
  render: (args) => {
    const [memories, setMemories] = useState(args.memories);
    return <CodeMemories memories={memories} onRemove={(id) => setMemories((current) => current.filter((m) => m.id !== id))} />;
  },
};

export const SingleGroup: Story = { args: { memories: MEMORIES.filter((m) => m.group === "project") } };

export const LongContent: Story = {
  args: {
    memories: [
      {
        id: "long",
        title: "Release checklist",
        group: "global",
        content: Array.from({ length: 40 }, (_, i) => `${i + 1}. A step in the checklist that is long enough to wrap.`).join("\n"),
      },
    ],
  },
};

export const Empty: Story = { args: { memories: [] } };
