import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotificationCounts, useNotificationFeed, useNotificationMutations, useNotificationLive, useNotificationToasts, useSeenBatcher, type NotificationItem, type ToastEntry } from "@/routes/notifications/notification-api";

// The bell: unseen badge, quick popover feed, and the app-wide toast stack.
// One mount in the app shell (nav rail desktop / header mobile).

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function BellButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={count ? `Notifications (${count} unseen)` : "Notifications"}
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring relative flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
    >
      <Bell size={16} />
      {count > 0 ? (
        <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

function Toasts({ onOpen }: { onOpen: (t: ToastEntry) => void }) {
  const { toasts, remove } = useNotificationToasts();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed top-3 right-3 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t: ToastEntry) => (
        <div
          key={t.id}
          role="status"
          className="bg-card pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3 shadow-lg"
          onClick={() => {
            onOpen(t);
            remove(t.id);
          }}
        >
          {t.urgency === "critical" ? <span className="bg-destructive mt-1.5 size-1.5 shrink-0 rounded-full" /> : t.urgency === "high" ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{t.title}</p>
            {t.body ? <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">{t.body}</p> : null}
            {t.ephemeral ? <span className="text-muted-foreground/70 text-[10px] tracking-wide uppercase">Live</span> : null}
          </div>
          <button aria-label="Dismiss" className="text-muted-foreground hover:text-foreground shrink-0" onClick={(e) => (e.stopPropagation(), remove(t.id))}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function NotificationBell({ layout }: { layout: "rail" | "header" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const counts = useNotificationCounts();
  const feed = useNotificationFeed("active");
  const { read, readAll } = useNotificationMutations();
  const markSeen = useSeenBatcher();
  useNotificationLive();

  const openDeepLink = useCallback(
    (deepLink: string | null) => {
      if (!deepLink) return;
      const path = deepLink.replace(/^twodb:\/\//, "");
      const [appId, ...rest] = path.split("/");
      if (appId) navigate(`/apps/${appId}${rest.length ? `/${rest.join("/")}` : ""}`);
    },
    [navigate],
  );

  const onToastOpen = useCallback(
    (t: ToastEntry) => {
      openDeepLink(t.deepLink);
    },
    [openDeepLink],
  );

  const items = useMemo(() => feed.data?.items.slice(0, 8) ?? [], [feed.data]);
  const unseen = counts.data?.unseen ?? 0;

  useEffect(() => {
    if (open) {
      const ids = items.filter((n) => !n.seen && !n.archived).map((n) => n.id);
      ids.forEach(markSeen);
    }
  }, [open, items, markSeen]);

  const bell = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <BellButton count={unseen} onClick={() => setOpen(true)} />
        </div>
      </PopoverTrigger>
      <PopoverContent align={layout === "rail" ? "start" : "end"} side={layout === "rail" ? "right" : "bottom"} sideOffset={8} className="bg-card w-96 p-0">
        <div className="flex h-11 items-center gap-2 border-b px-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unseen > 0 ? <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[11px] font-semibold">{unseen} new</span> : null}
          <div className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="Mark all as read" onClick={() => readAll.mutate()}>
              <CheckCheck size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Notification settings"
              onClick={() => {
                setOpen(false);
                navigate("/apps/settings/notifications");
              }}
            >
              <Settings size={14} />
            </Button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-xs">You're all caught up</p>
          ) : (
            items.map((n: NotificationItem) => (
              <button
                key={n.id}
                className={cn("hover:bg-accent/50 flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0", !n.read && "bg-primary/[0.04]")}
                onClick={() => {
                  if (!n.read) read.mutate(n.id);
                  setOpen(false);
                  openDeepLink(n.deepLink);
                }}
              >                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("truncate text-[13px]", n.read ? "font-normal" : "font-semibold")}>{n.title}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">{timeAgo(n.createdAt)}</span>
                  </span>
                  {n.body ? <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs leading-relaxed">{n.body}</span> : null}
                </span>
                {!n.seen ? <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" /> : null}
              </button>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              navigate("/apps/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      {bell}
      <Toasts onOpen={onToastOpen} />
    </>
  );
}
