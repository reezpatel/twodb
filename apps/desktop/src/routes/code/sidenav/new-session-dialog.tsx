import { useEffect, useState } from "react";
import { Check, Folder, FolderPlus, Loader2, Plus } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { NewDirectoryDialog } from "../directories/new-directory-dialog";
import { useCodeDirectories } from "../directories/use-code-directories";
import type { CodeSession } from "./use-session-list";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  create: UseMutationResult<CodeSession, Error, string>;
}

export function NewSessionDialog({ open, onOpenChange, create }: NewSessionDialogProps) {
  const { directories } = useCodeDirectories();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDirOpen, setNewDirOpen] = useState(false);
  const list = directories.data ?? [];

  useEffect(() => {
    if (open && selectedId === null && list.length === 1) setSelectedId(list[0].id);
  }, [open, selectedId, list]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {directories.isPending ? (
              <div className="flex justify-center py-6">
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              </div>
            ) : (
              <>
                {list.length === 0 && <p className="text-muted-foreground px-2 py-1 text-sm">No directories yet — create one to start.</p>}
                {list.map((dir) => (
                  <button
                    key={dir.id}
                    className={cn(
                      "hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      selectedId === dir.id && "bg-accent font-medium",
                    )}
                    onClick={() => setSelectedId(dir.id)}
                  >
                    <Folder size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{dir.displayName}</span>
                    <span className="text-muted-foreground/70 max-w-32 truncate font-mono text-xs">{dir.cwd}</span>
                    {selectedId === dir.id && <Check size={14} className="shrink-0" aria-hidden="true" />}
                  </button>
                ))}
                <button
                  className="text-muted-foreground hover:bg-accent hover:text-foreground mx-2 mt-1 flex items-center gap-2 rounded-md px-0 py-1.5 text-left text-sm"
                  onClick={() => setNewDirOpen(true)}
                >
                  <FolderPlus size={14} aria-hidden="true" />
                  New directory…
                </button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              disabled={!selectedId || create.isPending}
              onClick={() => selectedId && create.mutate(selectedId, { onSuccess: () => onOpenChange(false) })}
            >
              {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NewDirectoryDialog open={newDirOpen} onOpenChange={setNewDirOpen} onCreated={(dir) => setSelectedId(dir.id)} />
    </>
  );
}
