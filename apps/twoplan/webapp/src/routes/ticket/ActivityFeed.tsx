import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { RichTextEditor, RichTextView, isEmptyHtml } from "@twodb/editor";
import { Section } from "./Section";
import { Avatar } from "../../components/Visuals";
import { useMembers } from "../../lib/members";
import { timeAgo } from "../../lib/format";
import type { Activity, Comment, TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";

type Entry = ({ kind: "comment" } & Comment) | ({ kind: "activity" } & Activity);

function describe(a: Activity): string {
  switch (a.action) {
    case "created": return "created this ticket";
    case "archived": return "archived this ticket";
    case "restored": return "restored this ticket";
    case "attached": return `attached ${a.newValue}`;
    case "removed": return `removed ${a.oldValue}`;
    case "linked": return a.field === "development" ? `linked ${a.newValue}` : `linked ${a.field} ${a.newValue}`;
    default:
      if (a.field === "description" || a.field === "labels") return `updated ${a.field}${a.newValue ? ` (${a.newValue})` : ""}`;
      return a.oldValue ? `changed ${a.field} from ${a.oldValue} to ${a.newValue ?? "none"}` : `set ${a.field} to ${a.newValue ?? "none"}`;
  }
}

function CommentItem({ c, api }: { c: Comment; api: TicketPageApi }) {
  const { byId } = useMembers();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const author = byId(c.userId);
  const mine = !!api.me && c.userId === api.me;
  return (
    <div className="flex gap-2.5">
      <Avatar name={author?.name ?? "?"} image={author?.image} size={24} />
      <div className="min-w-0 flex-1 rounded-md border border-outline bg-card px-3 py-2">
        <div className="mb-1 flex items-center gap-2 text-xs text-ink-muted"><span className="font-medium text-ink">{author?.name ?? "Unknown"}</span>{timeAgo(c.createdAt)}{c.updatedAt !== c.createdAt ? <span>(edited)</span> : null}
          {mine && !editing ? <span className="ml-auto flex gap-1"><button aria-label="Edit comment" className="hover:text-ink" onClick={() => setEditing(true)}><Pencil className="size-3.5" /></button><button aria-label="Delete comment" className="hover:text-destructive" onClick={() => confirm("Delete this comment?") && api.removeComment.mutate(c.id)}><Trash2 className="size-3.5" /></button></span> : null}</div>
        {editing ? (
          <div className="flex flex-col gap-2"><RichTextEditor value={draft} onChange={setDraft} onUploadImage={api.attachments.uploadImage} onSubmit={() => { api.editComment.mutate({ id: c.id, body: draft }); setEditing(false); }} autofocus />
            <div className="flex gap-2"><Button size="sm" onClick={() => { api.editComment.mutate({ id: c.id, body: draft }); setEditing(false); }} disabled={isEmptyHtml(draft)}>Save</Button><Button size="sm" variant="ghost" onClick={() => { setDraft(c.body); setEditing(false); }}>Cancel</Button></div></div>
        ) : <RichTextView html={c.body} />}
      </div>
    </div>
  );
}

export function CommentComposer({ api }: { api: TicketPageApi }) {
  const [body, setBody] = useState("");
  const [key, setKey] = useState(0);
  const send = () => { if (isEmptyHtml(body)) return; api.comment.mutate(body, { onSuccess: () => { setBody(""); setKey((k) => k + 1); } }); };
  return (
    <div className="flex flex-col gap-2">
      <RichTextEditor key={key} value={body} onChange={setBody} onSubmit={send} onUploadImage={api.attachments.uploadImage} placeholder="Leave a comment…  (⌘/Ctrl+Enter to send)" />
      <div className="flex justify-end"><Button size="sm" onClick={send} disabled={isEmptyHtml(body) || api.comment.isPending}>Comment</Button></div>
    </div>
  );
}

export function ActivityFeed({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  const { nameOf } = useMembers();
  const entries: Entry[] = [
    ...t.comments.map((c) => ({ kind: "comment" as const, ...c })),
    ...(api.activity.data ?? []).filter((a) => a.action !== "commented").map((a) => ({ kind: "activity" as const, ...a })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <Section title="Activity">
      <div className="flex flex-col gap-3">
        {entries.map((e) => e.kind === "comment" ? <CommentItem key={e.id} c={e} api={api} /> : (
          <div key={e.id} className="flex items-center gap-2 pl-1 text-xs text-ink-muted"><span className="size-1.5 rounded-full bg-outline" /><span><span className="font-medium text-ink">{nameOf(e.userId)}</span> {describe(e)}</span><span className="ml-auto shrink-0">{timeAgo(e.createdAt)}</span></div>
        ))}
        <CommentComposer api={api} />
      </div>
    </Section>
  );
}
