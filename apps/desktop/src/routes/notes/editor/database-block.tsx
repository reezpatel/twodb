import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useNavigate } from "react-router";
import { Database, Loader2, Maximize2, Plus } from "lucide-react";
import { useNotesView, type NoteProperty } from "../view/use-notes-view";
import { assetPreviewUrl, useNode } from "../use-notes-scene";

const MAX_COLUMNS = 4;

function formatValue(prop: NoteProperty, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (prop.type === "checkbox") return value ? "✓" : "";
  if (prop.type === "date") return new Date(String(value)).toLocaleDateString();
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Embedded database — compact table of its rows. The database itself is a
 *  child node of the page; this block only references it by id. Removing the
 *  block leaves the database dangling (never deleted). */
function DatabaseBlockView({ node, selected }: NodeViewProps) {
  const databaseId = String(node.attrs.databaseId ?? "");
  const navigate = useNavigate();
  const meta = useNode(databaseId || null);
  const view = useNotesView(databaseId || null);
  const rows = view.payload.data?.notes ?? [];
  const columns = (view.payload.data?.columns ?? []).slice(0, MAX_COLUMNS);
  const iconUrl = assetPreviewUrl(meta.data?.icon);

  const open = (id: string) => navigate(`/apps/notes/${id}`);
  const addRow = async () => {
    const { noteId } = await view.createNote.mutateAsync({});
    open(noteId);
  };

  return (
    <NodeViewWrapper className="note-database-block my-3" data-selected={selected ? "true" : undefined} contentEditable={false}>
      <div className="flex items-center gap-2 pb-1.5">
        {iconUrl ? <img src={iconUrl} alt="" className="size-5 rounded object-contain" /> : <Database size={16} className="text-muted-foreground" />}
        <button className="min-w-0 truncate text-base font-semibold hover:underline" onClick={() => open(databaseId)}>
          {meta.data?.title || "Untitled database"}
        </button>
        <span className="text-muted-foreground/60 text-xs">{rows.length}</span>
        <button className="text-muted-foreground/60 hover:text-foreground ml-auto" title="Open as full page" onClick={() => open(databaseId)}>
          <Maximize2 size={13} />
        </button>
      </div>

      {view.payload.isPending ? (
        <div className="flex h-16 items-center justify-center border-y">
          <Loader2 size={14} className="text-muted-foreground animate-spin" />
        </div>
      ) : view.payload.isError ? (
        <p className="text-muted-foreground border-y py-3 text-xs">This database is unavailable.</p>
      ) : (
        <div className="overflow-x-auto border-t text-[13px]">
          <div className="text-muted-foreground flex border-b text-xs">
            <div className="w-64 shrink-0 truncate px-2 py-1.5">Name</div>
            {columns.map((c) => (
              <div key={c.id} className="w-36 shrink-0 truncate border-l px-2 py-1.5">
                {c.name}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.noteId} className="hover:bg-accent/40 flex cursor-pointer border-b" onClick={() => open(row.noteId)}>
              <div className="w-64 shrink-0 truncate px-2 py-1.5 font-medium">{row.title || row.preview || "Untitled"}</div>
              {columns.map((c) => (
                <div key={c.id} className="text-muted-foreground w-36 shrink-0 truncate border-l px-2 py-1.5">
                  {formatValue(c, row.props[c.id])}
                </div>
              ))}
            </div>
          ))}
          <button
            className="text-muted-foreground hover:bg-accent/40 hover:text-foreground flex h-8 w-full items-center gap-1.5 border-b px-2 text-left text-xs"
            onClick={() => void addRow()}
            disabled={view.createNote.isPending}
          >
            <Plus size={13} /> New
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const DatabaseBlock = Node.create({
  name: "databaseBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { databaseId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-database-block]", getAttrs: (el) => ({ databaseId: (el as HTMLElement).getAttribute("data-database-id") }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-database-block": "", "data-database-id": HTMLAttributes.databaseId })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DatabaseBlockView);
  },
});
