import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Archive, ArrowLeft, Copy, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { useTicketPage } from "./useTicketPage";
import { PropertiesSidebar } from "./PropertiesSidebar";
import { SubtasksPanel } from "./SubtasksPanel";
import { ChecklistsPanel } from "./ChecklistsPanel";
import { LinksPanel } from "./LinksPanel";
import { DevLinksPanel } from "./DevLinksPanel";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import { ActivityFeed } from "./ActivityFeed";
import { EmptyState, Spinner } from "../../components/Visuals";
import { post } from "../../lib/api";
import { useProjectCtx } from "../../lib/project-context";

function TitleField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return <input key={value} defaultValue={value} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== value) onSave(v); else e.target.value = value; }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="w-full rounded-sm bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-stone focus:bg-stone" aria-label="Title" />;
}

export function TicketPage() {
  const { ident = "" } = useParams();
  const nav = useNavigate();
  const { project } = useProjectCtx();
  const api = useTicketPage(ident);
  const [copied, setCopied] = useState(false);
  const t = api.ticket.data;
  if (api.ticket.isLoading) return <Spinner />;
  if (!t) return <EmptyState title="Ticket not found" hint={`${ident} doesn't exist or you can't see it.`} action={<Link className="text-ion-deep underline" to={`/p/${project.key}/tickets`}>Back to tickets</Link>} />;

  const share = async () => {
    const link = await post<{ token: string }>(`/projects/${project.key}/share`, { ticketId: t.id });
    const url = `${location.origin}/share/${link.token}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    alert(`Public read-only link copied:\n${url}`);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-5">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <button onClick={() => nav(-1)} className="rounded-sm p-1 hover:bg-paper-grid" aria-label="Back"><ArrowLeft className="size-4" /></button>
          <Link to={`/p/${project.key}/tickets`} className="hover:underline">{project.name}</Link>
          {t.parent ? <><span>/</span><Link to={`/p/${project.key}/t/${t.parent.identifier}`} className="hover:underline">{t.parent.identifier}</Link></> : null}
          <span>/</span><span className="font-mono">{t.identifier}</span>
          {t.archivedAt ? <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning">Archived</span> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="ml-auto" aria-label="Ticket actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { void navigator.clipboard?.writeText(`${location.origin}/p/${project.key}/t/${t.identifier}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy />{copied ? "Copied!" : "Copy link"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void share()}><Share2 />Create public link</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => api.archive.mutate(!!t.archivedAt)}><Archive />{t.archivedAt ? "Restore" : "Archive"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={() => confirm(`Delete ${t.identifier}? This cannot be undone.`) && api.remove.mutate()}><Trash2 />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <TitleField value={t.title} onSave={(title) => api.update.mutate({ title })} />
        <RichTextEditor value={t.description} placeholder="Add a description…" onBlur={(html) => html !== t.description && api.update.mutate({ description: html })} onUploadImage={api.attachments.uploadImage} bare className="rounded-md border border-transparent hover:border-outline focus-within:border-outline" />
        <SubtasksPanel t={t} api={api} />
        <ChecklistsPanel t={t} api={api} />
        <LinksPanel t={t} api={api} />
        <DevLinksPanel t={t} api={api} />
        <AttachmentsPanel t={t} api={api} />
        <DocumentsPanel t={t} />
        <ActivityFeed t={t} api={api} />
      </div>
      <PropertiesSidebar t={t} api={api} />
    </div>
  );
}
