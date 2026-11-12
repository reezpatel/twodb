import { useMemo, useRef, useState } from "react";
import {
  Download,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  Link2,
  List,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Checkbox, Input, cn } from "@twodb/blocks";
import { driveClient, formatFileSize, type EntryDto } from "../../lib/drive-client.js";
import { useDrive } from "../hooks/useDrive.js";
import { useEntryActions, useSearchRecent } from "../hooks/useEntryActions.js";

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

function typeFromEntry(entry: EntryDto): FileType {
  if (entry.previewType === "image") return "image";
  if (entry.previewType === "pdf") return "pdf";
  if (entry.previewType === "text") return "doc";
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  return "doc";
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

function FileGlyph({ entry, size = 15 }: { entry: EntryDto; size?: number }) {
  if (entry.type === "folder")
    return <FolderOpen size={size} className="shrink-0 text-lavender-400" aria-hidden="true" />;
  const meta = TYPE_META[typeFromEntry(entry)];
  return <meta.icon size={size} className={cn(meta.cls, "shrink-0")} aria-hidden="true" />;
}

/** The main explorer scene — legacy files-scene design: breadcrumbs, type
 * tabs, search, list/grid views, recent files, uploads, per-row actions. */
export function FilesScene() {
  const { activeStorage, activeStorageId, path, entries, entriesLoading, entriesError, openFolder, navigateTo, refreshEntries } = useDrive();
  const { upload, mkdir, rename, trash, share } = useEntryActions();
  const { query, setQuery, results, searching, recent } = useSearchRecent();
  const [typeTab, setTypeTab] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => {
    const source = query.trim().length >= 2 ? results : entries;
    return source.filter((entry) => {
      if (entry.type === "file" && typeTab !== "all" && TYPE_META[typeFromEntry(entry)].label !== typeTab) return false;
      if (query.trim().length >= 2 && !entry.path.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [entries, results, typeTab, query]);

  const selectedEntries = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const segments = path ? path.split("/") : [];
  const crumbs = activeStorage ? [activeStorage.name, ...segments] : [];

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      await upload(files);
      setToast(`Uploaded ${files.length} file(s)`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (!activeStorageId || !activeStorage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <FolderOpen size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">No virtual storage selected</p>
        <p className="max-w-xs text-center text-xs text-muted-foreground/70">
          Create a backend + virtual storage in Settings, then pick it in the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <nav className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <span>Files</span>
              {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-muted-foreground/50">/</span>
                  <button
                    className="text-primary hover:underline"
                    onClick={() => (i === 0 ? openFolder("") : navigateTo(i))}
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </nav>
            <h2 className="text-xl font-semibold">{crumbs[crumbs.length - 1]}</h2>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const name = window.prompt("Folder name");
                if (name?.trim()) void mkdir(path ? `${path}/${name.trim()}` : name.trim());
              }}
            >
              <Folder size={13} /> New folder
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void onUpload(e.target.files)}
            />
            <Button size="sm" onClick={() => fileInput.current?.click()}>
              <Upload size={13} /> Upload
            </Button>
          </div>
        </header>

        {toast && (
          <p className="text-muted-foreground mb-3 text-xs" role="status">
            {toast}
          </p>
        )}
        {entriesError && (
          <p className="mb-3 text-xs text-red-500" role="alert">
            {entriesError}
          </p>
        )}

        {path === "" && recent.length > 0 && query.trim().length < 2 && (
          <>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Recent files</h3>
            <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {recent.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <FileGlyph entry={entry} size={13} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{entry.name}</div>
                    <div className="text-[11px] text-muted-foreground">{relativeTime(entry.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-sm font-medium text-muted-foreground">All files</h3>
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  typeTab === tab.id
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTypeTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="h-8 w-52 pl-7 text-sm"
              placeholder={searching ? "Searching…" : "Search files…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" title="Grid view" onClick={() => setView("grid")}>
            <LayoutGrid size={14} />
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" title="List view" onClick={() => setView("list")}>
            <List size={14} />
          </Button>
        </div>

        {view === "list" ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Size</th>
                  <th className="px-2 py-2 font-medium">Updated</th>
                  <th className="w-28 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "cursor-pointer border-b last:border-b-0 hover:bg-accent/50",
                      selected.has(entry.id) && "bg-accent",
                    )}
                    onClick={() => (entry.type === "folder" ? openFolder(entry.path) : toggle(entry.id))}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(entry.id)}
                        onCheckedChange={() => toggle(entry.id)}
                        aria-label={`Select ${entry.name}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2">
                        <FileGlyph entry={entry} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {entry.type === "folder" ? "—" : formatFileSize(entry.size)}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{relativeTime(entry.updatedAt)}</td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <span className="flex items-center justify-end gap-1">
                        {entry.type === "file" && (
                          <a
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            href={driveClient.fileUrl(activeStorageId, entry.path, true)}
                            download
                            title="Download"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        {entry.type === "file" && entry.previewType === "image" && (
                          <a
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            href={driveClient.fileUrl(activeStorageId, entry.path)}
                            target="_blank"
                            rel="noreferrer"
                            title="Preview"
                          >
                            <FileImage size={14} />
                          </a>
                        )}
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Rename"
                          onClick={() => {
                            const newName = window.prompt("New name", entry.name);
                            if (newName?.trim()) void rename(entry.path, newName.trim());
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                          title="Share link"
                          onClick={() =>
                            void share(entry.path).then((s) => {
                              void navigator.clipboard?.writeText(s.url).catch(() => undefined);
                              setToast(`Share link copied: ${s.url}`);
                            })
                          }
                        >
                          <Link2 size={14} />
                        </button>
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                          title="Delete"
                          onClick={() => {
                            if (window.confirm(`Delete "${entry.name}"?`)) void trash([entry.path]);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !entriesLoading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                      {entries.length === 0
                        ? "Empty folder — upload a file or create one with an app."
                        : "No files match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                {selected.size} of {rows.length} row(s) selected.
              </span>
              <span>{activeStorage.name}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {rows.map((entry) => (
              <button
                key={entry.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-accent/50",
                  selected.has(entry.id) && "border-ring bg-accent",
                )}
                onClick={() => (entry.type === "folder" ? openFolder(entry.path) : toggle(entry.id))}
              >
                {entry.type === "folder" ? (
                  <Folder size={32} className="text-lavender-400" aria-hidden="true" />
                ) : entry.previewType === "image" ? (
                  <img
                    src={driveClient.fileUrl(activeStorageId, entry.path)}
                    alt={entry.name}
                    className="h-12 w-12 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileGlyph entry={entry} size={32} />
                )}
                <span className="w-full truncate text-xs font-medium">{entry.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {entry.type === "file" ? formatFileSize(entry.size) : "folder"}
                </span>
              </button>
            ))}
            {rows.length === 0 && !entriesLoading && (
              <p className="col-span-full p-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
            )}
          </div>
        )}
        {selectedEntries.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (window.confirm(`Delete ${selectedEntries.length} item(s)?`)) {
                  void trash(selectedEntries.map((e) => e.path));
                  setSelected(new Set());
                }
              }}
            >
              <Trash2 size={13} /> Delete {selectedEntries.length} selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        )}
      </main>
      <div className="flex items-center justify-between border-t border-outline px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          {activeStorage.usage.files} files · {activeStorage.usage.folders} folders ·{" "}
          {formatFileSize(activeStorage.usage.used)} used
        </span>
        <button className="hover:text-foreground hover:underline" onClick={() => void refreshEntries()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
