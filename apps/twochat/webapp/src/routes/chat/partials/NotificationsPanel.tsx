import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@twodb/blocks";
import type { Notification } from "../../../lib/chat-client";

/**
 * Notification inbox panel (mentions, DMs, bot posts) with read/unread state.
 */

export interface NotificationsPanelProps {
  notifications: Notification[];
  unread: number;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onOpen: (channelId: string | null) => void;
  onClose: () => void;
}

export function NotificationsPanel(props: NotificationsPanelProps) {
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Bell size={14} /> Notifications
          {props.unread > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">{props.unread}</span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          {props.unread > 0 ? (
            <Button variant="ghost" size="sm" aria-label="Mark all read" onClick={props.onReadAll}>
              <Check size={14} />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" aria-label="Close notifications" onClick={props.onClose}>
            <BellOff size={14} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {props.notifications.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">Nothing yet — mentions and DMs land here.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {props.notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.readAt) props.onRead(n.id);
                  props.onOpen(n.channelId);
                  props.onClose();
                }}
                className={`flex flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors ${
                  n.readAt ? "border-transparent hover:bg-muted/60" : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  {n.kind === "dm" ? "💬" : n.kind === "bot-post" ? "🤖" : n.kind === "mention" ? "@" : "🔔"}
                  {n.title}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
