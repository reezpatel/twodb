import { motion } from "framer-motion";
import { Terminal, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@twodb/blocks";
import type { Runner } from "../../../lib/dispatch-client.js";

export interface RunnerCardProps {
  runner: Runner;
  busy: boolean;
  onExec: () => void;
  onDelete: () => void;
}

/** Dumb runner card: status, metadata, quick actions. */
export function RunnerCard(props: RunnerCardProps) {
  const r = props.runner;
  const meta = r.meta ?? {};
  return (
    <motion.div whileHover={{ y: -2 }}>
      <Card className="overflow-hidden">
        <div className="h-px w-full bg-ink/10" />
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-block size-2 rounded-full ${r.status === "online" ? "bg-emerald-500" : "bg-stone-400"}`} />
                <h3 className="truncate text-[14px] font-medium text-ink">{r.name}</h3>
              </div>
              <p className="mt-1 text-[12px] text-ink-muted">
                {String(meta.os ?? "?")}/{String(meta.arch ?? "?")} · agent {String(meta.version ?? "?")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={r.status === "online" ? "success" : "neutral"}>{r.status}</Badge>
              <Badge>{r.kind === "microvm-host" ? "microvm host" : "host"}</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-muted">
            <span>{r.lastSeenAt ? `seen ${timeAgo(r.lastSeenAt)}` : "never connected"}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="secondary" disabled={r.status !== "online"} onClick={props.onExec}>
              <Terminal className="size-3.5" />
              Exec
            </Button>
            <Button size="sm" variant="ghost" disabled={props.busy} onClick={props.onDelete}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
