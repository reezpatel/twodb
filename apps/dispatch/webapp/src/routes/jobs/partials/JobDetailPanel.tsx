import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, RefreshCw, Square } from "lucide-react";
import { Badge, Button, Input } from "@twodb/blocks";
import type { Job, JobLogLine } from "../../../lib/dispatch-client.js";

export interface JobDetailPanelProps {
  job: Job | null;
  lines: JobLogLine[];
  error: string | null;
  inputError: string | null;
  busy: boolean;
  sendInput: (input: { data?: string; eof?: boolean }) => Promise<void>;
  terminate: () => Promise<void>;
  reload: () => Promise<void>;
}

/** Job detail: status header, live output stream, stdin feed, terminate. */
export function JobDetailPanel(props: JobDetailPanelProps) {
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Autoscroll the log as lines arrive unless the user scrolled up.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [props.lines.length]);

  if (props.error && !props.job) {
    return <p className="p-6 text-[13px] text-destructive">{props.error}</p>;
  }
  if (!props.job) return <p className="p-6 text-[13px] text-ink-muted">Loading…</p>;

  const j = props.job;
  const running = j.status === "running";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={running ? "info" : j.status === "completed" ? "success" : j.status === "failed" ? "danger" : "neutral"}>
          {j.status}
        </Badge>
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{j.command}</code>
        <span className="text-[12px] text-ink-muted">
          {j.runnerName ?? j.runnerId}
          {j.resourceId ? ` · ${j.resourceId}` : ""}
          {j.exitCode !== null ? ` · exit ${j.exitCode}` : ""}
        </span>
        <Button size="sm" variant="ghost" onClick={() => void props.reload()}>
          <RefreshCw className="size-3.5" />
        </Button>
        {running ? (
          <Button size="sm" variant="danger" disabled={props.busy} onClick={() => void props.terminate()}>
            <Square className="size-3.5" />
            Terminate
          </Button>
        ) : null}
      </div>

      <div
        ref={logRef}
        className="h-[55vh] overflow-auto rounded-md border border-outline bg-surface-muted p-3 font-mono text-[12px] leading-relaxed"
      >
        {props.lines.length === 0 ? (
          <p className="text-ink-muted">no output yet</p>
        ) : (
          props.lines.map((l) => (
            <div key={l.seq} className={l.stream === "stderr" ? "whitespace-pre-wrap text-destructive" : "whitespace-pre-wrap"}>
              {l.line}
            </div>
          ))
        )}
        {running ? <span className="inline-block h-3.5 w-1.5 animate-pulse bg-ink/60" /> : null}
      </div>

      {running ? (
        <div className="flex items-center gap-2">
          <Input
            value={input}
            placeholder="feed stdin (Enter sends the line)"
            className="font-mono text-[12px]"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input) {
                void props.sendInput({ data: `${input}\n` });
                setInput("");
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!input}
            onClick={() => {
              void props.sendInput({ data: `${input}\n` });
              setInput("");
            }}
          >
            Send
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void props.sendInput({ eof: true })}>
            <ArrowDownToLine className="size-3.5" />
            EOF
          </Button>
        </div>
      ) : null}
      {props.inputError ? <p className="text-[12px] text-destructive">{props.inputError}</p> : null}
    </div>
  );
}
