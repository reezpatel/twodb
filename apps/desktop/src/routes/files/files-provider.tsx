import { createContext, useContext, useState, type ReactNode } from "react";
import { Database, HardDrive, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/side-nav";
import { cn } from "@/lib/utils";
import { formatFileSize } from "./upload-dialog";
import { useFilesScene } from "./use-files-scene";

/** Files scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. */
export const FilesContext = createContext<ReturnType<typeof useFilesScene> | null>(null);

export function FilesProvider({ children }: { children: ReactNode }) {
  const files = useFilesScene();
  return <FilesContext.Provider value={files}>{children}</FilesContext.Provider>;
}

export function useFiles() {
  const files = useContext(FilesContext);
  if (!files) throw new Error("useFiles must be used within FilesProvider");
  return files;
}

/** The files sidebar (storage buckets) — rendered by the app shell
 * (desktop column / mobile drawer). */
export function FilesSidenav() {
  const { backends, buckets, bucket, createBucket, openBucket } = useFiles();
  const [newBucketOpen, setNewBucketOpen] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const [bucketBackend, setBucketBackend] = useState("");
  const [bucketLimitGb, setBucketLimitGb] = useState("");

  return (
    <SideNav className="bg-card w-56 gap-2 p-3">
      <h3 className="text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase">Storage</h3>
      <div className="mb-3 flex flex-col gap-1">
        {(buckets.data ?? []).map((b) => (
          <button
            key={b.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
              bucket === b.id ? "border-ring bg-accent font-medium" : "border-transparent",
            )}
            onClick={() => openBucket(b.id)}
          >
            {b.backendType === "object" ? (
              <Database size={14} className="text-lavender-400 shrink-0" aria-hidden="true" />
            ) : (
              <HardDrive size={14} className="text-blue-400 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            <span className="text-muted-foreground text-[10px]">{formatFileSize(b.used)}</span>
          </button>
        ))}
        {(buckets.data ?? []).length === 0 && !buckets.isPending && <p className="text-muted-foreground px-2 text-xs">No buckets yet — create one below.</p>}
      </div>
      <Button variant="outline" size="sm" className="mx-1" onClick={() => setNewBucketOpen(true)} disabled={(backends.data ?? []).length === 0}>
        <Plus size={13} /> New bucket
      </Button>

      <Dialog open={newBucketOpen} onOpenChange={setNewBucketOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New storage bucket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Bucket name (e.g. project-files)" value={bucketName} onChange={(e) => setBucketName(e.target.value)} />
            <select
              className="border-input bg-background focus:border-ring focus:ring-ring/50 h-8 w-full rounded-md border px-2 text-sm shadow-xs focus:outline-none"
              value={bucketBackend}
              onChange={(e) => setBucketBackend(e.target.value)}
            >
              <option value="">Select backend…</option>
              {(backends.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.type})
                </option>
              ))}
            </select>
            <Input placeholder="Storage limit in GB (optional)" value={bucketLimitGb} onChange={(e) => setBucketLimitGb(e.target.value)} inputMode="numeric" />
          </div>
          <DialogFooter>
            <Button
              size="sm"
              disabled={!bucketName.trim() || !bucketBackend || createBucket.isPending}
              onClick={() => {
                const gb = Number(bucketLimitGb);
                createBucket.mutate(
                  {
                    name: bucketName.trim(),
                    backendId: bucketBackend,
                    storageLimit: bucketLimitGb.trim() && Number.isFinite(gb) && gb > 0 ? Math.round(gb * 1024 ** 3) : null,
                  },
                  {
                    onSuccess: (row) => {
                      setNewBucketOpen(false);
                      setBucketName("");
                      setBucketBackend("");
                      setBucketLimitGb("");
                      openBucket(row.id);
                    },
                  },
                );
              }}
            >
              {createBucket.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SideNav>
  );
}
