import type { ReactNode } from "react";
import { ListCheckIcon, Paperclip, SquarePen } from "lucide-react";
import { ToolBlock, type ToolViewProps } from "./tool-block";

/**
 * How one tool renders in the chat. Every field is optional:
 * - `label`   — header text instead of the raw tool name (e.g. "$" for run_command)
 * - `preview` — header preview from the args instead of the default key lookup
 * - `render`  — a fully custom view; replaces the generic ToolBlock entirely
 *
 * Tools without an entry fall through to the generic ToolBlock.
 */
export interface ToolViewSpec {
  label?: string;
  preview?: (args: Record<string, unknown>) => string | undefined;
  render?: (props: ToolViewProps) => ReactNode;
}

// --- Custom views -------------------------------------------------------------

function ToolChip({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="bg-muted/60 flex items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-xs">
      {icon}
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground truncate">{detail}</span>
    </div>
  );
}

/** update_canvas — the content lives in the canvas tab; show the title only. */
function CanvasChip({ title }: { title: string }) {
  return <ToolChip icon={<SquarePen size={12} className="text-lavender-400 shrink-0" aria-hidden="true" />} label="update_canvas" detail={`· ${title}`} />;
}

/** read_asset — read <file> from <backend>; content stays collapsed. */
function ReadAssetChip({ uri }: { uri: string }) {
  const match = /^twodb:\/\/([^/]+)\/([^/]+)$/.exec(uri);
  const backend = match?.[1] ?? "storage";
  const mediaId = match?.[2] ?? uri;
  return (
    <ToolChip
      icon={<Paperclip size={12} className="text-lavender-400 shrink-0" aria-hidden="true" />}
      label="read-asset"
      detail={`read ${mediaId.length > 8 ? `${mediaId.slice(0, 8)}…` : mediaId} from ${backend}`}
    />
  );
}

/** update_plan — the plan itself lives in the sidebar; just note the change. */
function PlanUpdatedChip(_props: { failed?: boolean }) {
  return (
    <div className="flex items-center gap-2  mb-2">
      <ListCheckIcon className="size-4 text-info/90" />
      <p className="text-info text-xs font-mono">Plan Updated</p>
    </div>
  );
}

/** Chip views need their args; orphan rows (no args) fall back to the generic block. */
function withArgs(render: (args: Record<string, unknown>, props: ToolViewProps) => ReactNode) {
  return (props: ToolViewProps) => (props.args ? render(props.args, props) : <ToolBlock {...props} />);
}

// --- Registry -------------------------------------------------------------------

export const TOOL_VIEWS: Record<string, ToolViewSpec> = {
  run_command: { label: "$" },
  run_background: { label: "bg$" },
  job_logs: { label: "log", preview: (a) => (typeof a.job_id === "string" ? a.job_id : undefined) },
  background_job_status: { label: "jobs" },
  read_skill: { label: "read-skill", preview: (a) => (typeof a.name === "string" ? a.name : undefined) },
  update_canvas: { render: withArgs((a) => <CanvasChip title={String(a.title ?? "")} />) },
  read_asset: { render: withArgs((a) => <ReadAssetChip uri={String(a.uri ?? "")} />) },
  update_plan: { render: (p) => <PlanUpdatedChip failed={p.failed} /> },
};

/** Renders a tool call through its TOOL_VIEWS entry, or the generic ToolBlock. */
export function ToolView(props: ToolViewProps) {
  const spec = TOOL_VIEWS[props.name];
  if (spec?.render) return <>{spec.render(props)}</>;
  return <ToolBlock {...props} label={spec?.label} preview={spec?.preview && props.args ? spec.preview(props.args) : undefined} />;
}
