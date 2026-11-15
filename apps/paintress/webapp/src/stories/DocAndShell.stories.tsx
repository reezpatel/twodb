import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownEditor } from "@twodb/editor";
import { BoardHeader } from "../board/partials/BoardHeader";
import { ConflictBanner } from "../board-doc/partials/ConflictBanner";
import { Welcome } from "../shell/partials/Welcome";
import { BoardRow } from "../shell/partials/BoardRow";
import { BoardList } from "../shell/partials/BoardList";
import { Sidebar } from "../shell/partials/Sidebar";
import { NewBoardDialog } from "../shell/partials/NewBoardDialog";
import { board, group, noop } from "./fixtures";

const meta = {
  title: "Board/Chrome & doc",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

// ---------------------------------------------------------------- header

export const Header: StoryObj = {
  render: () => (
    <BoardHeader
      name="AWS production architecture"
      status="open"
      presence={[
        { actor: "user:ada", kind: "human" },
        { actor: "agent:builder", kind: "agent" },
      ]}
      onRename={noop}
      sidebar={{ open: true, onToggle: noop }}
    />
  ),
};

export const HeaderReconnecting: StoryObj = {
  render: () => <BoardHeader name="Untitled board" status="connecting" presence={[]} onRename={noop} sidebar={{ open: false, onToggle: noop }} />,
};

// ---------------------------------------------------------------- doc

const DOC = `# Launch plan

The **checkout** service talks to *billing* over Kafka.

- [x] scaffold
- [ ] load test

\`\`\`mermaid
flowchart LR
  A[Cart] --> B[Checkout] --> C[(Billing)]
\`\`\`

| step | owner |
| ---- | ----- |
| api  | ada   |
`;

export const Editor: StoryObj = {
  render: function EditorDemo() {
    const [value, setValue] = useState(DOC);
    return (
      <div className="h-[520px] overflow-auto bg-paper">
        <MarkdownEditor
          value={value}
          onChange={setValue}
          placeholder="Start writing…"
          bare
          className="pa-doc-editor mx-auto min-h-full max-w-3xl px-8 py-6"
        />
      </div>
    );
  },
};

export const Conflict: StoryObj = {
  render: () => <ConflictBanner onTheirs={noop} onMine={noop} />,
};

// ---------------------------------------------------------------- shell

export const Home: StoryObj = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Welcome onNew={noop} sidebar={{ open: true, onToggle: noop }} />
    </div>
  ),
};

const groups = [group({ id: "g1", name: "General" }), group({ id: "g2", name: "Infra", spaceId: "sp2" })];
const boards = [
  board({ id: "b1", groupId: "g1", name: "AWS production" }),
  board({ id: "b2", groupId: "g1", name: "Checkout ERD", kind: "diagram" }),
  board({ id: "b3", groupId: "g2", name: "GCP migration" }),
];

export const Row: StoryObj = {
  render: () => (
    <div className="w-64 bg-popover p-2">
      <BoardRow board={boards[0]!} active={false} onOpen={noop} onRename={noop} onDelete={noop} />
      <BoardRow board={boards[1]!} active onOpen={noop} onRename={noop} onDelete={noop} />
    </div>
  ),
};

export const List: StoryObj = {
  render: () => (
    <div className="w-64 bg-popover p-2" style={{ height: 400 }}>
      <BoardList
        tab="diagram"
        collapsed={{ g2: true }}
        onToggleSection={noop}
        boards={boards}
        groups={groups}
        spaceName={(id) => ({ sp1: "Product", sp2: "Platform" })[id]}
        activeBoardId="b2"
        onOpen={noop}
        onRename={noop}
        onDelete={noop}
        onNew={noop}
      />
    </div>
  ),
};

export const FullSidebar: StoryObj = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
      <Sidebar
        tab="diagram"
        onTabChange={noop}
        boards={boards}
        groups={groups}
        spaces={[{ id: "sp1", name: "Product" }, { id: "sp2", name: "Platform" }]}
        counts={{ diagram: 3, doc: 1 }}
        activeBoardId="b1"
        onOpen={noop}
        onNew={noop}
        onRename={noop}
        onDelete={noop}
      />
    </div>
  ),
};

export const NewBoard: StoryObj = {
  render: () => (
    <NewBoardDialog
      open
      initialKind="diagram"
      groups={groups}
      spaces={[{ id: "sp1", name: "Product" }, { id: "sp2", name: "Platform" }]}
      onClose={noop}
      onCreate={async () => {}}
    />
  ),
};
