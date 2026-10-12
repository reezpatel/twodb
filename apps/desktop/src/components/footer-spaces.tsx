import { Boxes, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { useSpaces, type Space } from "./space-provider";

function label(count: number, total: number): string {
  if (total === 0 || count === total) return "All spaces";
  return `${count} space${count === 1 ? "" : "s"}`;
}

/**
 * Footer spaces widget: click floats the space management panel. Checkboxes
 * select multiple spaces (drives the x-space-ids header on every API call);
 * "Show all" resets to unfiltered, and the add row creates new spaces.
 */
export function FooterSpaces() {
  const { spaces, loading, selected, allSelected, toggle, showAll, create, remove } = useSpaces();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Space | null>(null);

  const selectedCount = allSelected ? spaces.length : (selected?.length ?? 0);

  const submitCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    create.mutate(trimmed, {
      onSuccess: () => setName(""),
      onSettled: () => setCreating(false),
    });
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Spaces"
          className="text-muted-foreground hover:text-foreground flex h-6 items-center gap-1.5 rounded px-1 transition-colors outline-none"
        >
          <Boxes size={13} />
          <span className="truncate">{label(selectedCount, spaces.length)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium">Spaces</span>
          {!allSelected && (
            <button type="button" className="text-primary hover:text-primary/80 text-[11px] font-medium" onClick={showAll}>
              Show all
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            </div>
          ) : spaces.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-xs">No spaces yet — create one to group and filter your work.</p>
          ) : (
            spaces.map((space) => {
              const checked = allSelected || (selected?.includes(space.id) ?? false);
              return (
                <div key={space.id} className="hover:bg-accent/50 group flex items-center gap-2 rounded px-2 py-1 text-xs">
                  <label
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
                    onClick={(e) => {
                      e.preventDefault();
                      toggle(space.id);
                    }}
                  >
                    <Checkbox checked={checked} tabIndex={-1} />
                    <span className={cn("truncate", checked && "text-foreground")}>{space.name}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Delete ${space.name}`}
                    className="text-muted-foreground/0 group-hover:text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                    onClick={() => setConfirmDelete(space)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-1.5 border-t p-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCreate()}
            placeholder="New space name…"
            className="h-7 text-xs"
            disabled={creating}
          />
          <Button variant="secondary" size="icon" className="size-7 shrink-0" aria-label="Add space" disabled={!name.trim() || creating} onClick={submitCreate}>
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          </Button>
        </div>
      </PopoverContent>
      </Popover>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete space “{confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the space for everyone in the organization. Resources won't be deleted — they'll just stop being grouped under it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}