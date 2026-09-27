import { useMemo, useState } from "react";
import {
  Database,
  Download,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useFilesScene, type StorageEntryInfo } from "./use-files-scene";
import { formatFileSize, UploadDialog } from "./upload-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type FileType = "pdf" | "doc" | "sheet" | "image";

const TYPE_META: Record<FileType, { label: string; icon: typeof FileIcon; cls: string }> = {
  pdf: { label: "PDF", icon: FileIcon, cls: "text-red-400" },
  doc: { label: "Document", icon: FileText, cls: "text-blue-400" },
  sheet: { label: "Spreadsheet", icon: FileSpreadsheet, cls: "text-green-400" },
  image: { label: "Image", icon: FileImage, cls: "text-magenta-400" },
};

const TYPE_TABS = [
  { id: "all", label: "View all" },
  { id: "Document", label: "Documents" },
  { id: "Spreadsheet", label: "Spreadsheets" },
  { id: "PDF", label: "PDFs" },
  { id: "Image", label: "Images" },
];

function typeFromName(name: string): FileType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  return "doc";
}

function FileGlyph({ entry, size = 15 }: { entry: StorageEntryInfo; size?: number }) {
  if (entry.type === "folder") return <FolderOpen size={size} className="text-lavender-400 shrink-0" aria-hidden="true" />;
  const meta = TYPE_META[typeFromName(entry.path)];
  return <meta.icon size={size} className={cn(meta.cls, "shrink-0")} aria-hidden="true" />;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function entryName(entry: StorageEntryInfo) {
  return entry.path.split("/").pop() ?? entry.path;
}

export function FilesScene() {
  const { backends, buckets, bucket, bucketInfo, path, entries, createBucket, upload, mkdir, remove, openBucket, openFolder, navigateTo } = useFilesScene();
  const [typeTab, setTypeTab] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newBucketOpen, setNewBucketOpen] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const [bucketBackend, setBucketBackend] = useState("");
  const [bucketLimitGb, setBucketLimitGb] = useState("");

  const rows = useMemo(() => {
    const all = entries.data ?? [];
    return all.filter((entry) => {
      if (entry.type === "file" && typeTab !== "all" && TYPE_META[typeFromName(entry.path)].label !== typeTab) return false;
      if (query && !entry.path.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [entries.data, typeTab, query]);

  const recent = useMemo(
    () =>
      [...(entries.data ?? [])]
        .filter((e) => e.type === "file")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 4),
    [entries.data],
  );

  const selectedEntries = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const single = selectedEntries.length === 1 ? selectedEntries[0] : null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelected = () => {
    const list = selectedEntries;
    if (list.length === 0) return;
    if (!window.confirm(list.length === 1 ? `Delete "${entryName(list[0])}"?` : `Delete ${list.length} items?`)) return;
    for (const entry of list) remove.mutate(entry);
    setSelected(new Set());
  };

  const segments = path ? path.split("/") : [];
  const crumbs = bucket ? [bucketInfo?.name ?? "…", ...segments] : [];

  return (
    <div className="flex h-full">
      {/* left nav — storage buckets */}
      <aside className="bg-card border-r hidden w-56 shrink-0 flex-col overflow-y-auto border-r p-3 md:flex">
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
              <Input
                placeholder="Storage limit in GB (optional)"
                value={bucketLimitGb}
                onChange={(e) => setBucketLimitGb(e.target.value)}
                inputMode="numeric"
              />
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
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        {!bucket ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <FolderOpen size={28} className="text-muted-foreground/50" aria-hidden="true" />
            <p className="text-muted-foreground text-sm font-medium">Pick a storage bucket on the left</p>
            <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
              Buckets live on a backend (S3-compatible or local) and can carry a storage quota.
            </p>
          </div>
        ) : (
          <>
            <header className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <nav className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                  <span>Files</span>
                  {crumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="text-muted-foreground/50">/</span>
                      <button className="text-primary hover:underline" onClick={() => (i === 0 ? openBucket(bucket!) : navigateTo(i - 1))}>
                        {crumb}
                      </button>
                    </span>
                  ))}
                </nav>
                <h2 className="text-xl font-semibold">{crumbs[crumbs.length - 1]}</h2>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const name = window.prompt("Folder name");
                    if (name?.trim()) mkdir.mutate(name.trim());
                  }}
                >
                  <Folder size={13} /> New folder
                </Button>
                <Button size="sm" onClick={() => setUploadOpen(true)} disabled={upload.isPending}>
                  <Upload size={13} /> Upload file
                </Button>
              </div>
            </header>

            {recent.length > 0 && path === "" && (
              <>
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">Recent files</h3>
                <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                  {recent.map((entry) => (
                    <div key={entry.id} className="bg-card flex items-center gap-2 rounded-lg border p-2.5">
                      <FileGlyph entry={entry} size={13} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{entryName(entry)}</div>
                        <div className="text-muted-foreground text-[11px]">{relativeTime(entry.updatedAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-muted-foreground mr-2 text-sm font-medium">All files</h3>
              <div className="bg-muted inline-flex rounded-lg border p-0.5">
                {TYPE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs transition-colors",
                      typeTab === tab.id ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setTypeTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative ml-auto">
                <Search size={13} className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2" aria-hidden="true" />
                <Input className="h-8 w-52 pl-7 text-sm" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" title="Grid view" onClick={() => setView("grid")}>
                <LayoutGrid size={14} />
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" title="List view" onClick={() => setView("list")}>
                <List size={14} />
              </Button>
            </div>

            {view === "list" ? (
              <div className="bg-card overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-b text-left">
                      <th className="w-8 px-3 py-2" />
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Size</th>
                      <th className="px-2 py-2 font-medium">Updated</th>
                      <th className="w-20 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => (
                      <tr
                        key={entry.id}
                        className={cn("border-b border-b last:border-b-0 hover:bg-accent/50 cursor-pointer", selected.has(entry.id) && "bg-accent")}
                        onClick={() => (entry.type === "folder" ? openFolder(entry.path) : toggle(entry.id))}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggle(entry.id)} aria-label={`Select ${entryName(entry)}`} />
                        </td>
                        <td className="px-2 py-2">
                          <span className="flex items-center gap-2">
                            <FileGlyph entry={entry} />
                            <span className="truncate">{entryName(entry)}</span>
                          </span>
                        </td>
                        <td className="text-muted-foreground px-2 py-2 text-xs">{entry.type === "folder" ? "—" : formatFileSize(entry.size)}</td>
                        <td className="text-muted-foreground px-2 py-2 text-xs">{relativeTime(entry.updatedAt)}</td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <span className="flex items-center justify-end gap-1">
                            {entry.type === "file" && (
                              <a
                                className="text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                                href={`/api/storage/buckets/${bucket}/raw/${entry.path}`}
                                download
                                title="Download"
                              >
                                <Download size={14} />
                              </a>
                            )}
                            <button
                              className="text-muted-foreground hover:text-destructive inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                              title="Delete"
                              onClick={() => {
                                if (window.confirm(`Delete "${entryName(entry)}"?`)) remove.mutate(entry);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && !entries.isPending && (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground p-8 text-center text-sm">
                          {entries.data?.length === 0 ? "Empty folder — upload a file or create one with an agent." : "No files match these filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="text-muted-foreground flex items-center justify-between border-t border-t px-3 py-1.5 text-xs">
                  <span>
                    {selected.size} of {rows.length} row(s) selected.
                  </span>
                  <span>{bucketInfo?.name}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {rows.map((entry) => (
                  <button
                    key={entry.id}
                    className={cn(
                      "bg-card flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:border-ring",
                      selected.has(entry.id) && "border-ring",
                    )}
                    onClick={() => (entry.type === "folder" ? openFolder(entry.path) : toggle(entry.id))}
                  >
                    <FileGlyph entry={entry} size={22} />
                    <span className="w-full truncate text-sm font-medium">{entryName(entry)}</span>
                    <span className="text-muted-foreground text-xs">
                      {entry.type === "folder" ? "folder" : `${formatFileSize(entry.size)} · ${relativeTime(entry.updatedAt)}`}
                    </span>
                  </button>
                ))}
                {rows.length === 0 && <p className="text-muted-foreground col-span-full p-6 text-center text-sm">No files match these filters.</p>}
              </div>
            )}
          </>
        )}
      </main>

      {/* right panel — selected file info */}
      <aside className="bg-card border-l hidden w-72 shrink-0 flex-col overflow-y-auto border-l p-3 xl:flex">
        <h3 className="text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase">Details</h3>

        {!bucket ? (
          <p className="text-muted-foreground/70 px-2 text-xs">Select a file to see its details.</p>
        ) : selectedEntries.length === 0 ? (
          <p className="text-muted-foreground/70 px-2 text-xs">Click a file to select it.</p>
        ) : single ? (
          <div className="flex flex-col gap-3">
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <FileGlyph entry={single} size={22} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{entryName(single)}</span>
              </div>
              <Separator />
              <dl className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{single.type === "folder" ? "Folder" : TYPE_META[typeFromName(single.path)].label}</dd>
                </div>
                {single.type === "file" && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Size</dt>
                    <dd>{formatFileSize(single.size)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Bucket</dt>
                  <dd className="font-mono">{bucketInfo?.name}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd>{relativeTime(single.updatedAt)}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Path</dt>
                  <dd className="bg-muted rounded-md p-2 font-mono break-all">{single.path}</dd>
                </div>
              </dl>
            </Card>
            <div className="flex flex-col gap-2">
              {single.type === "file" && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/storage/buckets/${bucket}/raw/${single.path}`} download>
                    <Download size={13} /> Download
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteSelected}>
                <Trash2 size={13} /> Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Card className="p-4 text-sm">
              <p className="font-medium">{selectedEntries.length} items selected</p>
              <ul className="text-muted-foreground mt-2 flex flex-col gap-1 text-xs">
                {selectedEntries.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-1.5 truncate">
                    <FileGlyph entry={entry} size={12} />
                    <span className="truncate">{entryName(entry)}</span>
                  </li>
                ))}
                {selectedEntries.length > 6 && <li className="pl-5">+{selectedEntries.length - 6} more…</li>}
              </ul>
            </Card>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteSelected}>
              <Trash2 size={13} /> Delete {selectedEntries.length} items
            </Button>
          </div>
        )}
      </aside>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        backend={bucketInfo?.name ?? ""}
        target={path}
        onUpload={(dir, files) => upload.mutateAsync({ dir, files })}
      />
    </div>
  );
}
