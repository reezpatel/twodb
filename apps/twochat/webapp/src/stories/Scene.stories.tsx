import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Hash } from "lucide-react";
import { ChatScene } from "../routes/chat/partials/ChatScene";
import { Composer } from "../routes/chat/partials/Composer";
import { channel, messages, memberList, message, allBlocksMessage } from "./fixtures";

const meta = {
  title: "TwoChat/Scene & Composer",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const noop = () => {};

/** Whole center column: header, history, typing strip, composer. */
export const Scene: StoryObj = {
  render: () => (
    <div className="flex h-screen bg-background text-foreground">
      <ChatScene
        channel={channel("ch_eng")}
        channelTitle="#engineering"
        messages={messages}
        hasMore={false}
        myUserId="user_me"
        typingNames={["Ada Lovelace"]}
        onLoadMore={noop}
        onReact={noop}
        onReply={noop}
        onPin={noop}
        onSave={noop}
        onDelete={noop}
        onAction={noop}
      >
        <Composer
          channelId="ch_eng"
          members={memberList}
          replyTo={null}
          onCancelReply={noop}
          onSend={async () => {}}
          onTyping={noop}
          onUpload={async () => []}
          initialDraft=""
          onDraftChange={noop}
        />
      </ChatScene>
    </div>
  ),
};

/** A collaborator mid-run: stop button, working strip, reply shown below. */
export const SceneCollabWorking: StoryObj = {
  name: "Scene · collaborator working",
  render: () => (
    <div className="flex h-screen bg-background text-foreground">
      <ChatScene
        channel={channel("ch_eng")}
        channelTitle="#engineering"
        messages={[message("msg_collab"), allBlocksMessage]}
        hasMore
        myUserId="user_me"
        typingNames={[]}
        working={{ name: "Atlas", onStop: noop }}
        onLoadMore={noop}
        onReact={noop}
        onReply={noop}
        onPin={noop}
        onSave={noop}
        onDelete={noop}
        onAction={noop}
      >
        <Composer channelId="ch_eng" members={memberList} replyTo={null} onCancelReply={noop} onSend={async () => {}} onTyping={noop} onUpload={async () => []} initialDraft="" onDraftChange={noop} disabled />
      </ChatScene>
    </div>
  ),
};

/** Read-only mirror: no composer, source strip instead. */
export const SceneReadOnly: StoryObj = {
  name: "Scene · read-only mirror",
  render: () => (
    <div className="flex h-screen bg-background text-foreground">
      <ChatScene
        channel={channel("ch_status")}
        channelTitle="#deploys"
        messages={messages.slice(0, 4)}
        hasMore={false}
        myUserId="user_me"
        readOnly
        typingNames={[]}
        working={null}
        onLoadMore={noop}
        onReact={noop}
        onReply={noop}
        onPin={noop}
        onSave={noop}
        onDelete={noop}
        onAction={noop}
      />
    </div>
  ),
};

export const SceneEmpty: StoryObj = {
  name: "Scene · no channel",
  render: () => (
    <div className="flex h-screen bg-background text-foreground">
      <ChatScene
        channel={null}
        channelTitle=""
        messages={[]}
        hasMore={false}
        myUserId="user_me"
        typingNames={[]}
        onLoadMore={noop}
        onReact={noop}
        onReply={noop}
        onPin={noop}
        onSave={noop}
        onDelete={noop}
        onAction={noop}
      />
    </div>
  ),
};

/** Composer states: plain, with reply context, disabled. */
export const ComposerStates: StoryObj = {
  render: () => {
    const [draft, setDraft] = useState("");
    return (
      <div className="flex h-screen flex-col justify-end gap-8 bg-background p-6 text-foreground">
        <Composer channelId="ch_eng" members={memberList} replyTo={null} onCancelReply={noop} onSend={async () => {}} onTyping={noop} onUpload={async () => []} initialDraft={draft} onDraftChange={setDraft} />
        <Composer channelId="ch_eng" members={memberList} replyTo={message("msg_text")} onCancelReply={noop} onSend={async () => {}} onTyping={noop} onUpload={async () => []} initialDraft="" onDraftChange={noop} />
        <Composer channelId="ch_eng" members={memberList} replyTo={null} onCancelReply={noop} onSend={async () => {}} onTyping={noop} onUpload={async () => []} initialDraft="" onDraftChange={noop} disabled />
      </div>
    );
  },
};

/** Empty state shown when no channel is selected. */
export const EmptyState: StoryObj = {
  render: () => (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Hash size={28} />
        <p className="text-sm">Pick a channel or start a DM</p>
      </div>
    </div>
  ),
};
