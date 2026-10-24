import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Database, Loader2, RotateCcw, Search, Star, Unlink } from "lucide-react";
import { useNotes } from "./notes-provider";
import { useAllDatabases, type DatabaseSummary } from "./use-notes-scene";
import { NodeIcon } from "./scene/section-tree";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Filter = "all" | "dangling" | "deleted";

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function location(d: DatabaseSummary) {
  if (d.deletedAt) return "In trash";
  if (d.dangling) return d.parentTitle ? `Detached from ${d.parentTitle || "Untitled"}` : "No parent";
  if (!d.parentTitle) return "—";
  return `${d.inline ? "Inline in" : "In"} ${d.parentTitle}`;
}

/** /apps/notes/databases — browse every database in the org: live, dangling
 *  and deleted (databases are never hard-deleted, so they can be restored). */
export function DatabasesScene() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const query = useAllDatabases();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const all = useMemo(() => query.data?.databases ?? [], [query.data]);
  const counts = useMemo(
    () => ({ all: all.filter((d) => !d.deletedAt).length, dangling: all.filter((d) => d.dangling).length, deleted: all.filter((d) => d.deletedAt).length }),
    [all],
  );
  const shown = all.filter((d) => {
    if (filter === "all" && d.deletedAt) return false;
    if (filter === "dangling" && !d.dangling) return false;
    if (filter === "deleted" && !d.deletedAt) return false;
    return !search || (d.title || "Untitled database").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 px-4 text-sm">
        <Database size={14} className="text-muted-foreground" />
        <span className="text-foreground/80 font-medium">All databases</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-12 pb-16 lg:px-32">
          <h1 className="pb-4 text-2xl font-bold">Databases</h1>
          <div className="flex flex-wrap items-center gap-1 pb-3">
            {(["all", "dangling", "deleted"] as const).map((f) => (
              <button
                key={f}
                className={cn("flex h-7 items-center gap-1.5 rounded-md px-2 text-xs capitalize", filter === f ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60")}
                onClick={() => setFilter(f)}
              >
                {f === "deleted" ? "Trash" : f}
                <span className="text-muted-foreground/60 tabular-nums">{counts[f]}</span>
              </button>
            ))}
            <div className="relative ml-auto w-56">
              <Search size={13} className="text-muted-foreground/60 absolute top-1/2 left-2 -translate-y-1/2" />
              <Input className="h-7 pl-7 text-xs" placeholder="Search databases" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {query.isPending ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="text-muted-foreground animate-spin" size={16} />
            </div>
          ) : (
            <div className="border-t">
              {shown.map((d) => (
                <div
                  key={d.id}
                  className="group hover:bg-accent/40 flex h-11 cursor-pointer items-center gap-3 border-b px-2 text-sm"
                  onClick={() => navigate(`/apps/notes/${d.id}`)}
                >
                  <NodeIcon kind="database" icon={d.icon} size={16} />
                  <span className={cn("min-w-0 flex-1 truncate font-medium", d.deletedAt && "text-muted-foreground line-through")}>{d.title || "Untitled database"}</span>
                  {d.dangling && (
                    <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                      <Unlink size={10} /> dangling
                    </Badge>
                  )}
                  <span className="text-muted-foreground hidden w-56 truncate text-xs md:block">{location(d)}</span>
                  <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">{d.rowCount} rows</span>
                  <span className="text-muted-foreground/70 hidden w-20 text-right text-xs lg:block">{relativeDate(d.updatedAt)}</span>
                  {d.deletedAt ? (
                    <button
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                      title="Restore"
                      onClick={(e) => {
                        e.stopPropagation();
                        notes.restoreNode.mutate(d.id);
                      }}
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                  ) : (
                    <button
                      className={cn("text-xs leading-none", d.isFavorite ? "text-warning" : "text-muted-foreground/0 group-hover:text-muted-foreground/70")}
                      title={d.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      onClick={(e) => {
                        e.stopPropagation();
                        notes.toggleFavorite.mutate({ id: d.id, isFavorite: !d.isFavorite });
                      }}
                    >
                      <Star size={13} fill={d.isFavorite ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>
              ))}
              {shown.length === 0 && <p className="text-muted-foreground/70 p-6 text-center text-xs">No databases here.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
