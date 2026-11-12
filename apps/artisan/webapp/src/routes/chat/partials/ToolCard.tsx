import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

/** A tool call with expandable args/output. */
export function ToolCard(props: { event: { id: string; name: string; args: Record<string, unknown>; output?: string; ok?: boolean } }) {
  const [open, setOpen] = useState(false);
  const t = props.event;
  const done = t.output !== undefined;
  return (
    <div className="my-1.5 rounded-md border border-outline text-[12px]">
      <button type="button" className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left" onClick={() => setOpen((o) => !o)}>
        <ChevronRight className={`size-3 shrink-0 text-ink-muted transition-transform ${open ? "rotate-90" : ""}`} />
        {done ? (
          <span className={`font-mono ${t.ok ? "text-ink" : "text-destructive"}`}>{t.name}</span>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-ink-muted">
            <Loader2 className="size-3 animate-spin" />
            {t.name}
          </span>
        )}
        <span className="ml-auto truncate font-mono text-[11px] text-ink-muted">{argPreview(t.args)}</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-outline px-2.5 py-2">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-muted">args</p>
            <pre className="max-h-40 overflow-auto rounded bg-surface-muted p-2 font-mono text-[11px]">{JSON.stringify(t.args, null, 1)}</pre>
          </div>
          {t.output !== undefined ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-muted">output</p>
              <pre className="max-h-60 overflow-auto rounded bg-surface-muted p-2 font-mono text-[11px] whitespace-pre-wrap">{t.output.slice(0, 4000)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function argPreview(args: Record<string, unknown>): string {
  for (const key of ["command", "path", "prompt", "name", "jobId", "steps"]) {
    const v = args[key];
    if (typeof v === "string" && v) return v.slice(0, 60);
    if (Array.isArray(v)) return `${v.length} items`;
  }
  return "";
}
