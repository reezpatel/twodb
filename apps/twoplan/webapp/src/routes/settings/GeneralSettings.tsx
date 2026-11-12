import { useNavigate } from "react-router";
import { Button, Input, Label, Switch } from "@twodb/blocks";
import { Group } from "./parts";
import { del, patch, post } from "../../lib/api";
import { useApiMutation, useSpaces } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { selectCls } from "../projects/CreateProjectDialog";

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-medium">{label}</div><div className="text-xs text-ink-muted">{hint}</div></div><Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></div>;
}

export function GeneralSettings() {
  const { project } = useProjectCtx();
  const nav = useNavigate();
  const { data: spaces = [] } = useSpaces();
  const upd = useApiMutation((b: Record<string, unknown>) => patch(`/projects/${project.key}`, b));
  const archive = useApiMutation((restore: boolean) => post(`/projects/${project.key}/archive`, { restore }));
  const remove = useApiMutation(() => del(`/projects/${project.key}`), { onSuccess: () => nav("/") });
  return (
    <>
      <Group title="General">
        <div className="flex max-w-md flex-col gap-3">
          <div><Label>Name</Label><Input key={project.name} defaultValue={project.name} onBlur={(e) => e.target.value.trim() && e.target.value !== project.name && upd.mutate({ name: e.target.value.trim() })} /></div>
          <div><Label>Description</Label><Input key={project.description} defaultValue={project.description} onBlur={(e) => e.target.value !== project.description && upd.mutate({ description: e.target.value })} /></div>
          <div className="flex gap-3"><div className="w-28"><Label>Key</Label><Input value={project.key} disabled /></div>
            <div className="flex-1"><Label>Space</Label><select className={selectCls} value={project.spaceId} onChange={(e) => upd.mutate({ spaceId: e.target.value })}>{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
          <p className="text-xs text-ink-muted">The key is part of every ticket identifier ({project.key}-1, …) and can't be changed.</p>
        </div>
      </Group>
      <Group title="Features" hint="Turning a feature off only hides it — the data is kept.">
        <div className="flex max-w-xl flex-col gap-4">
          <Toggle label="Sub-tasks" hint="One level of child tickets." checked={project.subtasksEnabled} onChange={(v) => upd.mutate({ subtasksEnabled: v })} />
          <Toggle label="Checklists" hint="Lightweight to-do lists inside a ticket." checked={project.checklistsEnabled} onChange={(v) => upd.mutate({ checklistsEnabled: v })} />
          <Toggle label="Story points" hint="Estimate tickets in points; rolls up on epics and milestones." checked={project.pointsEstimateEnabled} onChange={(v) => upd.mutate({ pointsEstimateEnabled: v })} />
          <Toggle label="Time estimates" hint="Estimate tickets in hours and minutes." checked={project.timeEstimateEnabled} onChange={(v) => upd.mutate({ timeEstimateEnabled: v })} />
        </div>
      </Group>
      <Group title="Danger zone">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => archive.mutate(!!project.archivedAt)}>{project.archivedAt ? "Restore project" : "Archive project"}</Button>
          <Button variant="danger" size="sm" onClick={() => { if (prompt(`Type ${project.key} to permanently delete this project and all its tickets`) === project.key) remove.mutate(); }}>Delete project</Button>
        </div>
      </Group>
    </>
  );
}
