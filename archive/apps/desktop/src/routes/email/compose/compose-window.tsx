import { useRef, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { Check, ChevronDown, Clock, FileText, Loader2, Maximize2, MailPlus, Minimize2, Paperclip, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatBytes, type EmailAccount, type EmailMessage } from "../email-api";
import { snoozeOptions } from "../reader/thread-reader";
import { RecipientInput } from "./recipient-input";
import { RichEditor } from "./rich-editor";
import { useCompose, useDraft } from "./use-compose";

const TITLES: Record<string, string> = { new: "New message", reply: "Reply", reply_all: "Reply all", forward: "Forward" };

interface ComposeWindowProps {
  draftId: string;
  accounts: EmailAccount[];
  onClose: () => void;
  onSent: (message: EmailMessage, undoSeconds: number) => void;
}

export function ComposeWindow(props: ComposeWindowProps) {
  const draft = useDraft(props.draftId);
  if (!draft.data) {
    return (
      <div className="bg-background absolute right-4 bottom-4 z-50 grid h-40 w-[min(720px,calc(100%-32px))] place-items-center rounded-2xl border shadow-2xl">
        {draft.error ? <span className="text-destructive text-sm">{draft.error.message}</span> : <Loader2 className="text-muted-foreground animate-spin" />}
      </div>
    );
  }
  if (draft.data.status !== "draft") {
    return (
      <div className="bg-background absolute right-4 bottom-4 z-50 flex w-[min(480px,calc(100%-32px))] items-center gap-3 rounded-2xl border p-4 shadow-2xl">
        <span className="flex-1 text-sm">This message is no longer a draft.</span>
        <Button size="sm" variant="outline" onClick={props.onClose}>
          Close
        </Button>
      </div>
    );
  }
  return <ComposeForm key={draft.data.id + draft.data.updatedAt} draft={draft.data} {...props} />;
}

function ComposeForm({ draft, accounts, onClose, onSent }: ComposeWindowProps & { draft: EmailMessage }) {
  const c = useCompose(draft, accounts, { onClose, onSent });
  const [expanded, setExpanded] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = draft.composeKind === "new";
  const busy = c.send.isPending || c.discard.isPending;
  const accountId = useStore(c.form.store, (st) => st.values.accountId);

  return (
    <div
      className={cn("absolute z-50", expanded ? "inset-4" : "right-4 bottom-4 w-[min(720px,calc(100%-32px))]")}
      aria-label="Compose email"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.files];
        if (files.length) c.upload.mutate(files);
      }}
    >
      <section className={cn("bg-background border-border/80 flex w-full flex-col rounded-2xl border p-4 shadow-2xl", expanded && "h-full")}>
        <header className="flex items-center justify-between gap-3 px-1.5 pb-3">
          <div className="flex items-center gap-2">
            <MailPlus size={16} className="text-muted-foreground" />
            <h2 className="text-base leading-tight font-bold">{TITLES[draft.composeKind ?? "new"]}</h2>
            <span className="text-muted-foreground text-xs">
              {c.saveState === "saving" ? "Saving…" : c.saveState === "saved" ? "Draft saved" : c.saveState === "error" ? "Not saved" : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full" aria-label={expanded ? "Shrink" : "Expand"} onClick={() => setExpanded((v) => !v)}>
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Close compose (draft is kept)" onClick={() => void c.close()}>
              <X size={15} />
            </Button>
          </div>
        </header>

        {c.error ? (
          <div className="text-destructive mb-2 flex items-center gap-2 px-1.5 text-sm" role="alert">
            {c.error}
            {c.saveState === "conflict" ? (
              <Button size="xs" variant="outline" onClick={c.reload}>
                Reload draft
              </Button>
            ) : (
              <Button size="xs" variant="ghost" onClick={() => c.setError(null)}>
                Dismiss
              </Button>
            )}
          </div>
        ) : null}

        <div className={cn("bg-card flex min-h-0 flex-col rounded-2xl border p-5", expanded && "flex-1 overflow-y-auto")}>
          <div className="flex min-h-9 items-center gap-2 py-0.5">
            <span className="w-12 shrink-0 text-sm font-semibold">From</span>
            <c.form.Subscribe selector={(s) => s.values.accountId}>
              {(accountId) => (
                <div className="flex min-w-0 flex-1 gap-2">
                  {isNew && accounts.length > 1 ? (
                    <c.form.Field name="accountId">
                      {(field) => (
                        <Select
                          value={field.state.value}
                          onValueChange={(v) => {
                            field.handleChange(v);
                            c.form.setFieldValue("fromAddress", accounts.find((a) => a.id === v)?.address ?? "");
                          }}
                        >
                          <SelectTrigger size="sm" className="max-w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.displayName ? `${a.displayName} <${a.address}>` : a.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </c.form.Field>
                  ) : null}
                  {c.fromOptions(accountId).length > 1 || !isNew || accounts.length <= 1 ? (
                    <c.form.Field name="fromAddress">
                      {(field) => (
                        <Select value={field.state.value} onValueChange={field.handleChange}>
                          <SelectTrigger size="sm" className="max-w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {c.fromOptions(accountId).map((addr) => (
                              <SelectItem key={addr} value={addr}>
                                {addr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </c.form.Field>
                  ) : null}
                </div>
              )}
            </c.form.Subscribe>
          </div>
          <div className="flex min-h-9 items-start gap-2 py-0.5">
            <label htmlFor="compose-to" className="w-12 shrink-0 pt-1 text-sm font-semibold">
              To
            </label>
            <c.form.Field name="to">
              {(field) => (
                <RecipientInput id="compose-to" accountId={accountId} value={field.state.value} onChange={field.handleChange} placeholder="Recipients" />
              )}
            </c.form.Field>
            {!c.showCc ? (
              <Button variant="secondary" size="xs" className="mt-0.5" onClick={() => c.setShowCc(true)}>
                Cc / Bcc
              </Button>
            ) : null}
          </div>
          {c.showCc ? (
            <>
              <div className="flex min-h-9 items-start gap-2 py-0.5">
                <label htmlFor="compose-cc" className="w-12 shrink-0 pt-1 text-sm font-semibold">
                  Cc
                </label>
                <c.form.Field name="cc">
                  {(field) => <RecipientInput id="compose-cc" accountId={accountId} value={field.state.value} onChange={field.handleChange} />}
                </c.form.Field>
              </div>
              <div className="flex min-h-9 items-start gap-2 py-0.5">
                <label htmlFor="compose-bcc" className="w-12 shrink-0 pt-1 text-sm font-semibold">
                  Bcc
                </label>
                <c.form.Field name="bcc">
                  {(field) => <RecipientInput id="compose-bcc" accountId={accountId} value={field.state.value} onChange={field.handleChange} />}
                </c.form.Field>
              </div>
            </>
          ) : null}
          <div className="my-2 h-px bg-border" />
          <c.form.Field name="subject">
            {(field) => (
              <Input
                aria-label="Subject"
                placeholder="Subject"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="mb-3 border-0 bg-transparent px-0 text-base font-bold shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            )}
          </c.form.Field>
          <c.form.Field name="bodyHtml">
            {(field) => <RichEditor value={field.state.value} onChange={field.handleChange} className={expanded ? "flex-1" : undefined} />}
          </c.form.Field>

          {draft.sourceMessageId ? (
            <c.form.Field name="includeQuote">
              {(field) => (
                <label className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                  <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                  {draft.composeKind === "forward" ? "Include the forwarded message" : "Quote the original message"}
                </label>
              )}
            </c.form.Field>
          ) : null}

          {(c.attachments.data ?? []).filter((a) => !a.isInline).length || c.upload.isPending ? (
            <div className="mt-4 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              {(c.attachments.data ?? [])
                .filter((a) => !a.isInline)
                .map((a) => (
                  <div key={a.id} className="bg-muted/50 group flex min-w-0 items-center gap-2 rounded-lg border p-2.5">
                    <span className="bg-card grid size-9 shrink-0 place-items-center rounded-md border">
                      <FileText size={16} className="text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-semibold">{a.filename}</strong>
                      <em className="text-muted-foreground mt-0.5 block text-[11px] not-italic">{formatBytes(a.size)}</em>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${a.filename}`}
                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                      onClick={() => c.removeAttachment.mutate(a.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              {c.upload.isPending ? (
                <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-xs">
                  <Loader2 size={14} className="animate-spin" /> Uploading…
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 pt-4 pb-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              if (files.length) c.upload.mutate(files);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Attach files" onClick={() => fileRef.current?.click()}>
            <Paperclip size={15} />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Discard draft" disabled={busy} onClick={() => c.discard.mutate()}>
            <Trash2 size={15} />
          </Button>
          <div className="ml-auto flex items-center">
            <Button className="rounded-l-full rounded-r-none" disabled={busy || c.upload.isPending} onClick={() => c.send.mutate(undefined)}>
              {c.send.isPending ? <Loader2 className="animate-spin" /> : <Send size={14} />} Send
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-l-none rounded-r-full border-l border-l-black/15 px-2" aria-label="Schedule send" disabled={busy}>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {snoozeOptions().map((o) => (
                  <DropdownMenuItem key={o.label} onSelect={() => c.send.mutate(o.at.toISOString())}>
                    <Clock /> <span className="flex-1">Send {o.label.toLowerCase()}</span>
                    <span className="text-muted-foreground text-xs">{o.at.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <form
                  className="flex gap-1.5 p-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (scheduleAt) c.send.mutate(new Date(scheduleAt).toISOString());
                  }}
                >
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="h-7 text-xs"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <Button size="xs" type="submit" disabled={!scheduleAt}>
                    <Check />
                  </Button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </footer>
      </section>
    </div>
  );
}
