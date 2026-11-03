import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FilePlus } from "lucide-react";
import { AppNav } from "./app-nav";
import { AppNavFileTree } from "./app-nav-file-tree";
import { AppNavLink } from "./app-nav-link";
import { AppNavLinks } from "./app-nav-links";
import { PAGES, PROJECTS, addNode, deleteNode, largeTree, moveNodes, renameNode } from "./app-nav-file-tree.fixtures";

const meta = {
  title: "Blocks/App Nav/FileTree",
  component: AppNavFileTree,
  parameters: { layout: "centered" },
  args: { title: "Pages", nodes: PAGES },
  decorators: [
    (Story) => (
      <div className="bg-card w-64 rounded-lg py-2">
        <AppNav defaultSelectedId="p-roadmap">
          <Story />
        </AppNav>
      </div>
    ),
  ],
} satisfies Meta<typeof AppNavFileTree>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Read-only: no drag, rename, delete or create handlers. */
export const Default: Story = {};

/** Everything wired to local state — drag to reorder or nest, double-click to rename, hover for "+" and "⋯". */
export const Interactive: Story = {
  render: (args) => {
    const [nodes, setNodes] = useState(args.nodes);
    return (
      <AppNavFileTree
        {...args}
        nodes={nodes}
        onMove={(move) => setNodes((cur) => moveNodes(cur, move))}
        onRename={(id, name) => setNodes((cur) => renameNode(cur, id, name))}
        onDelete={(id) => setNodes((cur) => deleteNode(cur, id))}
        onCreate={(parentId) => setNodes((cur) => addNode(cur, parentId))}
      />
    );
  },
};

/** Several independent trees in one nav, plus a links section; the selection is shared across all of them. */
export const MultipleSections: Story = {
  render: () => {
    const [pages, setPages] = useState(PAGES);
    const [projects, setProjects] = useState(PROJECTS);
    return (
      <>
        <AppNavLinks title="Quick links">
          <AppNavLink id="inbox" label="Inbox" />
          <AppNavLink id="today" label="Today" />
        </AppNavLinks>
        <AppNavFileTree
          title="Pages"
          nodes={pages}
          onMove={(m) => setPages((cur) => moveNodes(cur, m))}
          onRename={(id, name) => setPages((cur) => renameNode(cur, id, name))}
          onDelete={(id) => setPages((cur) => deleteNode(cur, id))}
          onCreate={(parentId) => setPages((cur) => addNode(cur, parentId))}
        />
        <AppNavFileTree
          title="Projects"
          nodes={projects}
          onMove={(m) => setProjects((cur) => moveNodes(cur, m))}
          onRename={(id, name) => setProjects((cur) => renameNode(cur, id, name))}
          onDelete={(id) => setProjects((cur) => deleteNode(cur, id))}
          onCreate={(parentId) => setProjects((cur) => addNode(cur, parentId, "untitled.ts"))}
        />
      </>
    );
  },
};

/** 60 folders × 25 files. Only visible rows render; the tree scrolls inside its max height. */
export const LargeScrolling: Story = {
  args: { title: "Everything", nodes: largeTree(), maxHeight: 280 },
  render: (args) => {
    const [nodes, setNodes] = useState(args.nodes);
    return <AppNavFileTree {...args} nodes={nodes} onMove={(move) => setNodes((cur) => moveNodes(cur, move))} />;
  },
};

export const CustomMaxHeight: Story = { args: { nodes: largeTree(6, 8), maxHeight: 140 } };

export const Collapsed: Story = { args: { defaultExpanded: false } };

export const Empty: Story = { args: { nodes: [], onCreate: () => {} } };

export const WithExtraHeaderActions: Story = {
  args: {
    onCreate: () => {},
    actions: (
      <button
        type="button"
        title="New from template"
        aria-label="New from template"
        className="text-muted-foreground hover:text-foreground hover:bg-foreground/8 flex size-5 items-center justify-center rounded"
      >
        <FilePlus className="size-3.5" />
      </button>
    ),
  },
};
