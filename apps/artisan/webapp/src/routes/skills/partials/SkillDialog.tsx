import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { artisanClient, type AgentInfo, type SkillInfo, type SkillScope, type SpaceInfo } from "../../../lib/artisan-client.js";
import { AvailabilityPicker, DEFAULT_SCOPE, scopeValid } from "./AvailabilityPicker.js";

/** New skill: name, description and where it is available. The content is written on the skill's page. */
export function SkillDialog({ agents, onClose, onCreated }: { agents: AgentInfo[]; onClose: () => void; onCreated: (skill: SkillInfo) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<SkillScope>(DEFAULT_SCOPE);
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    artisanClient.listSpaces().then(setSpaces).catch(() => setSpaces([]));
  }, []);

  const valid = Boolean(name.trim()) && scopeValid(scope);
  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const skill = await artisanClient.createSkill({ name: name.trim(), description: description.trim(), scope });
      await onCreated(skill);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New skill</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="release-checklist" onKeyDown={(e) => { if (e.key === "Enter") void create(); }} />
            <p className="text-[11px] text-ink-muted">Agents load the skill by this name (read_skill).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description <span className="font-normal text-ink-muted">(listed in the agent's prompt — say when to use it)</span></Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Steps to cut and verify a release" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Available to</Label>
            <AvailabilityPicker scope={scope} onChange={setScope} agents={agents} spaces={spaces} />
          </div>
        </div>
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void create()} disabled={!valid || busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Create skill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
