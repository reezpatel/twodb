import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hash, LockKeyhole, Plus } from "lucide-react";
import { cn } from "@twodb/blocks";
import { ChannelSidebar } from "../routes/chat/partials/ChannelSidebar";
import { ListGroupTabs } from "../routes/chat/partials/ListGroupTabs";
import { SidebarChatRow } from "../routes/chat/partials/SidebarChatRow";
import { PresenceDot } from "../routes/chat/partials/PresenceDot";
import { channels, lists, previews, online, ME } from "./fixtures";

const noop = () => {};

const meta = {
  title: "TwoChat/Sidebar",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

/** Full sidebar: header (list name + actions), list tabs, search, sections. */
export const Sidebar: StoryObj = {
  render: () => (
    <div className="flex h-screen w-full bg-background text-foreground">
      <ChannelSidebar
        lists={lists}
        activeListId="list_default"
        onListChange={noop}
        onAddList={noop}
        conversations={channels}
        activeChannelId="ch_eng"
        myUserId={ME}
        channelTitle={(c) => (c.kind === "dm" ? c.name : `#${c.name}`)}
        online={online}
        previews={previews}
        search=""
        unreadNotifications={3}
        onSearchChange={noop}
        onSelect={noop}
        onCreateChannel={noop}
        onStartDm={noop}
        onOpenNotifications={noop}
      />
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">chat scene</div>
    </div>
  ),
};

export const SidebarUnreadBell: StoryObj = {
  name: "Sidebar · no unread",
  render: () => (
    <div className="flex h-screen w-full bg-background text-foreground">
      <ChannelSidebar
        lists={lists}
        activeListId="list_support"
        onListChange={noop}
        onAddList={noop}
        conversations={channels.filter((c) => c.listId !== null || c.kind === "channel")}
        activeChannelId="ch_design"
        myUserId={ME}
        channelTitle={(c) => (c.kind === "dm" ? c.name : `#${c.name}`)}
        online={online}
        previews={previews}
        search=""
        unreadNotifications={0}
        onSearchChange={noop}
        onSelect={noop}
        onCreateChannel={noop}
        onStartDm={noop}
        onOpenNotifications={noop}
      />
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">chat scene</div>
    </div>
  ),
};

export const SidebarSearching: StoryObj = {
  name: "Sidebar · searching",
  render: () => (
    <div className="flex h-screen w-full bg-background text-foreground">
      <ChannelSidebar
        lists={lists}
        activeListId="list_default"
        onListChange={noop}
        onAddList={noop}
        conversations={channels}
        activeChannelId={null}
        myUserId={ME}
        channelTitle={(c) => (c.kind === "dm" ? c.name : `#${c.name}`)}
        online={online}
        previews={previews}
        search="ada"
        unreadNotifications={0}
        onSearchChange={noop}
        onSelect={noop}
        onCreateChannel={noop}
        onStartDm={noop}
        onOpenNotifications={noop}
      />
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">chat scene</div>
    </div>
  ),
};

/** The segmented list-tab strip alone, in each selection state. */
export const ListTabs: StoryObj = {
  name: "List group tabs",
  render: () => (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">default list active</p>
        <div className="w-72"><ListGroupTabs lists={lists} activeId="list_default" onSelect={noop} onAdd={noop} /></div>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">custom list active</p>
        <div className="w-72"><ListGroupTabs lists={lists} activeId="list_personal" onSelect={noop} onAdd={noop} /></div>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">single list</p>
        <div className="w-72"><ListGroupTabs lists={[lists[0]]} activeId="list_default" onSelect={noop} onAdd={noop} /></div>
      </div>
    </div>
  ),
};

/** Conversation rows: every avatar/preview/unread combination. */
export const ChatRows: StoryObj = {
  name: "Chat rows",
  render: () => (
    <ul className="flex w-72 flex-col gap-0.5 p-3">
      <SidebarChatRow
        active
        avatar={<span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><Hash size={16} /></span>}
        label="engineering"
        preview="Ada: fixed it — see the PR"
        unread={0}
        onClick={noop}
      />
      <SidebarChatRow
        active={false}
        avatar={<span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600"><LockKeyhole size={15} /></span>}
        label="deploys (read-only)"
        preview="deploy #482 ok"
        unread={99}
        onClick={noop}
      />
      <SidebarChatRow
        active={false}
        avatar={<span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm">🎨</span>}
        label="Cleo Park"
        preview="new mocks in Figma"
        unread={2}
        onClick={noop}
      />
      <SidebarChatRow
        active={false}
        avatar={<span className="relative flex items-end"><span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary">🤖</span><span className="absolute -bottom-0.5 -right-0.5"><PresenceDot status="bot" /></span></span>}
        label="Scout"
        preview="digest ready"
        unread={0}
        onClick={noop}
      />
      <SidebarChatRow
        active={false}
        avatar={<span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><Plus size={16} /></span>}
        label="very-long-conversation-name-that-truncates"
        preview="a preview that also truncates after some length"
        unread={0}
        onClick={noop}
      />
    </ul>
  ),
};

export const PresenceDots: StoryObj = {
  name: "Presence dot",
  render: () => (
    <div className="flex items-center gap-6 p-6">
      {(["online", "bot", "offline"] as const).map((status) => (
        <div key={status} className="flex flex-col items-center gap-2">
          <span className={cn("grid size-9 place-items-center rounded-full bg-muted text-sm", status === "online" && "bg-emerald-500/20")}>🙂</span>
          <PresenceDot status={status} />
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>
      ))}
    </div>
  ),
};
