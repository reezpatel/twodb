import { useMemo, useState } from "react";
import { KanbanSquare, List, Loader2, Plus, Table2 } from "lucide-react";
import { useNotesView, NOTE_PROPERTY_TYPES, NOTE_VIEW_TYPES, type NoteProperty, type NoteViewType } from "./use-notes-view";
import { TableView } from "./table-view";
import { ListView } from "./list-view";
import { KanbanView } from "./kanban-view";
import { FloatNoteEditor } from "./float-note-editor";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const VIEW_ICON: Record<NoteViewType, typeof Table2> = { table: Table2, list: List, kanban: KanbanSquare };

export function NotesView({ groupId, openNoteId, setOpenNoteId }: { groupId: string; openNoteId: string | null; setOpenNoteId: (id: string | null) => void }) {
  const view = useNotesView(groupId);
  const { payload } = view;
  const notes = payload.data?.notes ?? [];
  const columns = payload.data?.columns ?? [];
  const activeView = view.activeView;

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
          {propType === "status" && (
            <p className="text-muted-foreground/70 text-[10px]">
              Defaults to <span className="font-medium">To Do, In Progress, Completed</span> (editable in the Options list).
            </p>
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
          <TableView notes={notes} columns={columns} view={view} setOpenNoteId={setOpenNoteId} onAddProperty={() => setAddingProperty(true)} />
        )}
        {activeView?.type === "list" && <ListView notes={notes} columns={columns} view={view} openNoteId={openNoteId} setOpenNoteId={setOpenNoteId} />}
        {activeView?.type === "kanban" && <KanbanView notes={notes} columns={columns} view={view} groupByProp={groupByProp} setOpenNoteId={setOpenNoteId} />}
      </div>

      {/* floating editor for table / kanban */}
      {openNote && activeView?.type !== "list" && <FloatNoteEditor note={openNote} columns={columns} view={view} onClose={() => setOpenNoteId(null)} />}
    </div>
  );
}
