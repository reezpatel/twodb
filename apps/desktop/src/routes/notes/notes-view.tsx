import { useEffect, useMemo, useState } from "react";
import { Columns3, KanbanSquare, List, Loader2, NotebookPen, Plus, Table2, Trash2, X } from "lucide-react";
import { useNotesView, NOTE_PROPERTY_TYPES, NOTE_VIEW_TYPES, type NoteProperty, type NoteRecord, type NoteViewType } from "./use-notes-view";
import { NoteEditor, PropertyCell } from "./note-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const VIEW_ICON: Record<NoteViewType, typeof Table2> = { table: Table2, list: List, kanban: KanbanSquare };

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatValue(prop: NoteProperty, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (prop.type === "checkbox") return value ? "✓" : "✗";
  if (prop.type === "date") return new Date(String(value)).toLocaleDateString();
  return String(value);
}

/** Slide-in editor anchored to the right edge of the screen. */
function FloatNoteEditor({
  note,
  columns,
  view,
  onClose,
}: {
  note: NoteRecord;
  columns: NoteProperty[];
  view: ReturnType<typeof useNotesView>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={onClose}>
      <div
        className="bg-card border-l flex w-[36rem] max-w-full flex-col border-l shadow-xl"
        style={{ animation: "noteFloatIn 0.16s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b flex items-center gap-2 border-b px-3 py-2">
          <NotebookPen size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{note.preview || "(empty)"}</span>
          <button className="text-muted-foreground/70 hover:text-foreground text-xs leading-none" title="Close (Esc)" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <NoteEditor key={note.noteId} note={note} columns={columns} view={view} onClose={onClose} />
      </div>
    </div>
  );
}

export function NotesView({ groupId }: { groupId: string }) {
  const view = useNotesView(groupId);
  const { payload } = view;
  const notes = payload.data?.notes ?? [];
  const columns = payload.data?.columns ?? [];
  const activeView = view.activeView;

  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [addingProperty, setAddingProperty] = useState(false);
  const [propName, setPropName] = useState("");
  const [propType, setPropType] = useState<string>("text");
  const [propOptions, setPropOptions] = useState("");

  const openNote = notes.find((n) => n.noteId === openNoteId) ?? null;

  const groupByProp = useMemo(() => columns.find((c) => c.id === activeView?.groupBy && c.type === "select") ?? null, [columns, activeView?.groupBy]);

  if (payload.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground animate-spin" size={18} />
      </div>
    );
  }

  const HeaderMenu = ({ prop }: { prop: NoteProperty }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs font-medium">
          {prop.name}
          <span className="text-muted-foreground/60 text-[10px] font-normal">{prop.type}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => {
            const name = window.prompt("Property name", prop.name);
            if (name && name.trim()) view.renameProperty.mutate({ id: prop.id, name: name.trim() });
          }}
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change type</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {NOTE_PROPERTY_TYPES.map((t) => (
              <DropdownMenuItem key={t} disabled={t === prop.type} onSelect={() => view.setPropertyType.mutate({ id: prop.id, type: t })}>
                {t}
                {t === prop.type && (
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    current
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => window.confirm(`Delete property "${prop.name}" and its values?`) && view.deleteProperty.mutate(prop.id)}
        >
          <Trash2 size={13} /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* view bar */}
      <div className="border-b flex items-center gap-1 border-b px-3 py-1.5">
        {view.views.map((v) => {
          const Icon = VIEW_ICON[v.type];
          return (
            <button
              key={v.id}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs",
                activeView?.id === v.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60",
              )}
              onClick={() => view.setActiveViewId(v.id)}
            >
              <Icon size={13} />
              {v.name}
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-muted-foreground hover:bg-accent/60 hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md"
              title="Add view"
            >
              <Plus size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {NOTE_VIEW_TYPES.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => view.addView.mutate({ type: t })}>
                {(() => {
                  const Icon = VIEW_ICON[t];
                  return <Icon size={13} />;
                })()}
                {t[0].toUpperCase() + t.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1">
          {activeView?.type === "kanban" && columns.filter((c) => c.type === "select").length > 0 && (
            <select
              className="border-input bg-background h-7 rounded-md border px-2 text-xs"
              value={groupByProp?.id ?? ""}
              onChange={(e) => view.updateView.mutate({ id: activeView.id, groupBy: e.target.value || null })}
              title="Group by"
            >
              <option value="">Group by…</option>
              {columns
                .filter((c) => c.type === "select")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddingProperty((p) => !p)} title="Add property">
            <Columns3 size={13} /> Property
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => view.createNote.mutate({ text: "" })} disabled={view.createNote.isPending}>
            <Plus size={13} /> Note
          </Button>
        </div>
      </div>

      {addingProperty && (
        <div className="border-b flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Input autoFocus className="h-7 w-40 text-xs" placeholder="Property name" value={propName} onChange={(e) => setPropName(e.target.value)} />
          <select className="border-input bg-background h-7 rounded-md border px-2 text-xs" value={propType} onChange={(e) => setPropType(e.target.value)}>
            {NOTE_PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {propType === "select" && (
            <Input
              className="h-7 w-64 text-xs"
              placeholder="Options, comma separated (todo, doing, done)"
              value={propOptions}
              onChange={(e) => setPropOptions(e.target.value)}
            />
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!propName.trim()}
            onClick={() => {
              view.addProperty.mutate({
                name: propName.trim(),
                type: propType as NoteProperty["type"],
                ...(propType === "select"
                  ? {
                      options: propOptions
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }
                  : {}),
              });
              setPropName("");
              setPropOptions("");
              setAddingProperty(false);
            }}
          >
            Add
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddingProperty(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* body */}
      <div className="flex min-h-0 flex-1">
        {activeView?.type === "table" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64 text-xs">Preview</TableHead>
                  {columns.map((prop) => (
                    <TableHead key={prop.id} className="text-xs">
                      <HeaderMenu prop={prop} />
                    </TableHead>
                  ))}
                  <TableHead className="w-16 text-xs">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note) => (
                  <TableRow key={note.noteId} className="group h-9">
                    <TableCell
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        setOpenNoteId(note.noteId);
                      }}
                    >
                      <span className="block max-w-60 truncate">{note.preview || "(empty)"}</span>
                    </TableCell>
                    {columns.map((prop) => (
                      <TableCell key={prop.id} className="text-xs">
                        <PropertyCell
                          value={note.props[prop.id]}
                          prop={prop}
                          onCommit={(value) => view.updateNote.mutate({ noteId: note.noteId, props: { [prop.id]: value } })}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-muted-foreground text-xs">{relativeTime(note.updatedAt)}</TableCell>
                  </TableRow>
                ))}
                {notes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="text-muted-foreground/70 py-8 text-center text-xs">
                      No notes yet — hit “Note” to create the first one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeView?.type === "list" && (
          <>
            <div className="bg-card/40 border-r flex w-72 shrink-0 flex-col overflow-y-auto border-r">
              {notes.map((note) => (
                <div
                  key={note.noteId}
                  className={cn(
                    "group flex cursor-pointer flex-col gap-1 border-b border-b px-3 py-2.5 last:border-b-0 hover:bg-accent/40",
                    openNoteId === note.noteId && "bg-accent/60",
                  )}
                  onClick={() => setOpenNoteId(note.noteId)}
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs">{note.preview || "(empty)"}</span>
                    <button
                      className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-destructive text-xs leading-none"
                      title="Delete note"
                      onClick={(e) => {
                        e.stopPropagation();
                        view.deleteNote.mutate(note.noteId);
                        if (openNoteId === note.noteId) setOpenNoteId(null);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {columns.some((prop) => note.props[prop.id] !== null && note.props[prop.id] !== undefined) && (
                    <div className="flex flex-wrap gap-1">
                      {columns
                        .filter((prop) => note.props[prop.id] !== null && note.props[prop.id] !== undefined)
                        .map((prop) => (
                          <Badge key={prop.id} variant="secondary" className="text-[10px] font-normal">
                            {prop.name}: {formatValue(prop, note.props[prop.id])}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              ))}
              {notes.length === 0 && <p className="text-muted-foreground/70 p-6 text-center text-xs">No notes yet.</p>}
            </div>
            {openNote ? (
              <NoteEditor key={openNote.noteId} note={openNote} columns={columns} view={view} onClose={() => setOpenNoteId(null)} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground/70 text-xs">Pick a note to edit it here.</p>
              </div>
            )}
          </>
        )}

        {activeView?.type === "kanban" &&
          (groupByProp ? (
            <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3">
              {[...(groupByProp.options ?? []), null].map((option) => {
                const value = option?.value ?? null;
                const bucket = notes.filter((n) => (n.props[groupByProp.id] ?? null) === value);
                return (
                  <div
                    key={option?.value ?? "unassigned"}
                    className="bg-muted/40 flex w-56 shrink-0 flex-col gap-2 rounded-lg p-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const noteId = e.dataTransfer.getData("text/plain");
                      if (noteId) view.updateNote.mutate({ noteId, props: { [groupByProp.id]: value } });
                    }}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-semibold">{option?.value ?? "Unassigned"}</span>
                      <button
                        className="text-muted-foreground/70 hover:text-foreground text-xs"
                        title="Add note"
                        onClick={() => view.createNote.mutate({ text: "", props: { [groupByProp.id]: value } })}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    {bucket.map((note) => (
                      <div
                        key={note.noteId}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", note.noteId)}
                        className="bg-card cursor-pointer rounded-md border p-2 text-xs shadow-xs hover:bg-accent/40"
                        onClick={() => setOpenNoteId(note.noteId)}
                      >
                        <span className="block truncate">{note.preview || "(empty)"}</span>
                      </div>
                    ))}
                    {bucket.length === 0 && <p className="text-muted-foreground/40 px-1 py-2 text-center text-[10px]">drop here</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-muted-foreground/70 text-xs">
                Add a <span className="font-medium">select</span> property and pick it in “Group by…” to build the board.
              </p>
            </div>
          ))}
      </div>

      {/* floating editor for table / kanban */}
      {openNote && activeView?.type !== "list" && <FloatNoteEditor note={openNote} columns={columns} view={view} onClose={() => setOpenNoteId(null)} />}
    </div>
  );
}
