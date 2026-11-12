import { useMemo, useState } from "react";
import { FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import { Button, cn } from "@twodb/blocks";
import { formatFileSize } from "../../lib/drive-client.js";
import { useDrive } from "../hooks/useDrive.js";
import { useEntryActions } from "../hooks/useEntryActions.js";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Trash scene for the active virtual storage — restore or purge forever. */
export function TrashScene() {
  const { activeStorage, entries, entriesLoading, entriesError } = useDrive();
  const { restore, purge, emptyTrash } = useEntryActions();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedEntries = useMemo(() => entries.filter((e) => selected.has(e.id)), [entries, selected]);

  if (!activeStorage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <FolderOpen size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Select a virtual storage on the left to see its trash.</p>
      </div>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Trash — {activeStorage.name}</h2>
            <p className="text-xs text-muted-foreground">Trashed files stay until you purge them.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={entries.length === 0}
            onClick={() => {
              if (window.confirm("Permanently delete everything in the trash? This cannot be undone.")) {
                void emptyTrash();
              }
            }}
          >
            <Trash2 size={13} /> Empty trash
          </Button>
        </header>

        {entriesError && (
          <p className="mb-3 text-xs text-red-500" role="alert">
            {entriesError}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="w-8 px-3 py-2" />
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Original path</th>
                <th className="px-2 py-2 font-medium">Size</th>
                <th className="px-2 py-2 font-medium">Trashed</th>
                <th className="w-28 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className={cn("cursor-pointer border-b last:border-b-0 hover:bg-accent/50", selected.has(entry.id) && "bg-accent")} onClick={() => toggle(entry.id)}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-2 py-2">{entry.name}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{entry.path}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{entry.type === "file" ? formatFileSize(entry.size) : "—"}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{relativeTime(entry.updatedAt)}</td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <span className="flex items-center justify-end gap-1">
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Restore"
                        onClick={() => void restore([entry.id])}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                        title="Delete forever"
                        onClick={() => {
                          if (window.confirm(`Permanently delete "${entry.name}"?`)) void purge([entry.path]);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && !entriesLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    Trash is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedEntries.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void restore(selectedEntries.map((e) => e.id));
                setSelected(new Set());
              }}
            >
              <RotateCcw size={13} /> Restore {selectedEntries.length} selected
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (window.confirm(`Permanently delete ${selectedEntries.length} item(s)?`)) {
                  void purge(selectedEntries.map((e) => e.path));
                  setSelected(new Set());
                }
              }}
            >
              <Trash2 size={13} /> Delete forever
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
