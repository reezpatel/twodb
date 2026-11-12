import { Hash, Lock, Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import type { Channel } from "../../../lib/chat-client";

/**
 * Left sidebar: channels grouped, DMs, new-channel button. Presentational.
 */

export interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId: string | null;
  myUserId: string | null;
  channelTitle: (channel: Channel) => string;
  online: Set<string>;
  onSelect: (channelId: string) => void;
  onCreateChannel: () => void;
  onStartDm: () => void;
}

export function ChannelSidebar(props: ChannelSidebarProps) {
  const channels = props.channels.filter((c) => c.kind === "channel");
  const dms = props.channels.filter((c) => c.kind === "dm");

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <span className="text-sm font-semibold">TwoChat</span>
        <Button variant="ghost" size="sm" aria-label="New channel" onClick={props.onCreateChannel}>
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <SidebarSection label="Channels">
          {channels.map((ch) => (
            <SidebarItem
              key={ch.id}
              active={ch.id === props.activeChannelId}
              unread={ch.unreadCount}
              onClick={() => props.onSelect(ch.id)}
              icon={<Hash size={13} className="shrink-0 opacity-60" />}
              label={ch.name}
            />
          ))}
          {!channels.length ? <div className="px-2 py-1 text-xs text-muted-foreground">No channels yet</div> : null}
        </SidebarSection>

        <SidebarSection label="Direct messages">
          {dms.map((ch) => {
            const other = ch.members.find((m) => !(m.type === "user" && m.userId === props.myUserId));
            const isOnline = other?.userId ? props.online.has(other.userId) : false;
            return (
              <SidebarItem
                key={ch.id}
                active={ch.id === props.activeChannelId}
                unread={ch.unreadCount}
                onClick={() => props.onSelect(ch.id)}
                icon={<Lock size={13} className="shrink-0 opacity-60" />}
                label={props.channelTitle(ch)}
            />
            );
          })}
          {!dms.length ? <div className="px-2 py-1 text-xs text-muted-foreground">No DMs yet</div> : null}
          <button type="button" onClick={props.onStartDm} className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus size={12} /> Start a conversation
          </button>
        </SidebarSection>
      </div>
    </aside>
  );
}

function SidebarSection(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{props.label}</div>
      <div className="flex flex-col gap-0.5">{props.children}</div>
    </div>
  );
}

function SidebarItem(props: { active: boolean; unread: number; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        props.active ? "bg-primary/10 font-medium text-primary" : "text-foreground/90 hover:bg-muted"
      }`}
    >
      {props.icon}
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      {props.unread > 0 ? (
        <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
          {props.unread > 99 ? "99+" : props.unread}
        </span>
      ) : null}
    </button>
  );
}
