import { motion } from "framer-motion";
import { Badge, Button, Card, CardContent } from "@twodb/blocks";
import type { Microvm } from "../../../lib/dispatch-client.js";

export interface MicrovmCardProps {
  vm: Microvm;
  busy: boolean;
  onOpen: () => void;
  onShutdown: (archive: boolean) => void;
}

/** Dumb microvm card: identifier, lifecycle status, boot count, actions. */
export function MicrovmCard(props: MicrovmCardProps) {
  const vm = props.vm;
  const tone = vm.status === "running" ? "success" : vm.status === "failed" ? "danger" : "neutral";
  return (
    <motion.div whileHover={{ y: -2 }}>
      <Card className="overflow-hidden">
        <div className="h-px w-full bg-ink/10" />
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-medium text-ink">{vm.identifier}</h3>
              <p className="mt-1 text-[12px] text-ink-muted">
                {vm.runnerName ?? vm.runnerId} · {vm.bootCount} boot{vm.bootCount === 1 ? "" : "s"}
              </p>
            </div>
            <Badge tone={tone}>{vm.status}</Badge>
          </div>
          <p className="text-[11px] text-ink-muted">active {timeAgo(vm.lastActiveAt)}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={props.onOpen}>
              Open
            </Button>
            {vm.status === "running" ? (
              <>
                <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onShutdown(true)}>
                  Stop & archive
                </Button>
                <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onShutdown(false)}>
                  Stop
                </Button>
              </>
            ) : null}
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
