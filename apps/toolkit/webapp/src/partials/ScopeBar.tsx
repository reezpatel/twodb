import { Button, Tabs, TabsList, TabsTrigger } from "@twodb/blocks";
import type { TwodbScopeType } from "../lib/toolkit-client.js";
import { inputCls } from "./ui.js";

export interface ScopeOption { id: string; name: string; enabled: number }

export interface ScopeBarProps {
  scopeType: TwodbScopeType;
  onScopeType: (t: TwodbScopeType) => void;
  options: ScopeOption[];
  scopeId: string | null;
  onScopeId: (id: string | null) => void;
  spaceCount: number;
  agentCount: number;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/** Dumb scope picker: Spaces | Agents tabs, the chosen scope's dropdown (with how many tools it already has), Save / Discard. */
export function ScopeBar(props: ScopeBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Tabs value={props.scopeType} onValueChange={(v) => props.onScopeType(v as TwodbScopeType)}>
        <TabsList variant="default" size="sm">
          <TabsTrigger value="space">Spaces <span className="text-[10px] text-ink-muted">{props.spaceCount}</span></TabsTrigger>
          <TabsTrigger value="agent">Agents <span className="text-[10px] text-ink-muted">{props.agentCount}</span></TabsTrigger>
        </TabsList>
      </Tabs>
      <select
        aria-label={props.scopeType === "space" ? "Space" : "Agent"}
        value={props.scopeId ?? ""}
        onChange={(e) => props.onScopeId(e.target.value || null)}
        className={`${inputCls} min-w-0 flex-1 sm:max-w-sm`}
      >
        <option value="">{props.scopeType === "space" ? "Choose a space…" : "Choose an agent…"}</option>
        {props.options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}{o.enabled ? ` · ${o.enabled} enabled` : ""}</option>
        ))}
      </select>
      <div className="flex items-center gap-2 sm:ml-auto">
        {props.dirty ? <span className="text-[12px] text-warning">Unsaved changes</span> : null}
        <Button size="sm" variant="ghost" disabled={!props.dirty || props.saving} onClick={props.onDiscard}>Discard</Button>
        <Button size="sm" variant="primary" disabled={!props.dirty || props.saving} onClick={props.onSave}>{props.saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
