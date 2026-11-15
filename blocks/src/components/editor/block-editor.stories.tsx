import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BlockEditor,
  type DatabaseBlockProps,
  type JSONContent,
  type PageMentionProps,
  type PageRef,
} from "@twodb/editor";
import "@twodb/editor/block.css";

const PAGES: PageRef[] = [
  { id: "page-editor", title: "Editor architecture", icon: "🧱" },
  { id: "page-release", title: "Release checklist", icon: "🚀" },
  { id: "page-research", title: "Research notes", icon: "🔬" },
];

const SAMPLE_DOC: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A shared block editor" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Garden uses " },
        { type: "text", marks: [{ type: "code" }], text: "BlockEditor" },
        { type: "text", text: " for Notion-style documents stored as TipTap JSON." },
      ],
    },
    {
      type: "callout",
      attrs: { icon: "💡" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Type / on an empty line to open the command menu." }] }],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Included building blocks" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Headings, lists, quotes, and code" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Tables, toggles, callouts, and images" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Page mentions and host-rendered database views" }] }] },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: true },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Share one editor across apps" }] }],
        },
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Try the selection bubble toolbar" }] }],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Continue in " },
        { type: "pageMention", attrs: { id: "page-editor", title: "Editor architecture" } },
        { type: "text", text: "." },
      ],
    },
    { type: "databaseView", attrs: { databaseId: "project-tasks", viewId: "active" } },
    { type: "paragraph" },
  ],
};

function DemoDatabase({ databaseId, viewId, editable, setViewId, remove }: DatabaseBlockProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-outline bg-paper">
      <div className="flex items-center justify-between border-b border-outline bg-stone px-3 py-2">
        <div>
          <p className="text-sm font-semibold">Project tasks</p>
          <p className="text-xs text-ink-muted">{databaseId} · {viewId ?? "default view"}</p>
        </div>
        {editable ? (
          <div className="flex gap-1">
            <button className="rounded border border-outline bg-paper px-2 py-1 text-xs" onClick={() => setViewId(viewId === "active" ? "all" : "active")}>
              Switch view
            </button>
            <button className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-paper" onClick={remove}>Remove</button>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-[1fr_110px] text-sm">
        <div className="border-b border-r border-outline px-3 py-2 font-medium">Task</div>
        <div className="border-b border-outline px-3 py-2 font-medium">Status</div>
        <div className="border-r border-outline px-3 py-2">Add editor stories</div>
        <div className="px-3 py-2 text-emerald-700">Complete</div>
      </div>
    </div>
  );
}

function DemoMention({ id, title }: PageMentionProps) {
  const page = PAGES.find((candidate) => candidate.id === id);
  return <><span>{page?.icon ?? "📄"}</span><span>{page?.title ?? title}</span></>;
}

function InteractiveBlockEditor({ initialContent = SAMPLE_DOC, editable = true }: { initialContent?: JSONContent; editable?: boolean }) {
  const [revision, setRevision] = useState(0);
  const [openedPage, setOpenedPage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="min-h-[520px] rounded-xl border border-outline bg-paper px-12 py-10 shadow-sm">
        <BlockEditor
          initialContent={initialContent}
          editable={editable}
          onChange={() => setRevision((current) => current + 1)}
          searchPages={async (query) => PAGES.filter((page) => page.title.toLowerCase().includes(query.toLowerCase()))}
          createPage={async (title) => ({ id: `new-${title.toLowerCase().replaceAll(" ", "-")}`, title, icon: "📄" })}
          openPage={setOpenedPage}
          DatabaseBlock={DemoDatabase}
          PageMention={DemoMention}
        />
      </div>
      <div className="flex justify-between text-xs text-ink-muted">
        <span>{editable ? "Try /, @, or [[ to open editor menus" : "Read-only document"}</span>
        <span>{openedPage ? `Opened ${openedPage}` : `${revision} document changes`}</span>
      </div>
    </div>
  );
}

const meta = {
  title: "Editor/BlockEditor",
  component: BlockEditor,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    initialContent: SAMPLE_DOC,
  },
  decorators: [
    (Story) => (
      <div className="w-[min(900px,calc(100vw-3rem))] py-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BlockEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Document: Story = {
  render: () => <InteractiveBlockEditor />,
};

export const Empty: Story = {
  render: () => <InteractiveBlockEditor initialContent={{ type: "doc", content: [{ type: "paragraph" }] }} />,
};

export const ReadOnly: Story = {
  render: () => <InteractiveBlockEditor editable={false} />,
};
