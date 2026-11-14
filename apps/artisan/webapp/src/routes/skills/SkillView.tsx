import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { artisanClient, type AgentInfo, type SkillInfo, type SkillScope, type SpaceInfo } from "../../lib/artisan-client.js";
import { cn } from "../../lib/cn.js";
import { InlineEdit } from "../../components/ui/inline-edit.js";
import { OvertypeEditor } from "../../components/ui/overtype-editor.js";
import { AvailabilityPicker, modeLabel, scopeSummary, scopeValid } from "./partials/AvailabilityPicker.js";

type SkillTab = "content" | "availability";
const TABS: Array<{ id: SkillTab; label: string }> = [
  { id: "content", label: "Content" },
  { id: "availability", label: "Availability" },
];

/** Skill page: name + description (click to edit) over Content (OverType) / Availability tabs. */
export function SkillView({ skillId, agents, onChanged }: { skillId: string; agents: AgentInfo[]; onChanged: () => void | Promise<void> }) {
  const [skill, setSkill] = useState<SkillInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SkillTab>("content");
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);

  useEffect(() => {
    setSkill(null);
    setError(null);
    setTab("content");
    artisanClient.getSkill(skillId).then(setSkill).catch((e: Error) => setError(e.message));
  }, [skillId]);
  useEffect(() => {
    artisanClient.listSpaces().then(setSpaces).catch(() => setSpaces([]));
  }, []);

  const save = useCallback(
    async (patch: Parameters<typeof artisanClient.updateSkill>[1]) => {
      const next = await artisanClient.updateSkill(skillId, patch);
      setSkill(next);
      void onChanged();
    },
    [skillId, onChanged],
  );

  if (error) return <p className="p-6 text-[13px] text-destructive">{error}</p>;
  if (!skill) return <div className="flex flex-1 items-center justify-center text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pt-5">
        <div className="flex items-center gap-2">
          <InlineEdit value={skill.name} placeholder="Skill name" required onSave={(name) => save({ name })} className="text-[18px] font-semibold" />
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted" title="Availability">
            {modeLabel(skill.scope.mode)} · {scopeSummary(skill.scope, { agents, spaces })}
          </span>
        </div>
        <InlineEdit value={skill.description} placeholder="Add a description — listed in the agent's prompt, say when to use it" onSave={(description) => save({ description })} className="mt-0.5 text-[13px] text-ink-muted" />
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors", tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="-mt-px h-px bg-outline/60" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "content" ? <ContentTab key={skill.id} skill={skill} onSave={(content) => save({ content })} /> : null}
        {tab === "availability" ? <AvailabilityTab key={skill.id} skill={skill} agents={agents} spaces={spaces} onSave={(scope) => save({ scope })} /> : null}
      </div>
    </div>
  );
}

function ContentTab({ skill, onSave }: { skill: SkillInfo; onSave: (v: string) => Promise<void> }) {
  const initial = skill.content ?? "";
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = text !== saved;
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true);
    setErr(null);
    try { await onSave(text); setSaved(text); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  saveRef.current = save;

  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-3 px-6 py-4">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[12px] text-ink-muted">
          Loaded on demand — an agent reads this with <code className="font-mono">read_skill</code> when the description matches its task. Markdown.
        </p>
        <span className="shrink-0 font-mono text-[11px] text-ink-muted">{text.length.toLocaleString()} chars</span>
        <Button size="sm" variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} {dirty ? "Save" : "Saved"}
        </Button>
      </div>
      {err ? <p className="text-[12px] text-destructive">{err}</p> : null}
      <OvertypeEditor
        value={saved}
        onChange={setText}
        onSave={() => void saveRef.current()}
        ariaLabel="Skill content"
        placeholder={"# When to use\n\nDescribe the steps the agent should follow…"}
        className="min-h-[20rem] flex-1 overflow-hidden rounded-lg bg-surface-muted/50"
      />
    </div>
  );
}

function AvailabilityTab({ skill, agents, spaces, onSave }: { skill: SkillInfo; agents: AgentInfo[]; spaces: SpaceInfo[]; onSave: (s: SkillScope) => Promise<void> }) {
  const [scope, setScope] = useState<SkillScope>(skill.scope);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const same = JSON.stringify({ ...scope, ids: [...scope.ids].sort() }) === JSON.stringify({ ...skill.scope, ids: [...skill.scope.ids].sort() });

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave(scope);
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-5">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[12px] text-ink-muted">Decides which agents see this skill in their prompt and can read it.</p>
        {err ? <span className="text-[12px] text-destructive">{err}</span> : null}
        <Button size="sm" variant="primary" disabled={same || !scopeValid(scope) || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : flash ? <Check className="size-3.5" /> : null} {flash ? "Saved" : "Save changes"}
        </Button>
      </div>
      <AvailabilityPicker scope={scope} onChange={setScope} agents={agents} spaces={spaces} />
    </div>
  );
}
