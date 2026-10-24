import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FolderKanban, Plus } from "lucide-react";
import { useProjects, type Project } from "./use-projects";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ project: Project }>("/api/projects/projects", {
        method: "POST",
        body: JSON.stringify({ name, key, description }),
      });
      onClose();
      navigate(`/apps/projects/${res.project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Web app" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-key">Identifier key</Label>
            <Input
              id="np-key"
              value={key}
              onChange={(e) =>
                setKey(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 10),
                )
              }
              placeholder="WEB"
            />
            <p className="text-muted-foreground text-xs">Tickets get identifiers like {key || "WEB"}-12.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-desc">Description</Label>
            <Textarea id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || key.length < 2 || busy} onClick={() => void submit()}>
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function projectIcon(p: Project) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
      style={{ backgroundColor: p.color ?? "#6366f1" }}
    >
      {p.icon ?? p.key.slice(0, 2)}
    </span>
  );
}

/** /apps/projects — project grid. */
export function ProjectsScene() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-muted-foreground text-sm">Linear-style tracking: boards, sprints, milestones.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New project
        </Button>
      </div>
      {projects.isPending ? (
        <p className="text-muted-foreground text-sm">loading…</p>
      ) : projects.isError ? (
        <p className="text-destructive text-sm">{projects.error.message}</p>
      ) : projects.data.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <FolderKanban size={24} />
            <p>No projects yet.</p>
            <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((p) => (
            <Link key={p.id} to={`/apps/projects/${p.id}`}>
              <Card className="hover:bg-accent/40 h-full transition-colors">
                <CardContent className="flex items-start gap-3 p-4">
                  {projectIcon(p)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-muted-foreground block font-mono text-xs">{p.key}</span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {p.ticketCount ?? 0} tickets{p.externalSource ? ` · synced from ${p.externalSource}` : ""}
                    </span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <NewProjectDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
