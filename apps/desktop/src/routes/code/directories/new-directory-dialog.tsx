import { FolderPlus, Loader2 } from "lucide-react";
import { RunnerFinder } from "@/components/runner-finder";
import { useNewDirectoryDialog } from "./use-new-directory-dialog";
import type { CodeDirectory } from "./use-code-directories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface NewDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (dir: { id: string }) => void;
  title?: string;
  submitLabel?: string;
}

export function NewDirectoryDialog({ open, onOpenChange, onCreated, title, submitLabel }: NewDirectoryDialogProps) {
  const handleCreated = (row: CodeDirectory) => {
    onOpenChange(false);
    onCreated(row);
  };
  const { dirName, setDirName, selection, setSelection, existing, createDirectory, submit } = useNewDirectoryDialog(handleCreated);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "New working directory"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder="Display name (e.g. twodb repo)" value={dirName} onChange={(e) => setDirName(e.target.value)} />
          <RunnerFinder mode="folder" onSelectionChange={setSelection} className="h-80" />
          {existing && <p className="text-muted-foreground text-xs">Already registered as “{existing.displayName}” — it will be reused.</p>}
        </div>
        <DialogFooter>
          <Button size="sm" disabled={!selection || (!existing && !dirName.trim()) || createDirectory.isPending} onClick={submit}>
            {createDirectory.isPending ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
            {submitLabel ?? "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
