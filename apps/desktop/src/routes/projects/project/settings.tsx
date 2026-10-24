import { useState } from "react";
import { Link2, Lock, Plus, Trash2 } from "lucide-react";
import type { ProjectDetail } from "../use-projects";
import { useProjectMutation, useProjects } from "../use-projects";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/** Project settings: subprojects, statuses (locked when synced), labels +
 * groups, tags, members, project links. */
export function ProjectSettings({ detail }: { detail: ProjectDetail }) {
  const synced = detail.project.externalSource !== null;
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      {synced && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock size={11} /> Synced from {detail.project.externalSource} — statuses and labels are managed remotely.
        </p>
      )}
      <SubprojectsCard detail={detail} />
      <StatusesCard detail={detail} locked={synced} />
      <LabelsCard detail={detail} locked={synced} />
      <TagsCard detail={detail} />
      <MembersCard detail={detail} />
      <LinksCard detail={detail} />
    </div>
  );
}

function SubprojectsCard({ detail }: { detail: ProjectDetail }) {
  const [name, setName] = useState("");
  const add = useProjectMutation(
    (n: string) => api(`/api/projects/projects/${detail.project.id}/subprojects`, { method: "POST", body: JSON.stringify({ name: n }) }),
    [detail.project.id],
  );
  const remove = useProjectMutation((id: string) => api(`/api/projects/subprojects/${id}`, { method: "DELETE" }), [detail.project.id]);
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Subprojects</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        {detail.subprojects.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="flex-1">{s.name}</span>
            {detail.subprojects.length > 1 && (
              <button
                className="text-muted-foreground hover:text-destructive"
                title="Delete (tickets move to the first subproject)"
                onClick={() => remove.mutate(s.id)}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            setName("");
            add.mutate(n);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New subproject…" className="h-7 text-xs" />
          <Button size="sm" type="submit" className="h-7" disabled={!name.trim()}>
            <Plus size={12} />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusesCard({ detail, locked }: { detail: ProjectDetail; locked: boolean }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("todo");
  const add = useProjectMutation(
    (b: { name: string; category: string }) => api(`/api/projects/projects/${detail.project.id}/statuses`, { method: "POST", body: JSON.stringify(b) }),
    [detail.project.id],
  );
  const remove = useProjectMutation((id: string) => api(`/api/projects/statuses/${id}`, { method: "DELETE" }), [detail.project.id]);
  const statuses = detail.statuses.filter((s) => s.subprojectId === null);
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">Statuses {locked && <Lock size={11} className="text-muted-foreground" />}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1">{s.name}</span>
            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
              {s.category}
            </Badge>
            {!locked && (
              <button className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(s.id)} title="Delete (must be unused)">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <form
            className="mt-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              setName("");
              add.mutate({ name: n, category });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New status…" className="h-7 text-xs" />
            <select className="bg-background h-7 rounded border px-1 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["backlog", "todo", "in_progress", "done", "canceled"].map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
            <Button size="sm" type="submit" className="h-7" disabled={!name.trim()}>
              <Plus size={12} />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function LabelsCard({ detail, locked }: { detail: ProjectDetail; locked: boolean }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const add = useProjectMutation(
    (b: { name: string; color: string }) => api(`/api/projects/projects/${detail.project.id}/labels`, { method: "POST", body: JSON.stringify(b) }),
    [detail.project.id],
  );
  const remove = useProjectMutation((id: string) => api(`/api/projects/labels/${id}`, { method: "DELETE" }), [detail.project.id]);
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">Labels {locked && <Lock size={11} className="text-muted-foreground" />}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        {detail.labelGroups.map((g) => (
          <div key={g.id}>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">{g.name}</p>
            {detail.labels
              .filter((l) => l.groupId === g.id)
              .map((l) => (
                <LabelRow key={l.id} id={l.id} name={l.name} color={l.color} locked={locked} onDelete={() => remove.mutate(l.id)} />
              ))}
          </div>
        ))}
        {detail.labels
          .filter((l) => !l.groupId)
          .map((l) => (
            <LabelRow key={l.id} id={l.id} name={l.name} color={l.color} locked={locked} onDelete={() => remove.mutate(l.id)} />
          ))}
        {!locked && (
          <form
            className="mt-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              setName("");
              add.mutate({ name: n, color });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New label…" className="h-7 text-xs" />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 rounded border" />
            <Button size="sm" type="submit" className="h-7" disabled={!name.trim()}>
              <Plus size={12} />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function LabelRow({ name, color, locked, onDelete }: { id: string; name: string; color: string; locked: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full px-2 py-px text-[10px] text-white" style={{ backgroundColor: color }}>
        {name}
      </span>
      <span className="flex-1" />
      {!locked && (
        <button className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function TagsCard({ detail }: { detail: ProjectDetail }) {
  const [name, setName] = useState("");
  const add = useProjectMutation(
    (n: string) => api(`/api/projects/projects/${detail.project.id}/tags`, { method: "POST", body: JSON.stringify({ name: n }) }),
    [detail.project.id],
  );
  const remove = useProjectMutation((id: string) => api(`/api/projects/tags/${id}`, { method: "DELETE" }), [detail.project.id]);
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Tags</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {detail.tags.map((t) => (
            <span key={t.id} className="group flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[10px]" style={{ borderColor: t.color }}>
              #{t.name}
              <button className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(t.id)}>
                <Trash2 size={9} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            setName("");
            add.mutate(n);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New tag…" className="h-7 text-xs" />
          <Button size="sm" type="submit" className="h-7" disabled={!name.trim()}>
            <Plus size={12} />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MembersCard({ detail }: { detail: ProjectDetail }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Members</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        {detail.members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2">
            <span className="flex-1">
              {m.name} <span className="text-muted-foreground">({m.email})</span>
            </span>
            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
              {m.role}
            </Badge>
          </div>
        ))}
        <p className="text-muted-foreground mt-1 text-[10px]">
          Member management (add/remove) is coming — today members are org members added at project creation.
        </p>
      </CardContent>
    </Card>
  );
}

function LinksCard({ detail }: { detail: ProjectDetail }) {
  const projects = useProjects();
  const [selected, setSelected] = useState("");
  const add = useProjectMutation(
    (linkedProjectId: string) => api(`/api/projects/projects/${detail.project.id}/links`, { method: "POST", body: JSON.stringify({ linkedProjectId }) }),
    [detail.project.id],
  );
  const remove = useProjectMutation(
    (linkedId: string) => api(`/api/projects/projects/${detail.project.id}/links/${linkedId}`, { method: "DELETE" }),
    [detail.project.id],
  );
  const linkedIds = new Set(detail.links.map((l) => l.linkedProjectId));
  const candidates = (projects.data ?? []).filter((p) => p.id !== detail.project.id && !linkedIds.has(p.id));
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Linked projects</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-xs">
        {detail.links.map((l) => (
          <div key={l.linkedProjectId} className="flex items-center gap-2">
            <Link2 size={11} className="text-muted-foreground" />
            <span className="flex-1">
              {l.linkedName} <span className="text-muted-foreground font-mono text-[10px]">{l.linkedKey}</span>
            </span>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(l.linkedProjectId)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <Separator />
        <div className="flex gap-2">
          <select className="bg-background h-7 flex-1 rounded border px-1 text-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">link a project…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-7"
            disabled={!selected}
            onClick={() => {
              add.mutate(selected);
              setSelected("");
            }}
          >
            Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
