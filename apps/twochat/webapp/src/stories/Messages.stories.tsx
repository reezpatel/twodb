import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageRow } from "../routes/chat/partials/MessageRow";
import { BlockView } from "../routes/chat/partials/BlockView";
import { MessageBubble } from "../routes/chat/MessageBubble";
import { allBlocksMessage, message } from "./fixtures";

const meta = {
  title: "TwoChat/Messages",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

const noop = () => {};
const rowProps = (overrides: Partial<Parameters<typeof MessageRow>[0]> = {}) => ({
  mine: false,
  showAuthor: true,
  onReact: noop,
  onReply: noop,
  onPin: noop,
  onSave: noop,
  onDelete: noop,
  onAction: noop,
  ...overrides,
});

/** Every message shape: plain, grouped, edited, reply, reactions, pinned, deleted, bot, collab. */
export const AllMessageShapes: StoryObj = {
  name: "All message shapes",
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col bg-background p-6 text-foreground">
      {[
        message("msg_text"),
        message("msg_grouped"),
        message("msg_edited"),
        message("msg_reply"),
        message("msg_reactions"),
        message("msg_pinned"),
        message("msg_deleted"),
        message("msg_bot"),
        message("msg_collab"),
        message("msg_collab_failed"),
      ].map((m) => (
        <MessageRow key={m.id} message={m} {...rowProps({ mine: m.userId === "user_me", showAuthor: true })} />
      ))}
    </div>
  ),
};

/** Same transcript as mine — right-aligned bubbles with the reply/rollback affordances. */
export const MineMessageShapes: StoryObj = {
  name: "Mine · right aligned",
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col bg-background p-6 text-foreground">
      {["msg_text", "msg_grouped", "msg_edited", "msg_reactions", "msg_pinned"].map((id) => {
        const m = message(id);
        return <MessageRow key={id} message={m} {...rowProps({ mine: true, onRollback: noop })} />;
      })}
    </div>
  ),
};

/** The kitchen-sink bot message: one of every block type in a single post. */
export const AllBlockTypes: StoryObj = {
  name: "All block types · kitchen sink",
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col bg-background p-6 text-foreground">
      <MessageRow message={allBlocksMessage} {...rowProps()} />
    </div>
  ),
};

/** Each block type alone, so regressions are easy to isolate. */
export const BlockGallery: StoryObj = {
  name: "Block gallery · one of each",
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 bg-background p-6 text-foreground">
      {(allBlocksMessage.blocks ?? []).map((block, i) => (
        <div key={i} className="flex flex-col gap-1 border-b border-dashed border-border pb-4 last:border-0">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{String(block.type)}{block.type === "callout" ? ` · ${String(block.tone)}` : block.type === "status" ? ` · ${String(block.state)}` : ""}</span>
          <BlockView block={block} resolveMention={(kind, id) => (kind === "user" ? "Ada Lovelace" : "Scout")} onAction={noop} />
        </div>
      ))}
    </div>
  ),
};

/** Read-only mirror of an external conversation. */
export const ReadOnlyMirror: StoryObj = {
  name: "Read-only mirror",
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col bg-background p-6 text-foreground">
      <MessageRow message={{ ...message("msg_reply"), sourceUrl: "https://slack.example.com/archives/77" }} {...rowProps({ readOnly: true })} />
    </div>
  ),
};

/** The raw bubble chrome with arbitrary content (hover for the action row). */
export const BubbleChrome: StoryObj = {
  name: "Bubble · chrome only",
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 bg-background p-6 text-foreground">
      {[
        { isMine: false, bubble: true, children: <p className="text-sm">Someone else's plain text in a bubble.</p> },
        { isMine: true, bubble: true, children: <p className="text-sm">My plain text in a bubble.</p> },
        { isMine: false, bubble: false, children: <p className="text-sm">No-bubble chrome (bot with cards).</p> },
        { isMine: false, bubble: true, isPinned: true, isSaved: true, children: <p className="text-sm">Pinned and saved.</p> },
        { isMine: false, bubble: true, badge: "AI", children: <p className="text-sm">Badged bot reply with vote buttons.</p> },
      ].map((variant, i) => (
        <MessageBubble
          key={i}
          authorName={variant.isMine ? "You" : i === 4 ? "Scout" : "Ada Lovelace"}
          showHeader
          timestamp="12:04"
          copyText="copy me"
          onReact={noop}
          onReply={noop}
          onPin={variant.isPinned ? noop : undefined}
          onSave={variant.isSaved ? noop : undefined}
          onDelete={variant.isMine ? noop : undefined}
          onVote={variant.badge ? noop : undefined}
          {...variant}
        />
      ))}
    </div>
  ),
};
