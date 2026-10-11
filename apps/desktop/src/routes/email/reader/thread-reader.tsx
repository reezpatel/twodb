import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  BellOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerUpLeft,
  Download,
  FileText,
  Forward,
  Inbox,
  Loader2,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Reply,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { displayName, formatBytes, initials, type EmailAddress, type EmailLabel, type EmailMessage, type ThreadAction } from "../email-api";
import { LabelPicker } from "../labels/label-picker";
import { labelPathName } from "../labels/use-label-tree";
import { MessageHtml, MessageText } from "./message-html";
import { useThreadReader } from "./use-thread-reader";

export function snoozeOptions(): { label: string; at: Date }[] {
  const now = new Date();
  const laterToday = new Date(now.getTime() + 3 * 3600_000);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextWeek.setHours(8, 0, 0, 0);
  return [
    { label: "Later today", at: laterToday },
    { label: "Tomorrow", at: tomorrow },
    { label: "Next week", at: nextWeek },
  ];
}

function AddressChips({ label, list }: { label: string; list: EmailAddress[] }) {
  if (!list.length) return null;
  return (
    <>
      <span className="text-muted-foreground mr-0.5 text-xs">{label}</span>
      {list.map((a) => (
        <Tooltip key={a.address}>
          <TooltipTrigger asChild>
            <span className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">{displayName(a)}</span>
          </TooltipTrigger>
          <TooltipContent>{a.address}</TooltipContent>
        </Tooltip>
      ))}
    </>
  );
}

function StatusLine({ message, onOp, canWrite }: { message: EmailMessage; onOp: (op: "retry" | "edit") => void; canWrite: boolean }) {
  if (message.direction !== "outbound" || message.status === "sent" || message.status === "draft") return null;
  const map = {
    queued: { icon: Loader2, text: message.lastError ? `Waiting to retry — ${message.lastError}` : "Queued — sending shortly", cls: "text-muted-foreground", spin: true },
    sending: { icon: Loader2, text: "Sending…", cls: "text-muted-foreground", spin: true },
    scheduled: { icon: Clock, text: `Scheduled for ${message.scheduledAt ? new Date(message.scheduledAt).toLocaleString() : ""}`, cls: "text-primary", spin: false },
    failed: { icon: AlertTriangle, text: `Not sent — ${message.lastError ?? "unknown error"}`, cls: "text-destructive", spin: false },
    cancelled: { icon: X, text: "Cancelled", cls: "text-muted-foreground", spin: false },
    received: null,
  } as const;
  const entry = map[message.status as keyof typeof map];
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs", entry.cls)}>
      <Icon size={13} className={entry.spin ? "animate-spin" : undefined} />
      <span className="flex-1">{entry.text}</span>
      {canWrite && message.status === "failed" ? (
        <Button size="xs" variant="outline" onClick={() => onOp("retry")}>
          <RotateCcw /> Retry
        </Button>
      ) : null}
      {canWrite && ["failed", "scheduled", "queued"].includes(message.status) ? (
        <Button size="xs" variant="ghost" onClick={() => onOp("edit")}>
          <Pencil /> Edit
        </Button>
      ) : null}
    </div>
  );
}

interface MessageBlockProps {
  message: EmailMessage;
  open: boolean;
  canWrite: boolean;
  onToggle: () => void;
  onReply: (kind: "reply" | "reply_all" | "forward") => void;
  onOp: (op: "star" | "unstar" | "delete" | "restore" | "purge" | "retry" | "edit" | "discard" | "unread") => void;
  onEditDraft: () => void;
}

function MessageBlock({ message, open, canWrite, onToggle, onReply, onOp, onEditDraft }: MessageBlockProps) {
  const sender = message.from;
  const name = displayName(sender);
  const files = message.attachments.filter((a) => !a.isInline);

  if (message.status === "draft") {
    return (
      <article className="border-destructive/30 bg-destructive/5 flex items-center gap-3 rounded-lg border border-dashed px-4 py-3">
        <Pencil size={14} className="text-destructive" />
        <span className="min-w-0 flex-1">
          <strong className="text-destructive text-sm font-medium">Draft</strong>
          <span className="text-muted-foreground ml-2 truncate text-xs">
            {message.to.length ? `to ${message.to.map(displayName).join(", ")}` : "no recipients"} · {message.snippet || "empty"}
          </span>
        </span>
        <Button size="xs" variant="outline" onClick={onEditDraft}>
          Edit
        </Button>
        <Button size="xs" variant="ghost" onClick={() => onOp("discard")}>
          Discard
        </Button>
      </article>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={onToggle} className={cn("hover:bg-accent/40 flex w-full items-center gap-3 border-t px-1 py-2.5 text-left", message.deletedAt && "opacity-60")}>
        <Avatar size="sm">
          <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
        </Avatar>
        <strong className={cn("w-40 shrink-0 truncate text-sm", message.isRead ? "font-medium" : "font-semibold")}>{name}</strong>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{message.snippet}</span>
        {message.deletedAt ? <Badge variant="outline">in trash</Badge> : null}
        {files.length ? <Paperclip size={12} className="text-muted-foreground" /> : null}
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{new Date(message.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
      </button>
    );
  }

  return (
    <article className={cn("flex flex-col gap-3 border-t pt-4", message.deletedAt && "opacity-70")}>
      <header className="flex items-center gap-2">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onToggle}>
          <Avatar>
            <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-sm font-semibold">
              {name}
              {message.sentByName ? <span className="text-muted-foreground ml-1.5 text-xs font-normal">sent by {message.sentByName}</span> : null}
            </strong>
            <span className="text-muted-foreground truncate text-xs">{sender?.address}</span>
          </div>
        </button>
        {message.deletedAt ? <Badge variant="outline">in trash</Badge> : null}
        <span className="text-muted-foreground text-xs tabular-nums">{new Date(message.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
        {canWrite ? (
          <Button variant="ghost" size="icon-xs" aria-label={message.isStarred ? "Unstar" : "Star"} className={message.isStarred ? "text-primary" : undefined} onClick={() => onOp(message.isStarred ? "unstar" : "star")}>
            <Star size={14} fill={message.isStarred ? "currentColor" : "none"} />
          </Button>
        ) : null}
        {canWrite && !message.deletedAt ? (
          <Button variant="ghost" size="icon-xs" aria-label="Reply" onClick={() => onReply("reply")}>
            <Reply size={14} />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Message actions">
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canWrite && !message.deletedAt ? (
              <>
                <DropdownMenuItem onSelect={() => onReply("reply")}>
                  <Reply /> Reply
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onReply("reply_all")}>
                  <CornerUpLeft /> Reply all
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onReply("forward")}>
                  <Forward /> Forward
                </DropdownMenuItem>
                {message.direction === "inbound" ? (
                  <DropdownMenuItem onSelect={() => onOp("unread")}>
                    <MailOpen /> Mark unread from here
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
              </>
            ) : null}
            {message.hasRaw ? (
              <DropdownMenuItem asChild>
                <a href={`/api/email/messages/${message.id}/raw`} download>
                  <Download /> Download .eml
                </a>
              </DropdownMenuItem>
            ) : null}
            {canWrite ? (
              message.deletedAt ? (
                <>
                  <DropdownMenuItem onSelect={() => onOp("restore")}>
                    <RotateCcw /> Restore message
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => onOp("purge")}>
                    <Trash2 /> Delete forever
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem variant="destructive" onSelect={() => onOp("delete")}>
                  <Trash2 /> Delete this message
                </DropdownMenuItem>
              )
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-wrap items-center gap-1.5">
        <AddressChips label="To" list={message.to} />
        <AddressChips label="Cc" list={message.cc} />
        <AddressChips label="Bcc" list={message.bcc} />
      </div>
      <StatusLine message={message} canWrite={canWrite} onOp={onOp} />
      {message.bodyHtml ? <MessageHtml html={message.bodyHtml} attachments={message.attachments} /> : <MessageText text={message.bodyText ?? ""} />}
      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((a) => (
            <a
              key={a.id}
              href={a.status === "stored" ? a.url : undefined}
              download={a.filename}
              className={cn("bg-card hover:bg-accent/50 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium", a.status !== "stored" && "pointer-events-none opacity-60")}
            >
              <FileText size={13} className="text-muted-foreground" />
              {a.filename}
              <em className="text-muted-foreground text-[11px] not-italic tabular-nums">{a.status === "skipped" ? "too large — not stored" : formatBytes(a.size)}</em>
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

interface ThreadReaderProps {
  threadId: string;
  labels: EmailLabel[];
  index: number;
  total: number;
  onStep: (delta: number) => void;
  onClose: () => void;
  onAction: (action: ThreadAction, payload?: Record<string, unknown>) => void;
  onCompose: (kind: "reply" | "reply_all" | "forward", sourceMessageId: string) => void;
  onEditDraft: (id: string) => void;
}

export function ThreadReader({ threadId, labels, index, total, onStep, onClose, onAction, onCompose, onEditDraft }: ThreadReaderProps) {
  const { detail, expanded, toggle, messageOp, lastLive } = useThreadReader(threadId, onEditDraft);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [customSnooze, setCustomSnooze] = useState("");

  if (detail.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="text-muted-foreground animate-spin" />
      </div>
    );
  }
  if (!detail.data) {
    return <div className="text-muted-foreground grid h-full place-items-center text-sm">{detail.error?.message ?? "Conversation not found."}</div>;
  }

  const { thread, messages, role } = detail.data;
  const canWrite = role !== "viewer";
  const trashed = !!thread.deletedAt;
  const spam = thread.location === "spam";
  const threadLabels = thread.labelIds.map((id) => labels.find((l) => l.id === id)).filter((l): l is EmailLabel => !!l);

  const iconButton = (label: string, icon: ReactNode, onClick: () => void, className?: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className={className}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <div className="flex items-center gap-1 border-b px-4 py-2">
        {canWrite ? (
          trashed ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction("restore")}>
                <RotateCcw /> Restore
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmPurge(true)}>
                <Trash2 /> Delete forever
              </Button>
            </>
          ) : (
            <>
              {spam ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <ShieldCheck /> Not spam
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => onAction("not_spam")}>Move to inbox</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction("not_spam", { removeRule: true })}>Move to inbox & remove sender rule</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : thread.location === "archive" ? (
                iconButton("Move to inbox", <Inbox size={15} />, () => onAction("inbox"))
              ) : (
                iconButton("Archive", <Archive size={15} />, () => onAction("archive"))
              )}
              {!spam ? (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Report spam">
                          <ShieldAlert size={15} />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Spam</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => onAction("spam")}>Mark as spam</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction("spam", { rule: "address" })}>Mark as spam & always for this sender</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onAction("spam", { rule: "domain" })}>Mark as spam & always for this domain</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {iconButton("Move to trash", <Trash2 size={15} />, () => onAction("trash"))}
              <span className="bg-border mx-1 h-5 w-px" />
              <LabelPicker labels={labels} threads={[thread]} onApply={(add, remove) => onAction("label", { add, remove })}>
                <Button variant="ghost" size="icon-sm" aria-label="Labels">
                  <Tag size={15} />
                </Button>
              </LabelPicker>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Snooze" className={thread.snoozedUntil ? "text-primary" : undefined}>
                    <Clock size={15} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {thread.snoozedUntil ? (
                    <>
                      <DropdownMenuItem onSelect={() => onAction("unsnooze")}>Unsnooze (until {new Date(thread.snoozedUntil).toLocaleString()})</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  {snoozeOptions().map((o) => (
                    <DropdownMenuItem key={o.label} onSelect={() => onAction("snooze", { snoozedUntil: o.at.toISOString() })}>
                      <span className="flex-1">{o.label}</span>
                      <span className="text-muted-foreground text-xs">{o.at.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <form
                    className="flex gap-1.5 p-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customSnooze) onAction("snooze", { snoozedUntil: new Date(customSnooze).toISOString() });
                    }}
                  >
                    <Input type="datetime-local" value={customSnooze} onChange={(e) => setCustomSnooze(e.target.value)} className="h-7 text-xs" onKeyDown={(e) => e.stopPropagation()} />
                    <Button size="xs" type="submit" disabled={!customSnooze}>
                      Set
                    </Button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
              {iconButton(thread.isPinned ? "Unpin" : "Pin", thread.isPinned ? <PinOff size={15} /> : <Pin size={15} />, () => onAction(thread.isPinned ? "unpin" : "pin"))}
              {iconButton(
                thread.hasStarred ? "Unstar" : "Star",
                <Star size={15} fill={thread.hasStarred ? "currentColor" : "none"} />,
                () => onAction(thread.hasStarred ? "unstar" : "star"),
                thread.hasStarred ? "text-primary" : undefined,
              )}
              {iconButton("Mark as unread", <MailOpen size={15} />, () => onAction("unread"))}
              {iconButton(thread.muted ? "Unmute" : "Mute", <BellOff size={15} />, () => onAction(thread.muted ? "unmute" : "mute"), thread.muted ? "text-primary" : undefined)}
            </>
          )
        ) : (
          <Badge variant="secondary">read-only</Badge>
        )}
        <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs tabular-nums">
          {index >= 0 ? `${index + 1} of ${total}` : null}
          <Button variant="ghost" size="icon-xs" aria-label="Newer" disabled={index <= 0} onClick={() => onStep(-1)}>
            <ChevronLeft size={13} />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Older" disabled={index < 0 || index >= total - 1} onClick={() => onStep(1)}>
            <ChevronRight size={13} />
          </Button>
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Close conversation" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 pt-4 pb-10">
          <span className="text-muted-foreground text-xs tabular-nums">{new Date(thread.lastMessageAt).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}</span>
          <h3 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {messages.find((m) => m.status !== "draft")?.subject || thread.subject || "(no subject)"}
            {thread.messageCount > 1 ? <Badge variant="secondary">{thread.messageCount}</Badge> : null}
            {spam ? <Badge variant="destructive">Spam</Badge> : null}
            {trashed ? <Badge variant="outline">Trash</Badge> : null}
          </h3>
          {threadLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {threadLabels.map((l) => (
                <span key={l.id} className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: l.effectiveColor ?? "var(--color-muted-foreground)" }} />
                  {labelPathName(labels, l.id)}
                  {canWrite ? (
                    <button type="button" aria-label={`Remove label ${l.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => onAction("label", { remove: [l.id] })}>
                      <X size={11} />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBlock
              key={m.id}
              message={m}
              open={expanded.has(m.id)}
              canWrite={canWrite}
              onToggle={() => toggle(m.id)}
              onReply={(kind) => onCompose(kind, m.id)}
              onOp={(op) => messageOp.mutate({ id: m.id, op })}
              onEditDraft={() => onEditDraft(m.id)}
            />
          ))}
          {messageOp.error ? <p className="text-destructive text-xs">{messageOp.error.message}</p> : null}

          {canWrite && lastLive && !trashed ? (
            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => onCompose("reply", lastLive.id)}>
                <Reply /> Reply
              </Button>
              <Button variant="outline" size="sm" onClick={() => onCompose("reply_all", lastLive.id)}>
                <CornerUpLeft /> Reply all
              </Button>
              <Button variant="outline" size="sm" onClick={() => onCompose("forward", lastLive.id)}>
                <Send /> Forward
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <Dialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete forever?</DialogTitle>
            <DialogDescription>The conversation's content and attachments are permanently removed from twodb. Nothing is deleted at the provider.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPurge(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmPurge(false);
                onAction("purge");
              }}
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
