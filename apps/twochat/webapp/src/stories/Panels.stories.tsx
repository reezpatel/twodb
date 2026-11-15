import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from "../routes/chat/partials/message";
import { NotificationsPanel } from "../routes/chat/partials/NotificationsPanel";
import { NewChannelDialog } from "../routes/chat/partials/NewChannelDialog";
import { StartDmDialog } from "../routes/chat/partials/StartDmDialog";
import { AddListDialog } from "../routes/chat/partials/AddListDialog";
import { SpacePicker } from "../routes/chat/partials/SpacePicker";
import { CollaboratorPicker } from "../routes/chat/partials/CollaboratorPicker";
import { bots, notifications, spaces } from "./fixtures";

const meta = {
  title: "TwoChat/Panels & Dialogs",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

const noop = () => {};

export const Notifications: StoryObj = {
  render: () => (
    <div className="flex h-screen justify-end bg-background text-foreground">
      <NotificationsPanel
        notifications={notifications}
        unread={2}
        onRead={noop}
        onReadAll={noop}
        onOpen={noop}
        onClose={noop}
      />
    </div>
  ),
};

export const NotificationsEmpty: StoryObj = {
  name: "Notifications · empty",
  render: () => (
    <div className="flex h-screen justify-end bg-background text-foreground">
      <NotificationsPanel notifications={[]} unread={0} onRead={noop} onReadAll={noop} onOpen={noop} onClose={noop} />
    </div>
  ),
};

/** Open dialogs rendered side by side on dimmed backdrops. */
export const Dialogs: StoryObj = {
  render: () => (
    <div className="flex h-screen items-center justify-around gap-4 bg-background p-8 text-foreground">
      <div className="relative grid size-full place-items-center">
        <NewChannelDialog open onCreate={noop} onClose={noop} />
      </div>
    </div>
  ),
};

export const NewChannelWithError: StoryObj = {
  name: "Dialog · new channel (error)",
  render: () => <NewChannelDialog open error="A channel with that name already exists." onCreate={noop} onClose={noop} />,
};

export const AddList: StoryObj = {
  name: "Dialog · add list",
  render: () => <AddListDialog open spaces={spaces} onCreate={noop} onClose={noop} />,
};

export const AddListNoSpaces: StoryObj = {
  name: "Dialog · add list (no spaces)",
  render: () => <AddListDialog open spaces={[]} onCreate={noop} onClose={noop} />,
};

/**
 * StartDmDialog fetches collaborators via chatApi on open — stubbed here with
 * artisan-runtime bots so the picker path renders without a gateway.
 */
export const StartDm: StoryObj = {
  name: "Dialog · start DM (stubbed fetch)",
  render: () => {
    // Patch fetch before mount: the dialog calls chatApi.listBots() on open.
    window.fetch = ((input: RequestInfo | URL) =>
      Promise.resolve(
        new Response(JSON.stringify(bots), { status: 200, headers: { "content-type": "application/json" } }),
      )) as typeof fetch;
    return <StartDmDialog open onStart={noop} onClose={noop} />;
  },
};

export const SpacePickers: StoryObj = {
  name: "Space picker",
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div className="flex max-w-sm flex-col gap-4 bg-background p-6 text-foreground">
        <SpacePicker id="story-space" spaces={spaces} value={value} onChange={setValue} />
        <SpacePicker id="story-space-2" spaces={[]} value="" onChange={noop} />
      </div>
    );
  },
};

export const CollaboratorPickers: StoryObj = {
  name: "Collaborator picker",
  render: () => {
    const [value, setValue] = useState(bots[1].id);
    return (
      <div className="flex max-w-sm flex-col gap-6 bg-background p-6 text-foreground">
        <CollaboratorPicker id="story-collab" collaborators={bots} value={value} onChange={setValue} />
        <CollaboratorPicker id="story-collab-empty" collaborators={[]} value="" onChange={noop} />
      </div>
    );
  },
};

/** The message primitives MessageBubble composes from, in both alignments. */
export const MessagePrimitives: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-8 bg-background p-6 text-foreground">
      {(["start", "end"] as const).map((align) => (
        <MessageGroup key={align}>
          <Message align={align}>
            <MessageAvatar><span className="grid size-8 place-items-center rounded-full bg-muted text-xs">🙂</span></MessageAvatar>
            <MessageContent>
              <MessageHeader>
                <span className="text-sm font-semibold">Ada Lovelace</span>
                <span className="text-xs text-muted-foreground">12:04</span>
              </MessageHeader>
              <p className="text-sm">Content column follows the {align} alignment.</p>
              <MessageFooter>
                <span className="text-[10px] text-muted-foreground">footer row</span>
              </MessageFooter>
            </MessageContent>
          </Message>
        </MessageGroup>
      ))}
    </div>
  ),
};
