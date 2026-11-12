import { Database, HardDrive, Settings, Trash2, FolderOpen, Star } from "lucide-react";
import { Button, cn } from "@twodb/blocks";
import { formatFileSize } from "../../lib/drive-client.js";
import { useDrive } from "../hooks/useDrive.js";

/**
 * The drive sidebar — backends as collapsible groups, their virtual storages
 * as entries (every virtual storage is its own browsable root). Below the
 * tree: trash + settings. Mirrors the legacy FilesSidenav styling.
 */
export function DriveSidebar() {
  const { backends, storages, activeStorageId, openStorage, selectView, view, treeLoading, treeError } = useDrive();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto border-r border-outline bg-paper p-3">
      <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase">Storage</h3>

      {treeLoading && <p className="px-2 text-xs text-muted-foreground">Loading…</p>}
      {treeError && <p className="px-2 text-xs text-red-500">{treeError}</p>}

      {backends.map((backend) => {
        const children = storages.filter((s) => s.backendId === backend.id);
        return (
          <div key={backend.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-2 pt-1 text-[11px] font-medium text-muted-foreground">
              {backend.type === "s3" ? (
                <Database size={13} className="shrink-0 text-lavender-400" aria-hidden="true" />
              ) : (
                <HardDrive size={13} className="shrink-0 text-blue-400" aria-hidden="true" />
              )}
              <span className="truncate">{backend.name}</span>
              {!backend.enabled && <span className="text-[10px] text-red-400">(disabled)</span>}
            </div>
            {children.map((storage) => (
              <button
                key={storage.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                  activeStorageId === storage.id ? "border-ring bg-accent font-medium" : "border-transparent",
                )}
                onClick={() => openStorage(storage.id)}
              >
                <FolderOpen size={14} className="shrink-0 text-lavender-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{storage.name}</span>
                {storage.isDefault && <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" aria-label="default for app files" />}
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatFileSize(storage.usage.used)}</span>
              </button>
            ))}
            {children.length === 0 && (
              <p className="px-2 pb-1 text-[11px] text-muted-foreground/70">No virtual storages — create one in Settings.</p>
            )}
          </div>
        );
      })}
      {!treeLoading && backends.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">
          No backends yet — add an S3 bucket or local path in Settings.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-1 pt-4">
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
            view === "trash" ? "border-ring bg-accent font-medium" : "border-transparent",
          )}
          onClick={() => selectView("trash")}
        >
          <Trash2 size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Trash</span>
        </button>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
            view === "settings" ? "border-ring bg-accent font-medium" : "border-transparent",
          )}
          onClick={() => selectView("settings")}
        >
          <Settings size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Settings</span>
        </button>
        <Button variant="secondary" size="sm" className="mx-1 mt-2" onClick={() => selectView("settings")}>
          <Settings size={13} /> Manage storage
        </Button>
      </div>
    </aside>
  );
}
