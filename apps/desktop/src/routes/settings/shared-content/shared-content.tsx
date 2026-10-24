import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Database, Loader2, Lock, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SharedContentSettings } from "../../share/use-share";

/** Settings → Shared Content: manage locked shared_content databases and
 *  choose which database shared links (and Instagram links) land in. */
export function SharedContentSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const settings = useQuery({
    queryKey: ["shared-content"],
    queryFn: () => api<SharedContentSettings>("/api/shared-content"),
  });

  const [newTitle, setNewTitle] = useState("");
  const [targets, setTargets] = useState<{ default: string | null; instagram: string | null } | null>(null);
  // Local edit state falls back to server values until the user touches a select.
  const effective = targets ?? settings.data?.targets ?? { default: null, instagram: null };

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["shared-content"] });

  const createDatabase = useMutation({
    mutationFn: (title: string) => api("/api/shared-content/databases", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      setNewTitle("");
      invalidate();
    },
  });

  const saveTargets = useMutation({
    mutationFn: (t: { default: string | null; instagram: string | null }) => api("/api/shared-content/targets", { method: "PUT", body: JSON.stringify(t) }),
    onSuccess: () => {
      setTargets(null);
      invalidate();
    },
  });

  const databases = (settings.data?.databases ?? []).filter((d) => !d.deletedAt);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-2xl space-y-8 px-4 pt-12 pb-16 lg:px-12">
        <div>
          <h1 className="text-2xl font-bold">Shared Content</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Links shared to this app are stored as rows in a shared-content database. These databases have a{" "}
            <span className="text-foreground font-medium">locked schema</span> (content, url, tags, site, medias, status) — you can move them around in
            your notes, but their columns are managed by the app.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Databases</h2>
          {settings.isPending ? (
            <Loader2 className="text-muted-foreground animate-spin" size={16} />
          ) : (
            <div className="border-border divide-border divide-y rounded-lg border">
              {databases.map((d) => (
                <button key={d.id} className="hover:bg-accent/60 flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => navigate("/apps/notes/databases")}>
                  <Database size={14} className="text-lavender-400 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{d.title || "Untitled database"}</span>
                  <span className="text-muted-foreground/70 flex items-center gap-1 text-[10px]">
                    <Lock size={10} /> twodb:shared_content
                  </span>
                </button>
              ))}
              {databases.length === 0 && <p className="text-muted-foreground px-3 py-4 text-center text-xs">No shared-content databases yet.</p>}
            </div>
          )}
          <div className="flex gap-2">
            <Input className="h-8 text-sm" placeholder="New database title (e.g. Inbox, Instagram saves)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Button size="sm" className="h-8 shrink-0" disabled={!newTitle.trim() || createDatabase.isPending} onClick={() => createDatabase.mutate(newTitle.trim())}>
              {createDatabase.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create
            </Button>
          </div>
          {createDatabase.isError && <p className="text-destructive text-xs">{createDatabase.error.message}</p>}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Share targets</h2>
          <p className="text-muted-foreground text-xs">Which database shared links go to. Instagram links can go to their own database.</p>
          <div className="space-y-2">
            <label className="text-muted-foreground block text-xs font-medium">Default database</label>
            <select
              className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
              value={effective.default ?? ""}
              onChange={(e) => setTargets({ ...effective, default: e.target.value || null })}
            >
              <option value="">— not set —</option>
              {databases.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title || "Untitled database"}
                </option>
              ))}
            </select>
            <label className="text-muted-foreground block text-xs font-medium">Instagram database</label>
            <select
              className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
              value={effective.instagram ?? ""}
              onChange={(e) => setTargets({ ...effective, instagram: e.target.value || null })}
            >
              <option value="">— same as default —</option>
              {databases.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title || "Untitled database"}
                </option>
              ))}
            </select>
          </div>
          {saveTargets.isError && <p className="text-destructive text-xs">{saveTargets.error.message}</p>}
          <Button size="sm" className="h-8" disabled={!targets || saveTargets.isPending} onClick={() => saveTargets.mutate(effective)}>
            {saveTargets.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
            Save targets
          </Button>
        </section>
      </div>
    </div>
  );
}
