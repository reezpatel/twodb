import { ChevronRight } from "lucide-react";
import { Checkbox, cn } from "@twodb/blocks";
import { Badge } from "../lib/badge.js";
import { DataTable, TableCard, Td, Tr } from "../lib/data-table.js";
import type { TwodbTool } from "../lib/toolkit-client.js";

export interface ToolGroupProps {
  appName: string;
  slug: string;
  tools: TwodbTool[];
  enabled: Set<string>;
  open: boolean;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (keys: string[], on: boolean) => void;
}

const METHOD_TONE: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = { GET: "info", POST: "success", PUT: "warning", PATCH: "warning", DELETE: "danger" };

/** Dumb collapsible app section: tri-state "all in app" checkbox in the header, one checkbox row per tool. */
export function ToolGroup(props: ToolGroupProps) {
  const on = props.tools.filter((t) => props.enabled.has(t.key)).length;
  const all = on === props.tools.length;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <Checkbox
          aria-label={`Enable all ${props.appName} tools`}
          checked={all ? true : on > 0 ? "indeterminate" : false}
          disabled={props.disabled}
          className="data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-stone"
          onCheckedChange={(v) => props.onToggle(props.tools.map((t) => t.key), v === true)}
        />
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={props.open} onClick={() => props.onOpenChange(!props.open)}>
          <ChevronRight className={cn("size-4 shrink-0 text-ink-muted transition-transform", props.open && "rotate-90")} />
          <span className="truncate text-[13px] font-semibold text-ink">{props.appName}</span>
          <span className="font-mono text-[11px] text-ink-muted">{props.slug}</span>
          <span className="ml-auto shrink-0 text-[12px] text-ink-muted">{on} / {props.tools.length}</span>
        </button>
      </div>
      {props.open ? (
        <TableCard>
          <DataTable columns={["", "Tool", { label: "Method", mobile: false }, { label: "Description", mobile: false }]} minWidth={0}>
            {props.tools.map((t) => (
              <Tr key={t.key} onClick={props.disabled ? undefined : () => props.onToggle([t.key], !props.enabled.has(t.key))}>
                <Td className="w-10" >
                  <Checkbox aria-label={`Enable ${t.key}`} checked={props.enabled.has(t.key)} disabled={props.disabled} onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => props.onToggle([t.key], v === true)} />
                </Td>
                <Td className="font-mono font-medium text-ink">
                  <span className="block max-w-[16rem] truncate sm:max-w-none" title={`${t.method} ${t.path}`}>{t.name}</span>
                </Td>
                <Td hideOnMobile><Badge tone={METHOD_TONE[t.method] ?? "neutral"}>{t.method}</Badge></Td>
                <Td hideOnMobile className="max-w-[34rem] truncate text-ink-muted"><span title={t.description}>{t.description || "—"}</span></Td>
              </Tr>
            ))}
          </DataTable>
        </TableCard>
      ) : null}
    </section>
  );
}
