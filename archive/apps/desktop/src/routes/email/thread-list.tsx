import { AlertTriangle, Archive, Clock, Inbox, Loader2, MailOpen, Paperclip, Pencil, Pin, RotateCcw, Search, ShieldAlert, ShieldCheck, Star, Tag, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { displayName, formatListTime, initials, type EmailAccount, type EmailLabel, type EmailThread } from "./email-api";
import { LabelPicker } from "./labels/label-picker";
import type { EmailSceneState } from "./use-email-scene";

function participantsLine(thread: EmailThread, accounts: EmailAccount[]): string {
  const own = new Set(accounts.flatMap((a) => [a.address, ...a.aliases]));
  const names = thread.participants.map((p) => (own.has(p.address) ? "Me" : displayName(p)));
  const unique = [...new Set(names)];
  if (!unique.length) return thread.hasDraft ? "Draft" : "(no recipients)";
  return unique.slice(0, 3).join(", ") + (unique.length > 3 ? ` +${unique.length - 3}` : "");
}

function ThreadRow({
  thread,
  active,
  checked,
  labels,
  accounts,
  showAccount,
  onSelect,
  onCheck,
}: {
  thread: EmailThread;
  active: boolean;
  checked: boolean;
  labels: EmailLabel[];
  accounts: EmailAccount[];
  showAccount: boolean;
  onSelect: () => void;
  onCheck: () => void;
}) {
  const unread = thread.unreadCount > 0;
  const who = participantsLine(thread, accounts);
  const rowLabels = thread.labelIds.map((id) => labels.find((l) => l.id === id)).filter((l): l is EmailLabel => !!l);
  const account = showAccount ? accounts.find((a) => a.id === thread.accountId) : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group hover:bg-accent/50 relative flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-2.5 text-left transition-colors outline-none",
        active && "bg-accent hover:bg-accent shadow-[inset_2px_0_0_var(--color-primary)]",
        checked && "bg-accent/60",
      )}
    >
      <span className="relative size-8 shrink-0">
        <Avatar className={cn("transition-opacity", (checked || undefined) && "opacity-0", "group-hover:opacity-0")}>
          <AvatarFallback className="text-xs">{initials(who)}</AvatarFallback>
        </Avatar>
        <span className={cn("absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100", checked && "opacity-100")} onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={checked} onCheckedChange={onCheck} aria-label="Select conversation" />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <strong className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{who}</strong>
          {thread.messageCount > 1 ? <Badge variant="secondary">{thread.messageCount}</Badge> : null}
          {thread.hasDraft ? <span className="text-destructive shrink-0 text-xs">Draft</span> : null}
          <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">{formatListTime(thread.lastMessageAt)}</span>
        </span>
        <span className={cn("truncate text-xs", unread ? "text-foreground font-medium" : "text-foreground/80")}>{thread.subject || "(no subject)"}</span>
        <span className="text-muted-foreground truncate text-xs">{thread.snippet}</span>
        {rowLabels.length || thread.hasOutbox || thread.hasScheduled || thread.snoozedUntil || account ? (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {account ? (
              <span className="text-muted-foreground rounded border px-1.5 text-[10px]" style={account.color ? { borderColor: account.color } : undefined}>
                {account.address}
              </span>
            ) : null}
            {thread.hasOutbox ? (
              <span className="text-warning flex items-center gap-1 text-[11px]">
                <AlertTriangle size={11} /> Outbox
              </span>
            ) : null}
            {thread.hasScheduled ? (
              <span className="text-primary flex items-center gap-1 text-[11px]">
                <Clock size={11} /> Scheduled
              </span>
            ) : null}
            {thread.snoozedUntil && new Date(thread.snoozedUntil) > new Date() ? (
              <span className="text-primary flex items-center gap-1 text-[11px]">
                <Clock size={11} /> {new Date(thread.snoozedUntil).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            {rowLabels.slice(0, 3).map((l) => (
              <span key={l.id} className="bg-card inline-flex items-center gap-1 rounded-full border px-1.5 text-[10px]">
                <span className="size-1.5 rounded-sm" style={{ backgroundColor: l.effectiveColor ?? "var(--color-muted-foreground)" }} />
                {l.name}
              </span>
            ))}
            {rowLabels.length > 3 ? <span className="text-muted-foreground text-[10px]">+{rowLabels.length - 3}</span> : null}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 pt-6">
        {thread.hasStarred ? <Star size={12} className="text-primary" fill="currentColor" /> : null}
        {thread.hasAttachments ? <Paperclip size={12} className="text-muted-foreground" /> : null}
      </span>
      {unread ? <i className="bg-primary absolute top-3.5 left-0.5 size-1.5 rounded-full" aria-label="Unread" /> : null}
    </div>
  );
}

const TITLES: Record<string, string> = {
  inbox: "Inbox",
  starred: "Starred",
  sent: "Sent",
  drafts: "Drafts",
  scheduled: "Scheduled",
  outbox: "Outbox",
  snoozed: "Snoozed",
  archive: "Archive",
  spam: "Spam",
  trash: "Trash",
  all: "All mail",
};

export function ThreadList({ s, title }: { s: EmailSceneState; title: string }) {
  const labels = s.labels.data ?? [];
  const accounts = s.accounts.data ?? [];
  const showAccount = !s.accountId && accounts.length > 1;
  const checkedThreads = [...s.pinned, ...s.rest].filter((t) => s.checked.has(t.id));
  const bulk = (action: Parameters<EmailSceneState["act"]["mutate"]>[0]["action"], payload?: Record<string, unknown>) =>
    s.act.mutate({ ids: [...s.checked], action, payload });
  const total = s.view === "inbox" && !s.labelId && !s.query ? s.counts.data?.inboxTotal : undefined;
  const inTrash = s.view === "trash" && !s.labelId;
  const inSpam = s.view === "spam" && !s.labelId;

  const row = (t: EmailThread) => (
    <ThreadRow
      key={t.id}
      thread={t}
      active={s.selected === t.id}
      checked={s.checked.has(t.id)}
      labels={labels}
      accounts={accounts}
      showAccount={showAccount}
      onSelect={() => s.setSelected(t.id)}
      onCheck={() => s.toggleChecked(t.id)}
    />
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-3 border-r p-4 px-3">
      <header className="flex items-baseline gap-2">
        <h3 className="truncate text-lg font-semibold">{title || TITLES[s.view]}</h3>
        {total !== undefined ? <span className="text-muted-foreground text-xs">{total.toLocaleString()} conversations</span> : null}
        {inTrash || inSpam ? (
          <Button variant="ghost" size="xs" className="text-destructive ml-auto" disabled={s.purgeView.isPending} onClick={() => window.confirm(inTrash ? "Permanently delete everything in Trash?" : "Permanently delete all spam?") && s.purgeView.mutate(inTrash ? "trash" : "spam")}>
            {inTrash ? "Empty trash" : "Delete all spam"}
          </Button>
        ) : null}
      </header>
      {s.labelId ? (
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Switch checked={s.includeChildren} onCheckedChange={s.setIncludeChildren} /> Include sub-labels
        </label>
      ) : null}
      <div className="relative">
        <Search size={14} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
        <Input value={s.query} onChange={(e) => s.setQuery(e.target.value)} placeholder="Search mail" aria-label="Search messages" className="h-8 pl-8 text-xs" />
      </div>

      {s.checked.size ? (
        <div className="bg-muted/50 flex flex-wrap items-center gap-0.5 rounded-lg border px-1.5 py-1">
          <Checkbox checked={s.allChecked ? true : "indeterminate"} onCheckedChange={(v) => s.checkAll(v === true)} aria-label="Select all" className="mx-1" />
          <span className="text-muted-foreground mr-1 text-xs tabular-nums">{s.checked.size}</span>
          {inTrash ? (
            <>
              <Button variant="ghost" size="icon-xs" aria-label="Restore" onClick={() => bulk("restore")}>
                <RotateCcw />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Delete forever" className="text-destructive" onClick={() => window.confirm("Permanently delete the selected conversations?") && bulk("purge")}>
                <Trash2 />
              </Button>
            </>
          ) : (
            <>
              {s.view === "archive" ? (
                <Button variant="ghost" size="icon-xs" aria-label="Move to inbox" onClick={() => bulk("inbox")}>
                  <Inbox />
                </Button>
              ) : (
                <Button variant="ghost" size="icon-xs" aria-label="Archive" onClick={() => bulk("archive")}>
                  <Archive />
                </Button>
              )}
              {inSpam ? (
                <Button variant="ghost" size="icon-xs" aria-label="Not spam" onClick={() => bulk("not_spam")}>
                  <ShieldCheck />
                </Button>
              ) : (
                <Button variant="ghost" size="icon-xs" aria-label="Spam" onClick={() => bulk("spam")}>
                  <ShieldAlert />
                </Button>
              )}
              <Button variant="ghost" size="icon-xs" aria-label="Trash" onClick={() => bulk("trash")}>
                <Trash2 />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Mark read" onClick={() => bulk("read")}>
                <MailOpen />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Pin" onClick={() => bulk("pin")}>
                <Pin />
              </Button>
              <LabelPicker labels={labels} threads={checkedThreads} onApply={(add, remove) => bulk("label", { add, remove })}>
                <Button variant="ghost" size="icon-xs" aria-label="Labels">
                  <Tag />
                </Button>
              </LabelPicker>
            </>
          )}
          <Button variant="ghost" size="icon-xs" aria-label="Clear selection" className="ml-auto" onClick={() => s.setChecked(new Set())}>
            <X />
          </Button>
        </div>
      ) : null}

      <div className="-mr-2 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {s.threads.isLoading ? <Loader2 className="text-muted-foreground m-auto animate-spin" /> : null}
        {s.threads.error ? <p className="text-destructive p-2 text-sm">{s.threads.error.message}</p> : null}
        {s.pinned.length ? (
          <>
            <span className="text-muted-foreground/70 flex items-center gap-1 px-2 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              <Pin size={10} /> Pinned
            </span>
            {s.pinned.map(row)}
          </>
        ) : null}
        {s.rest.length ? (
          <>
            {s.pinned.length ? <span className="text-muted-foreground/70 px-2 pt-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">Everything else</span> : null}
            {s.rest.map(row)}
          </>
        ) : null}
        {!s.threads.isLoading && !s.pinned.length && !s.rest.length ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
            {s.view === "drafts" ? <Pencil size={18} /> : <Inbox size={18} />}
            {s.query ? "No conversations match your search." : "Nothing here."}
          </div>
        ) : null}
        {s.threads.hasNextPage ? (
          <Button variant="ghost" size="sm" className="my-2" disabled={s.threads.isFetchingNextPage} onClick={() => void s.threads.fetchNextPage()}>
            {s.threads.isFetchingNextPage ? <Loader2 className="animate-spin" /> : null} Load more
          </Button>
        ) : null}
      </div>
    </section>
  );
}
