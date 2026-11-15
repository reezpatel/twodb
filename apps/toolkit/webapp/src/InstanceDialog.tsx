import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toolkitClient, type ConnectorInstance, type ConnectorTemplate, type Scope } from "./lib/toolkit-client.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { ScopePicker } from "./partials/ScopePicker.js";
import { AgentAccessPicker } from "./partials/AgentAccessPicker.js";
import { Overlay, btnGhost, btnPrimary, inputCls, labelCls } from "./partials/ui.js";

const MASK = "••••••••";

/** Configure (create) or edit a connector instance. Health-checks on save. */
export function InstanceDialog({ data, template, initial, onClose }: {
  data: ToolkitData;
  template: ConnectorTemplate;
  initial: ConnectorInstance | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of template.fields) out[f.key] = initial?.config[f.key] ?? "";
    return out;
  });
  const [scope, setScope] = useState<Scope>(initial?.scope ?? { all: true, ids: [] });
  const [agentIds, setAgentIds] = useState<string[]>(initial?.agentIds ?? []);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setErr(null), [name, values, scope]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (initial) {
        await toolkitClient.updateInstance(initial.id, { name: name.trim(), config: values, enabled, scope, agentIds, force });
      } else {
        await toolkitClient.createInstance({ templateId: template.id, name: name.trim(), config: values, enabled, scope, agentIds, force });
      }
      await data.refreshInstances();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay title={initial ? `Edit ${initial.name}` : `New ${template.name} instance`} onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>Instance name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering workspace" className={`${inputCls} mt-1`} />
        </div>

        {template.fields.map((f: ConnectorTemplate["fields"][number]) => (
          <div key={f.key}>
            <label className={labelCls}>
              {f.label}
              {f.required !== false && !f.optional ? " *" : ""} {f.secret ? <span className="text-ink-muted/70">(secret)</span> : null}
            </label>
            <input
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className={`${inputCls} mt-1 ${f.secret || f.key === "baseUrl" || f.key === "workspaceSlug" ? "font-mono" : ""}`}
              autoComplete="off"
            />
            {f.help ? <p className="mt-1 text-[11px] text-ink-muted">{f.help}</p> : null}
          </div>
        ))}

        <div>
          <label className={labelCls}>Spaces</label>
          <div className="mt-1.5">
            <ScopePicker spaces={data.spaces} value={scope} onChange={setScope} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Agent access</label>
          <div className="mt-1.5">
            <AgentAccessPicker agents={data.agents} value={agentIds} onChange={setAgentIds} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-accent" />
          Enabled (broadcasts poll + tools callable)
        </label>

        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
            <p className="text-[12px] text-destructive">{err}</p>
            <label className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Save anyway (skip health check)
            </label>
          </div>
        ) : null}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy || !name.trim()} onClick={() => void save()} className={btnPrimary}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} {initial ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
