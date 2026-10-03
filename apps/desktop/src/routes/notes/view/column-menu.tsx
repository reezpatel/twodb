import { useState } from "react";
import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, MoreHorizontal, Trash2 } from "lucide-react";
import { NOTE_PROPERTY_TYPES, type NoteProperty, type NotesViewHook } from "./use-notes-view";
import { Badge } from "@/components/ui/badge";
import { ColumnEditProperty } from "@/components/ui/column-edit-property";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

interface BaseProps<TData> {
  column: Column<TData, unknown>;
}

interface PropertyProps<TData> extends BaseProps<TData> {
  prop: NoteProperty;
  view: NotesViewHook;
  onInsertColumn: (side: "left" | "right") => void;
}

export type ColumnMenuProps<TData> = BaseProps<TData> & Partial<Omit<PropertyProps<TData>, keyof BaseProps<TData>>>;

/**
 * Unified per-column dropdown menu. Click the column header to open it.
 *
 * Always-available items: Sort Ascending / Sort Descending / Clear Sort /
 * Hide (or Show) Column.
 *
 * Property columns additionally get: Rename, Change Type (submenu of all
 * NoteProperty types), Insert Column Left / Right, Delete Column.
 *
 * The sort indicator is rendered inline in the trigger next to the label so
 * the active direction is visible without opening the menu.
 */
export function ColumnMenu<TData>(props: ColumnMenuProps<TData>) {
  const { column } = props;
  const label = column.columnDef.header && typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
  const sortDir = column.getIsSorted();
  const [editing, setEditing] = useState(false);

  const rename = () => {
    if (!props.prop || !props.view) return;
    const name = window.prompt("Property name", props.prop.name);
    if (name && name.trim()) props.view.renameProperty.mutate({ id: props.prop.id, name: name.trim() });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hover:bg-accent flex h-full w-full cursor-pointer items-center gap-1 rounded px-1 text-left text-xs font-medium">
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {sortDir === "asc" && <ArrowUp size={11} className="shrink-0" />}
            {sortDir === "desc" && <ArrowDown size={11} className="shrink-0" />}
            {props.prop && <span className="text-muted-foreground/60 ml-0.5 shrink-0 text-[10px] font-normal">{props.prop.type}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={!column.getCanSort()} onSelect={() => column.toggleSorting(false)}>
            <ArrowUp size={13} /> Sort ascending
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!column.getCanSort()} onSelect={() => column.toggleSorting(true)}>
            <ArrowDown size={13} /> Sort descending
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!column.getCanSort() || !sortDir} onSelect={() => column.clearSorting()}>
            Clear sort
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => column.toggleVisibility()}>{column.getIsVisible() ? "Hide column" : "Show column"}</DropdownMenuItem>

          {props.prop && props.view && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={rename}>Rename property</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change type</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {NOTE_PROPERTY_TYPES.map((t) => (
                    <DropdownMenuItem
                      key={t}
                      disabled={t === props.prop!.type}
                      onSelect={() => props.view!.setPropertyType.mutate({ id: props.prop!.id, type: t })}
                    >
                      {t}
                      {t === props.prop!.type && (
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          current
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setEditing(true)}>Edit property...</DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => props.onInsertColumn?.("left")}>Insert column left</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => props.onInsertColumn?.("right")}>Insert column right</DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (window.confirm(`Delete property "${props.prop!.name}" and its values?`)) props.view!.deleteProperty.mutate(props.prop!.id);
                }}
              >
                <Trash2 size={13} /> Delete property
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-muted-foreground/60">
            <MoreHorizontal size={13} /> {column.id}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {props.prop && props.view && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="p-0 gap-0 max-w-none">
            <DialogTitle className="sr-only">Edit property</DialogTitle>
            <ColumnEditProperty prop={props.prop} view={props.view} onClose={() => setEditing(false)} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
