import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArchiveRestore, Bell, CheckCheck, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationFeed, useNotificationMutations, useNotificationRegistry, useSeenBatcher, type FeedState, type NotificationItem } from "./notification-api";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function openDeepLink(navigate: (to: string) => void, deepLink: string | null) {
  if (!deepLink) return;
  const path = deepLink.replace(/^twodb:\/\//, "");
  const [appId, ...rest] = path.split("/");
  if (!appId) return;
  navigate(`/apps/${appId}${rest.length ? `/${rest.join("/")}` : ""}`);
}

function OriginBadge({ origin, registry }: { origin: string; registry: { id: string; label: string }[] }) {
  const label = registry.find((g) => g.id === origin)?.label ?? origin;
  return <span className="text-muted-foreground/80 bg-muted/60 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">{label}</span>;
}

function UrgencyDot({ urgency }: { urgency: string }) {
  if (urgency !== "critical" && urgency !== "high") return null;
  return <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", urgency === "critical" ? "bg-red-500" : "bg-amber-500")} aria-label={urgency} />;
}

function NotificationRow({ item, registry, onOpen, onDismiss, onUnarchive }: { item: NotificationItem; registry: { id: string; label: string }[]; onOpen: (n: NotificationItem) => void; onDismiss: (n: NotificationItem) => void; onUnarchive: (n: NotificationItem) => void }) {
  return (
    <article className={cn("hover:bg-accent/50 group relative flex gap-2.5 border-b px-4 py-3 transition-colors last:border-b-0", !item.read && "bg-primary/[0.04]")}>
      <UrgencyDot urgency={item.urgency} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <OriginBadge origin={item.origin} registry={registry} />
          {item.actorName ? <span className="truncate text-xs font-medium">{item.actorName}</span> : null}
          <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">{timeAgo(item.createdAt)}</span>
        </div>
        <button onClick={() => onOpen(item)} className="mt-1 block w-full text-left">
          <p className={cn("truncate text-sm", item.read ? "font-normal" : "font-semibold")}>{item.title}</p>
          {item.body ? <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">{item.body}</p> : null}
        </button>
        {item.media.length > 0 ? (
          <div className="mt-2 flex gap-2">
            {item.media.slice(0, 3).map((m, i) => (
              <span key={i} className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]">
                {m.kind === "image" ? "🖼" : m.kind === "audio" ? "🎙" : "📄"} {m.filename ?? "attachment"}
              </span>
            ))}
          </div>
        ) : null}
        {!item.seen && <span className="bg-primary absolute top-3 right-3 size-1.5 rounded-full group-hover:opacity-0" aria-label="New" />}
      </div>
      <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {item.archived ? (
          <Button variant="ghost" size="icon-sm" aria-label="Restore" onClick={() => onUnarchive(item)}>
            <ArchiveRestore size={14} />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => onDismiss(item)}>
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </article>
  );
}

const STATES: { id: FeedState; label: string }[] = [
  { id: "active", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "archived", label: "Archive" },
];

export function NotificationsScene() {
  const [state, setState] = useState<FeedState>("active");
  const navigate = useNavigate();
  const feed = useNotificationFeed(state);
  const registry = useNotificationRegistry();
  const { read, dismiss, unarchive, readAll } = useNotificationMutations();
  const markSeen = useSeenBatcher();
  const groups = useMemo(() => (registry.data?.groups ?? []).map((g) => ({ id: g.id, label: g.label })), [registry.data]);
  const items = feed.data?.items ?? [];

  const onOpen = useCallback(
    (n: NotificationItem) => {
      if (!n.read) read.mutate(n.id);
      openDeepLink((to) => navigate(to), n.deepLink);
    },
    [read, navigate],
  );

  useEffect(() => {
    const unseenIds = items.filter((n) => !n.seen && !n.archived).map((n) => n.id);
    unseenIds.forEach(markSeen);
    // mark-seen fires when the visible list settles; counts refresh after
  }, [items, markSeen]);

  return (
    <div className="bg-background flex h-full flex-col">
      <header className="bg-card flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Bell size={16} />
        <h1 className="text-sm font-semibold">Notifications</h1>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            <CheckCheck size={14} /> Mark all read
          </Button>
        </div>
      </header>

      <div className="bg-card/50 flex h-9 shrink-0 items-center gap-1 border-b px-3">
        {STATES.map((s) => (
          <button
            key={s.id}
            onClick={() => setState(s.id)}
            className={cn(
              "focus-visible:ring-ring rounded px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
              state === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-8 text-sm">
            <Inbox size={28} strokeWidth={1.5} />
            <p>{state === "archived" ? "Archive is empty" : "No notifications yet"}</p>
          </div>
        ) : (
          items.map((n) => <NotificationRow key={n.id} item={n} registry={groups} onOpen={onOpen} onDismiss={(x) => dismiss.mutate(x.id)} onUnarchive={(x) => unarchive.mutate(x.id)} />)
        )}
      </div>
    </div>
  );
}
