import { Link } from "react-router";
import { AtSign, CheckCheck, MessageSquare, UserPlus, ArrowRightLeft, Bell } from "lucide-react";
import { Button } from "@twodb/blocks";
import { EmptyState, Spinner } from "../../components/Visuals";
import { post } from "../../lib/api";
import { useApiMutation, useNotifications } from "../../lib/queries";
import { timeAgo } from "../../lib/format";

const ICONS: Record<string, typeof Bell> = { comment: MessageSquare, assigned: UserPlus, status: ArrowRightLeft, mention: AtSign };

export function InboxPage() {
  const { data, isLoading } = useNotifications();
  const read = useApiMutation((v: { ids?: string[]; all?: boolean }) => post("/notifications/read", v));
  if (isLoading) return <Spinner />;
  const items = data?.items ?? [];
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-4 flex items-center"><h1 className="text-lg font-semibold">Inbox</h1>{data?.unreadCount ? <span className="ml-2 rounded-full bg-ink px-2 text-xs text-paper">{data.unreadCount}</span> : null}
        <Button size="sm" variant="ghost" className="ml-auto" disabled={!data?.unreadCount} onClick={() => read.mutate({ all: true })}><CheckCheck />Mark all read</Button></div>
      {!items.length ? <EmptyState title="You're all caught up" hint="You're notified when tickets you watch change, when you're assigned, and on new comments." /> : (
        <div className="overflow-hidden rounded-md border border-outline">
          {items.map((n) => { const I = ICONS[n.kind] ?? Bell; const body = (
            <div className={`flex items-center gap-3 border-b border-outline/60 px-4 py-3 text-sm last:border-0 hover:bg-stone ${n.readAt ? "text-ink-muted" : ""}`}>
              <I className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{n.message}</span><span className="shrink-0 text-xs">{timeAgo(n.createdAt)}</span>
              {!n.readAt ? <span className="size-2 shrink-0 rounded-full bg-ion-deep" aria-label="Unread" /> : null}
            </div>); return n.ticketIdentifier ? <Link key={n.id} to={`/t/${n.ticketIdentifier}`} onClick={() => !n.readAt && read.mutate({ ids: [n.id] })}>{body}</Link> : <div key={n.id}>{body}</div>; })}
        </div>
      )}
    </div>
  );
}
