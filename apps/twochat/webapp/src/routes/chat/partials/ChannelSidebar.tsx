import { Bell, Hash, LockKeyhole, Plus, Search } from "lucide-react";
import { Button, Input, cn } from "@twodb/blocks";
import type { Channel, ConversationList, Member } from "../../../lib/chat-client";
import { ListGroupTabs } from "./ListGroupTabs";
import { PresenceDot, type PresenceStatus } from "./PresenceDot";
import { SidebarChatRow } from "./SidebarChatRow";

/** Searchable conversation index for the selected isolated list group. */
export interface ChannelSidebarProps {
  lists: ConversationList[];
  activeListId: string | null;
  onListChange: (id: string) => void;
  onAddList: () => void;
  conversations: Channel[];
  activeChannelId: string | null;
  myUserId: string | null;
  channelTitle: (channel: Channel) => string;
  online: Set<string>;
  previews: Record<string, string>;
  search: string;
  unreadNotifications: number;
  onSearchChange: (value: string) => void;
  onSelect: (channelId: string) => void;
  onCreateChannel: () => void;
  onStartDm: () => void;
  onOpenNotifications: () => void;
}

export function ChannelSidebar(props: ChannelSidebarProps) {
  const query = props.search.trim().toLowerCase();
  const matches = (conversation: Channel) =>
    !query || props.channelTitle(conversation).toLowerCase().includes(query) || conversation.topic?.toLowerCase().includes(query) || conversation.members.some((member) => member.name.toLowerCase().includes(query));
  const groups = props.conversations.filter((conversation) => conversation.kind === "channel" && matches(conversation));
  const dms = props.conversations.filter((conversation) => conversation.kind === "dm" && matches(conversation));

  return (
    <aside aria-label="Chats" className="flex h-full w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-card" role="complementary">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col"><h1 className="truncate text-lg font-semibold leading-tight">Chats</h1><span className="text-[11px] text-muted-foreground">TwoChat workspace</span></div>
        <nav aria-label="Chat actions" className="flex items-center gap-1">
          <Button aria-label="Start a new direct message" size="sm" type="button" variant="ghost" onClick={props.onStartDm}><Plus size={16} /></Button>
          <Button aria-label="Open notifications" size="sm" type="button" variant="ghost" onClick={props.onOpenNotifications} className="relative"><Bell size={16} />{props.unreadNotifications > 0 ? <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-primary ring-2 ring-card" /> : null}</Button>
        </nav>
      </header>

      <ListGroupTabs lists={props.lists} activeId={props.activeListId} onSelect={props.onListChange} onAdd={props.onAddList} />

      <div className="px-3 py-3">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search conversations" className="h-9 w-full pl-9 text-sm" inputMode="search" onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Search this list…" type="search" value={props.search} /></div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-4">
        <ChatSection label="Conversations" onAdd={props.onCreateChannel} addLabel="Create conversation">
          {groups.length ? groups.map((conversation) => (
            <SidebarChatRow
              key={conversation.id}
              active={conversation.id === props.activeChannelId}
              avatar={<ConversationAvatar conversation={conversation} />}
              label={conversation.name}
              preview={props.previews[conversation.id] ?? conversation.topic ?? "Conversation"}
              unread={conversation.unreadCount}
              onClick={() => props.onSelect(conversation.id)}
            />
          )) : <EmptyRow>{query ? "No conversations found." : "No conversations in this list."}</EmptyRow>}
        </ChatSection>

        {dms.length || !query ? (
          <ChatSection label="Direct messages" onAdd={props.onStartDm} addLabel="Start direct message">
            {dms.length ? dms.map((conversation) => {
              const other = conversation.members.find((member) => !(member.type === "user" && member.userId === props.myUserId));
              return <SidebarChatRow key={conversation.id} active={conversation.id === props.activeChannelId} avatar={<DirectAvatar member={other} online={props.online} readOnly={conversation.isReadOnly} />} label={props.channelTitle(conversation)} preview={props.previews[conversation.id] ?? "Direct message"} unread={conversation.unreadCount} onClick={() => props.onSelect(conversation.id)} />;
            }) : <EmptyRow>No direct messages in this list.</EmptyRow>}
          </ChatSection>
        ) : null}
      </div>
    </aside>
  );
}

function ChatSection(props: { label: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  const id = `sidebar-${props.label.toLowerCase().replaceAll(" ", "-")}`;
  return <section aria-labelledby={id} className="flex flex-col gap-1"><div className="flex items-center justify-between px-3"><h2 id={id} className="text-xs font-semibold text-muted-foreground">{props.label}</h2><button type="button" aria-label={props.addLabel} onClick={props.onAdd} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Plus size={13} /></button></div><ul className="flex flex-col gap-0.5">{props.children}</ul></section>;
}

function ConversationAvatar({ conversation }: { conversation: Channel }) {
  if (conversation.avatarUrl) return <img src={conversation.avatarUrl} alt="" className="size-9 shrink-0 rounded-xl object-cover" />;
  return <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-xl border shadow-sm", conversation.isReadOnly ? "border-amber-500/20 bg-amber-500/10 text-amber-600" : "border-primary/15 bg-primary/10 text-primary")}>{conversation.isReadOnly ? <LockKeyhole size={15} /> : <Hash size={16} />}</span>;
}

function DirectAvatar({ member, online, readOnly }: { member?: Member; online: Set<string>; readOnly: boolean }) {
  const name = member?.name ?? "?";
  const initials = name.split(/[\s-_]+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const status: PresenceStatus = member?.type === "bot" ? "bot" : member?.userId && online.has(member.userId) ? "online" : "offline";
  return <span className="relative flex shrink-0 items-end"><span className={cn("grid size-9 place-items-center rounded-full text-xs font-semibold shadow-sm", member?.type === "bot" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{member?.avatarEmoji ?? initials}</span><span className="absolute -bottom-0.5 -right-0.5 flex">{readOnly ? <span className="grid size-3 place-items-center rounded-full border-2 border-card bg-amber-500 text-[7px] text-white">L</span> : <PresenceDot status={status} />}</span></span>;
}

function EmptyRow({ children }: { children: React.ReactNode }) { return <li className="px-4 py-2 text-sm text-muted-foreground">{children}</li>; }
