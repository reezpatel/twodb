import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { post } from "../../lib/api";
import { useApiMutation, useProjectTemplates, useSpaces } from "../../lib/queries";
import type { Project } from "../../lib/types";

const deriveKey = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const k = (words.length > 1 ? words.map((w) => w[0]).join("") : name.replace(/[^a-zA-Z0-9]/g, "")).toUpperCase().slice(0, 5);
  return /^[A-Z]/.test(k) ? k : "";
};
export const selectCls = "h-9 w-full rounded-md border border-outline bg-paper px-2.5 text-sm text-ink outline-none focus:border-ion-deep";

export function CreateProjectDialog({ open, onOpenChange, defaultSpaceId }: { open: boolean; onOpenChange: (o: boolean) => void; defaultSpaceId?: string }) {
  const nav = useNavigate();
  const { data: spaces = [] } = useSpaces();
  const { data: templates = [] } = useProjectTemplates();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [newSpace, setNewSpace] = useState("");

  const create = useApiMutation(
    async () => {
      let sid = spaceId || spaces[0]?.id;
      if (newSpace.trim()) {
        const r = await fetch("/registry/spaces", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newSpace.trim() }) });
        sid = (await r.json()).space.id;
      }
      if (!sid) throw new Error("Pick or create a space first");
      return post<Project>("/projects", { spaceId: sid, key, name, templateId: templateId || undefined });
    },
    { onSuccess: (p) => { onOpenChange(false); setName(""); setKey(""); nav(`/p/${p.key}/tickets`); } },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); create.mutate(undefined, { onError: (er) => setError((er as Error).message) }); }}>
          <div className="flex gap-3">
            <div className="flex-1"><Label>Name</Label><Input autoFocus value={name} onChange={(e) => { setName(e.target.value); if (!keyTouched) setKey(deriveKey(e.target.value)); }} placeholder="Marketing site" /></div>
            <div className="w-28"><Label>Key</Label><Input value={key} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase()); }} placeholder="MKT" maxLength={10} /></div>
          </div>
          <div>
            <Label>Space</Label>
            {spaces.length ? <select className={selectCls} value={spaceId || spaces[0]?.id} onChange={(e) => { setSpaceId(e.target.value); setNewSpace(""); }}>{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select> : null}
            <Input className="mt-2" value={newSpace} onChange={(e) => setNewSpace(e.target.value)} placeholder={spaces.length ? "…or create a new space" : "Create your first space"} />
          </div>
          {templates.length ? (
            <div><Label>Start from template</Label>
              <select className={selectCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">Default workflow</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!name.trim() || !key || create.isPending}>Create project</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
