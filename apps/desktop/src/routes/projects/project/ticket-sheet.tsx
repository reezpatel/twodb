import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Send, Trash2, Upload, X } from "lucide-react";
import type { ProjectDetail, TicketDetail } from "../use-projects";
import { useProjectMutation, useTicket, useTickets } from "../use-projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MessageMarkdown } from "@/components/message-markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Pill, PopoverPick, PropertiesGrid, PropertyRow, colorDot } from "./fields";
import { PriorityIcon, TypeIcon } from "./board";

// Ticket detail, modeled on itsaplan's IssueDetailContent: sticky identifier
// header, always-editable title textarea, markdown description, collapsible
// sections (properties / labels / deps / subtasks / checklist / activity).

const TICKET_TYPES = ["issue", "epic", "bug", "task", "feature", "chore"] as const;
const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;

function useSectionOpen(key: string, initial = true) {
  const [open, setOpen] = useState(() => {
    const v = localStorage.getItem(`twodb.ticket.${key}`);
    return v === null ? initial : v === "true";
  });
  return {
    open,
    toggle: () =>
      setOpen((v) => {
        localStorage.setItem(`twodb.ticket.${key}`, String(!v));
        return !v;
      }),
  };
}

/** Collapsible section heading — chevron + uppercase label + tally. */
function SectionHeading({
  label,
  tally,
  open,
  onToggle,
  action,
}: {
  label: string;
  tally?: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className={cn("flex h-7 items-center justify-between gap-3", open && "mb-2")}>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium tracking-wide uppercase"
        onClick={onToggle}
      >
        <Chevron size={13} />
        {label}
        {tally && <span className="tabular-nums">{tally}</span>}
      </button>
      {open && action}
    </div>
  );
}

export function TicketSheet({ ticketId, detail, open, onClose }: { ticketId: string | null; detail: ProjectDetail; open: boolean; onClose: () => void }) {
  const ticket = useTicket(ticketId ?? undefined);
  const patch = useProjectMutation(
    (body: Record<string, unknown>) => api(`/api/projects/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(body) }),
    [detail.project.id, ticketId ?? undefined],
  );
  const t = ticket.data;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {ticket.isPending || !t ? (
          <div className="text-muted-foreground p-6 text-sm">loading…</div>
        ) : (
          <>
            <TicketHeader t={t} detail={detail} onClose={onClose} />
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TicketBody t={t} detail={detail} onPatch={(b) => patch.mutate(b)} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Identifier row shared by the sheet header and the page header. */
function TicketHeader({ t, detail, onClose }: { t: TicketDetail; detail: ProjectDetail; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <TypeIcon type={t.type} />
      <span className="text-muted-foreground font-mono text-xs">{t.identifier}</span>
      {t.externalRef && (
        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
          {String((t.externalRef as { source?: string }).source ?? "synced")}
        </Badge>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        {t.externalRef && detail.project.externalSource && <PushButton ticket={t} detail={detail} />}
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X size={14} />
          </Button>
        )}
      </span>
    </div>
  );
}

/** Full-page ticket: header + content column + Properties sidebar (layout="page"). */
export function TicketPageBody({ ticketId, detail, onClose }: { ticketId: string; detail: ProjectDetail; onClose: () => void }) {
  const ticket = useTicket(ticketId);
  const patch = useProjectMutation(
    (body: Record<string, unknown>) => api(`/api/projects/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(body) }),
    [detail.project.id, ticketId],
  );
  const t = ticket.data;
  if (ticket.isPending || !t) return <div className="text-muted-foreground p-6 text-sm">loading…</div>;
  return (
    <div className="flex flex-col gap-3 px-8 py-5 xl:px-12">
      <TicketHeader t={t} detail={detail} onClose={onClose} />
      <TicketBody t={t} detail={detail} onPatch={(b) => patch.mutate(b)} layout="page" />
    </div>
  );
}

/** Ticket body in two layouts. "panel" (side sheet): everything in one column,
 * Properties a collapsible section. "page" (itsaplan's layout='page'): content
 * column on the left; on xl a fixed right sidebar holds the Properties. */
function TicketBody({
  t,
  detail,
  onPatch,
  layout = "panel",
}: {
  t: TicketDetail;
  detail: ProjectDetail;
  onPatch: (b: Record<string, unknown>) => void;
  layout?: "panel" | "page";
}) {
  const heading = (
    <>
      <TitleField value={t.title} onSave={(title) => onPatch({ title })} />
      <DescriptionEditor key={`${t.id}-${t.updatedAt}`} value={t.description} onSave={(description) => onPatch({ description })} />
    </>
  );
  const sections = (
    <>
      <div className="mt-4 border-t pt-4">
        <LabelsSection t={t} detail={detail} onPatch={onPatch} />
      </div>
      <div className="mt-4 border-t pt-4">
        <SubtasksSection t={t} detail={detail} />
      </div>
      <div className="mt-4 border-t pt-4">
        <ChecklistSection t={t} />
      </div>
      <div className="mt-4 border-t pt-4">
        <DependenciesSection t={t} detail={detail} />
      </div>
      <div className="mt-4 border-t pt-4">
        <CommentsSection t={t} />
      </div>
    </>
  );
  const properties = <PropertiesSection t={t} detail={detail} onPatch={onPatch} collapsible={false} />;

  if (layout === "page") {
    return (
      <>
        <div className="max-w-3xl xl:mr-72">
          {heading}
          <div className="mt-6 border-t pt-4 xl:hidden">{properties}</div>
          {sections}
        </div>
        <aside className="fixed top-16 right-6 hidden w-64 xl:block">
          <div className="max-h-[calc(100vh-6rem)] overflow-y-auto">{properties}</div>
        </aside>
      </>
    );
  }
  return (
    <>
      {heading}
      <div className="mt-6 border-t pt-4">
        <PropertiesSection t={t} detail={detail} onPatch={onPatch} />
      </div>
      {sections}
    </>
  );
}

/** Always-editable title — a wrapping textarea; Enter/blur commits (itsaplan's). */
function TitleField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <textarea
      ref={ref}
      dir="auto"
      rows={1}
      className="placeholder:text-muted-foreground min-w-0 flex-1 resize-none bg-transparent text-lg leading-snug font-semibold outline-none"
      style={{ fieldSizing: "content" } as React.CSSProperties}
      defaultValue={value}
      placeholder="Ticket title"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const next = e.target.value.replace(/\s+/g, " ").trim();
        e.target.value = next;
        if (next && next !== value) onSave(next);
      }}
    />
  );
}

/** Description: markdown rendered; click to edit inline, blur to save. */
function DescriptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing)
    return (
      <Textarea
        autoFocus
        className="mt-3 min-h-28 text-sm"
        value={v}
        placeholder="Add a description… (markdown)"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
        }}
        onBlur={() => {
          setEditing(false);
          if (v !== value) onSave(v);
        }}
      />
    );
  return (
    <div
      className="hover:bg-accent/30 mt-3 min-h-8 cursor-text rounded-md px-1 py-1 text-sm"
      onClick={() => {
        setV(value);
        setEditing(true);
      }}
    >
      {value ? <MessageMarkdown text={value} /> : <span className="text-muted-foreground">Add a description…</span>}
    </div>
  );
}

function PropertiesSection({
  t,
  detail,
  onPatch,
  collapsible = true,
}: {
  t: TicketDetail;
  detail: ProjectDetail;
  onPatch: (b: Record<string, unknown>) => void;
  collapsible?: boolean;
}) {
  const { open: openState, toggle } = useSectionOpen("properties");
  const open = collapsible ? openState : true;
  const statusOf = detail.statuses.find((x) => x.id === t.statusId);
  return (
    <>
      {collapsible && <SectionHeading label="Properties" open={open} onToggle={toggle} />}
      {open && (
        <PropertiesGrid>
          <PropertyRow label="Status">
            <PopoverPick
              inputPlaceholder="Change status…"
              trigger={
                <Pill active>
                  {colorDot(statusOf?.color ?? "#888")}
                  <span className="truncate">{statusOf?.name ?? "Status"}</span>
                </Pill>
              }
              items={detail.statuses
                .filter((x) => x.subprojectId === null || x.subprojectId === t.subprojectId)
                .map((x) => ({
                  key: x.id,
                  search: x.name,
                  icon: colorDot(x.color),
                  label: x.name,
                  selected: x.id === t.statusId,
                  onSelect: () => onPatch({ statusId: x.id }),
                }))}
            />
          </PropertyRow>
          <PropertyRow label="Type">
            <PopoverPick
              inputPlaceholder="Change type…"
              trigger={
                <Pill active>
                  <TypeIcon type={t.type} />
                  <span className="capitalize">{t.type}</span>
                </Pill>
              }
              items={TICKET_TYPES.map((x) => ({
                key: x,
                search: x,
                label: x[0].toUpperCase() + x.slice(1),
                selected: x === t.type,
                onSelect: () => onPatch({ type: x }),
              }))}
            />
          </PropertyRow>
          <PropertyRow label="Priority">
            <PopoverPick
              inputPlaceholder="Change priority…"
              trigger={
                <Pill active={t.priority !== "none"}>
                  <PriorityIcon priority={t.priority} />
                  <span className="capitalize">{t.priority}</span>
                </Pill>
              }
              items={PRIORITIES.map((x) => ({
                key: x,
                search: x,
                label: x[0].toUpperCase() + x.slice(1),
                selected: x === t.priority,
                onSelect: () => onPatch({ priority: x }),
              }))}
            />
          </PropertyRow>
          <PropertyRow label="Assignee">
            <PopoverPick
              inputPlaceholder="Assign to…"
              trigger={
                <Pill active={!!t.assigneeUserId}>
                  <span className="truncate">{t.assignee?.name ?? "Unassigned"}</span>
                </Pill>
              }
              items={[
                { key: "none", search: "unassigned", label: "Unassigned", selected: !t.assigneeUserId, onSelect: () => onPatch({ assigneeUserId: null }) },
                ...detail.members.map((m) => ({
                  key: m.userId,
                  search: m.name,
                  label: m.name,
                  selected: m.userId === t.assigneeUserId,
                  onSelect: () => onPatch({ assigneeUserId: m.userId }),
                })),
              ]}
            />
          </PropertyRow>
          <PropertyRow label="Estimate">
            <EstimatePill value={t.estimate} onChange={(estimate) => onPatch({ estimate })} />
          </PropertyRow>
          <PropertyRow label="Subproject">
            <PopoverPick
              inputPlaceholder="Move to…"
              trigger={
                <Pill active>
                  <span className="truncate">{detail.subprojects.find((x) => x.id === t.subprojectId)?.name ?? "Subproject"}</span>
                </Pill>
              }
              items={detail.subprojects.map((x) => ({
                key: x.id,
                search: x.name,
                label: x.name,
                selected: x.id === t.subprojectId,
                onSelect: () => onPatch({ subprojectId: x.id }),
              }))}
            />
          </PropertyRow>
          <PropertyRow label="Milestone">
            <PopoverPick
              inputPlaceholder="Set milestone…"
              trigger={
                <Pill active={!!t.milestoneId}>
                  <span className="truncate">{detail.milestones.find((x) => x.id === t.milestoneId)?.name ?? "None"}</span>
                </Pill>
              }
              items={[
                { key: "none", search: "none", label: "No milestone", selected: !t.milestoneId, onSelect: () => onPatch({ milestoneId: null }) },
                ...detail.milestones
                  .filter((m) => m.status === "open")
                  .map((m) => ({ key: m.id, search: m.name, label: m.name, selected: m.id === t.milestoneId, onSelect: () => onPatch({ milestoneId: m.id }) })),
              ]}
            />
          </PropertyRow>
          <PropertyRow label="Sprint">
            <PopoverPick
              inputPlaceholder="Plan into…"
              trigger={
                <Pill active={!!t.sprintId}>
                  <span className="truncate">{detail.sprints.find((x) => x.id === t.sprintId)?.name ?? "None"}</span>
                </Pill>
              }
              items={[
                { key: "none", search: "none", label: "No sprint", selected: !t.sprintId, onSelect: () => onPatch({ sprintId: null }) },
                ...detail.sprints
                  .filter((sp) => sp.status !== "closed")
                  .map((sp) => ({
                    key: sp.id,
                    search: sp.name,
                    label: sp.name,
                    selected: sp.id === t.sprintId,
                    onSelect: () => onPatch({ sprintId: sp.id, inBacklog: false }),
                  })),
              ]}
            />
          </PropertyRow>
          <PropertyRow label="Backlog">
            <Pill active={t.inBacklog} onClick={() => onPatch({ inBacklog: !t.inBacklog })}>
              {t.inBacklog ? "In backlog" : "Not in backlog"}
            </Pill>
          </PropertyRow>
        </PropertiesGrid>
      )}
    </>
  );
}

function EstimatePill({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <Pill
        active={value != null}
        onClick={() => {
          setV(value?.toString() ?? "");
          setOpen((o) => !o);
        }}
      >
        {value != null ? `${value} pts` : "Set estimate"}
      </Pill>
      {open && (
        <form
          className="inline-flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const n = v.trim() === "" ? null : Number(v);
            if (n === null || (Number.isFinite(n) && n >= 0)) onChange(n);
            setOpen(false);
          }}
        >
          <Input
            autoFocus
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="h-7 w-16 text-xs"
            placeholder="pts"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          />
        </form>
      )}
    </span>
  );
}

function LabelsSection({ t, detail, onPatch }: { t: TicketDetail; detail: ProjectDetail; onPatch: (b: Record<string, unknown>) => void }) {
  const { open, toggle } = useSectionOpen("labels");
  const labelIds = new Set(t.labels.map((l) => l.id));
  const tagIds = new Set(t.tags.map((x) => x.id));
  return (
    <>
      <SectionHeading
        label="Labels & tags"
        tally={t.labels.length + t.tags.length > 0 ? String(t.labels.length + t.tags.length) : undefined}
        open={open}
        onToggle={toggle}
      />
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {detail.labels.map((l) => (
            <button
              key={l.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                labelIds.has(l.id) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              style={{ borderColor: labelIds.has(l.id) ? l.color : undefined, backgroundColor: labelIds.has(l.id) ? `${l.color}22` : undefined }}
              onClick={() => onPatch({ labelIds: labelIds.has(l.id) ? [...labelIds].filter((x) => x !== l.id) : [...labelIds, l.id] })}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </button>
          ))}
          {detail.tags.map((tag) => (
            <button
              key={tag.id}
              className={cn(
                "flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs",
                tagIds.has(tag.id) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              style={{ borderColor: tag.color, backgroundColor: tagIds.has(tag.id) ? `${tag.color}22` : undefined }}
              onClick={() => onPatch({ tagIds: tagIds.has(tag.id) ? [...tagIds].filter((x) => x !== tag.id) : [...tagIds, tag.id] })}
            >
              #{tag.name}
            </button>
          ))}
          {detail.labels.length === 0 && detail.tags.length === 0 && (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">No labels or tags — add them in project Settings.</p>
          )}
        </div>
      )}
    </>
  );
}

function SubtasksSection({ t, detail }: { t: TicketDetail; detail: ProjectDetail }) {
  const { open, toggle } = useSectionOpen("subtasks");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const create = useProjectMutation(
    (x: string) =>
      api(`/api/projects/projects/${detail.project.id}/tickets`, {
        method: "POST",
        body: JSON.stringify({ title: x, subprojectId: t.subprojectId, parentTicketId: t.id }),
      }),
    [detail.project.id],
  );
  return (
    <>
      <SectionHeading
        label="Subtasks"
        tally={t.subtasks.length > 0 ? String(t.subtasks.length) : undefined}
        open={open}
        onToggle={toggle}
        action={
          !t.parentTicketId ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setAdding(true)}>
              <Plus size={13} /> Add
            </Button>
          ) : undefined
        }
      />
      {open && (
        <div className="flex flex-col gap-0.5">
          {t.subtasks.map((s) => (
            <div key={s.id} className="hover:bg-accent/50 flex items-center gap-2 rounded px-1.5 py-1 text-sm">
              <TypeIcon type={s.type} />
              <span className="text-muted-foreground font-mono text-[11px]">{s.identifier}</span>
              <span className="truncate">{s.title}</span>
            </div>
          ))}
          {t.subtasks.length === 0 && !adding && (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
              No subtasks — small steps that don't need their own checklist.
            </p>
          )}
          {adding && (
            <form
              className="mt-1"
              onSubmit={(e) => {
                e.preventDefault();
                const x = title.trim();
                if (!x) return;
                setTitle("");
                setAdding(false);
                create.mutate(x);
              }}
            >
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => !title.trim() && setAdding(false)}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                placeholder="Subtask title…"
                className="h-8 text-sm"
              />
            </form>
          )}
        </div>
      )}
    </>
  );
}

function ChecklistSection({ t }: { t: TicketDetail }) {
  const { open, toggle } = useSectionOpen("checklist");
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const add = useProjectMutation(
    (b: { text: string; parentItemId?: string }) => api(`/api/projects/tickets/${t.id}/checklist`, { method: "POST", body: JSON.stringify(b) }),
    [t.id],
  );
  const patch = useProjectMutation(
    ({ id, ...body }: { id: string; done?: boolean }) => api(`/api/projects/checklist/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    [t.id],
  );
  const remove = useProjectMutation((itemId: string) => api(`/api/projects/checklist/${itemId}`, { method: "DELETE" }), [t.id]);

  const roots = t.checklist.filter((i) => !i.parentItemId);
  const childrenOf = (id: string) => t.checklist.filter((i) => i.parentItemId === id);
  const total = t.checklist.length;
  const done = t.checklist.filter((i) => i.done).length;

  return (
    <>
      <SectionHeading
        label="Checklist"
        tally={total > 0 ? `${done}/${total}` : undefined}
        open={open}
        onToggle={toggle}
        action={
          <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setAdding(true)}>
            <Plus size={13} /> Add
          </Button>
        }
      />
      {open && (
        <div className="flex flex-col gap-1">
          {roots.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <ChecklistRow
                item={item}
                onToggle={(d) => patch.mutate({ id: item.id, done: d })}
                onDelete={() => remove.mutate(item.id)}
                onAddSub={(txt) => add.mutate({ text: txt, parentItemId: item.id })}
              />
              {childrenOf(item.id).map((child) => (
                <div key={child.id} className="pl-6">
                  <ChecklistRow item={child} onToggle={(d) => patch.mutate({ id: child.id, done: d })} onDelete={() => remove.mutate(child.id)} />
                </div>
              ))}
            </div>
          ))}
          {t.checklist.length === 0 && !adding && (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">No checklist items yet.</p>
          )}
          {adding && (
            <form
              className="mt-1"
              onSubmit={(e) => {
                e.preventDefault();
                const x = text.trim();
                if (!x) return;
                setText("");
                setAdding(false);
                add.mutate({ text: x });
              }}
            >
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => !text.trim() && setAdding(false)}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                placeholder="Checklist item…"
                className="h-8 text-sm"
              />
            </form>
          )}
        </div>
      )}
    </>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onDelete,
  onAddSub,
}: {
  item: { id: string; text: string; done: boolean };
  onToggle: (done: boolean) => void;
  onDelete: () => void;
  onAddSub?: (text: string) => void;
}) {
  const [addingSub, setAddingSub] = useState(false);
  const [sub, setSub] = useState("");
  return (
    <div className="group flex items-center gap-2 text-sm">
      <Checkbox checked={item.done} onCheckedChange={(c) => onToggle(c === true)} />
      <span className={cn("min-w-0 flex-1 truncate", item.done && "text-muted-foreground line-through")}>{item.text}</span>
      {onAddSub && (
        <button className="text-muted-foreground opacity-0 group-hover:opacity-100" title="Add sub-item" onClick={() => setAddingSub((v) => !v)}>
          <Plus size={12} />
        </button>
      )}
      <button className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={onDelete} title="Delete">
        <Trash2 size={12} />
      </button>
      {addingSub && (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const x = sub.trim();
            if (x) {
              onAddSub?.(x);
              setSub("");
              setAddingSub(false);
            }
          }}
        >
          <Input value={sub} onChange={(e) => setSub(e.target.value)} className="h-6 w-32 text-xs" autoFocus />
        </form>
      )}
    </div>
  );
}

function DependenciesSection({ t, detail }: { t: TicketDetail; detail: ProjectDetail }) {
  const { open, toggle } = useSectionOpen("deps");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const all = useTickets(detail.project.id);
  const addDep = useProjectMutation(
    (dependsOnTicketId: string) => api(`/api/projects/tickets/${t.id}/dependencies`, { method: "POST", body: JSON.stringify({ dependsOnTicketId }) }),
    [detail.project.id],
  );
  const removeDep = useProjectMutation(
    (depId: string) => api(`/api/projects/tickets/${t.id}/dependencies/${depId}`, { method: "DELETE" }),
    [detail.project.id],
  );
  const candidates = (all.data ?? []).filter((x) => x.id !== t.id && `${x.identifier} ${x.title}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  return (
    <>
      <SectionHeading
        label="Dependencies"
        tally={t.blockedBy.length > 0 ? String(t.blockedBy.length) : undefined}
        open={open}
        onToggle={toggle}
        action={
          <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setAdding(true)}>
            <Plus size={13} /> Add
          </Button>
        }
      />
      {open && (
        <div className="flex flex-col gap-1.5">
          {t.blockedBy.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <span className="text-amber-500 text-[10px] font-semibold uppercase">blocked by</span>
              <span className="text-muted-foreground font-mono text-[11px]">{d.identifier}</span>
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => removeDep.mutate(d.id)} title="Remove">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {t.blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">blocks</span>
              <span className="text-muted-foreground font-mono text-[11px]">{b.identifier}</span>
              <span className="min-w-0 flex-1 truncate">{b.title}</span>
            </div>
          ))}
          {t.blockedBy.length === 0 && t.blocks.length === 0 && !adding && (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">No dependencies — tickets this one is blocked by.</p>
          )}
          {adding && (
            <div className="relative mt-1">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                placeholder="Blocked by… (search tickets)"
                className="h-8 text-sm"
              />
              {query && (
                <div className="bg-popover absolute z-10 mt-1 w-full rounded-md border shadow-md">
                  {candidates.map((cand) => (
                    <button
                      key={cand.id}
                      className="hover:bg-accent flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
                      onClick={() => {
                        setQuery("");
                        setAdding(false);
                        addDep.mutate(cand.id);
                      }}
                    >
                      <span className="text-muted-foreground font-mono text-[11px]">{cand.identifier}</span>
                      <span className="truncate">{cand.title}</span>
                    </button>
                  ))}
                  {candidates.length === 0 && <p className="text-muted-foreground px-2 py-1.5 text-xs">no matches</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CommentsSection({ t }: { t: TicketDetail }) {
  const { open, toggle } = useSectionOpen("comments");
  const [body, setBody] = useState("");
  const add = useProjectMutation((b: string) => api(`/api/projects/tickets/${t.id}/comments`, { method: "POST", body: JSON.stringify({ body: b }) }), [t.id]);
  return (
    <>
      <SectionHeading label="Activity" tally={t.comments.length > 0 ? String(t.comments.length) : undefined} open={open} onToggle={toggle} />
      {open && (
        <div className="flex flex-col gap-3">
          {t.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="size-6 shrink-0">
                {c.userImage && <AvatarImage src={c.userImage} />}
                <AvatarFallback className="text-[9px]">{c.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{c.userName}</span>
                  <span className="text-muted-foreground text-[10px]">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <MessageMarkdown text={c.body} />
                </div>
              </div>
            </div>
          ))}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const b = body.trim();
              if (!b) return;
              setBody("");
              add.mutate(b);
            }}
          >
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment… (markdown)" rows={2} className="text-sm" />
            <Button size="sm" type="submit" disabled={!body.trim()} className="shrink-0">
              <Send size={12} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

/** Push-back flow for synced tickets: fetch the diff, show what changes remotely, confirm. */
function PushButton({ ticket, detail }: { ticket: TicketDetail; detail: ProjectDetail }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<{ field: string; local: string; remote: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api<{ changes: { field: string; local: string; remote: string }[] }>(`/api/projects/sync/tickets/${ticket.id}/diff`);
      setDiff(r.changes);
      setOpen(true);
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/sync/tickets/${ticket.id}/push`, { method: "POST" });
      setResult("Pushed.");
      setOpen(false);
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  void detail;

  return (
    <>
      <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-[10px]" disabled={busy} onClick={() => void load()}>
        <Upload size={10} /> Push
      </Button>
      {result && <span className="text-muted-foreground text-[10px]">{result}</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Push to {detail.project.externalSource}</DialogTitle>
          </DialogHeader>
          {diff === null ? (
            <p className="text-muted-foreground text-xs">loading…</p>
          ) : diff.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Check size={12} className="text-success" /> Remote is up to date.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs">These fields will be updated on the remote:</p>
              <div className="flex flex-col gap-1.5">
                {diff.map((d) => (
                  <div key={d.field} className="rounded-md border p-2 text-xs">
                    <span className="font-mono font-semibold">{d.field}</span>
                    <div className="text-destructive mt-1 line-through">{d.remote || "—"}</div>
                    <div className="text-success">{d.local || "—"}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={busy} onClick={() => void push()}>
                  {busy ? "Pushing…" : "Confirm push"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
