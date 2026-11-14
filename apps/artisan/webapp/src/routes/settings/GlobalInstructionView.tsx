import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { artisanClient } from "../../lib/artisan-client.js";
import { OvertypeEditor } from "../../components/ui/overtype-editor.js";

const MAX = 20_000;

/** Workspace-wide base instruction, added to every agent's system prompt (e.g. "never use emoji"). */
export function GlobalInstructionView() {
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    artisanClient.getGlobalInstruction().then((r) => { setSaved(r.content); setText(r.content); }).catch((e: Error) => setErr(e.message));
  }, []);

  const dirty = saved !== null && text !== saved;
  const save = async () => {
    if (!dirty || busy || text.length > MAX) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await artisanClient.setGlobalInstruction(text);
      setSaved(r.content);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  saveRef.current = save;

  if (saved === null) {
    return err ? <p className="p-6 text-[13px] text-destructive">{err}</p> : <div className="flex flex-1 items-center justify-center text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pb-3 pt-5">
        <h1 className="text-[18px] font-semibold">Global instruction</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Base rules added to the system prompt of every agent — directory agents, personas, collaborators and sub-agents. Applies from each agent's next run. Example: “Never use emoji.”
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-5">
        <div className="flex items-center gap-3">
          <span className={`font-mono text-[11px] ${text.length > MAX ? "text-destructive" : "text-ink-muted"}`}>{text.length.toLocaleString()} / {MAX.toLocaleString()} chars</span>
          <span className="flex-1" />
          {err ? <span className="text-[12px] text-destructive">{err}</span> : null}
          <Button size="sm" variant="primary" disabled={!dirty || busy || text.length > MAX} onClick={() => void save()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} {dirty ? "Save" : "Saved"}
          </Button>
        </div>
        <OvertypeEditor
          value={saved}
          onChange={setText}
          onSave={() => void saveRef.current()}
          ariaLabel="Global instruction"
          placeholder={"- Never use emoji.\n- Keep answers short.\n- Prefer editing existing files over creating new ones."}
          className="min-h-[20rem] flex-1 overflow-hidden rounded-lg bg-surface-muted/50"
        />
      </div>
    </div>
  );
}
