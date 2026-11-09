import { Loader2 } from "lucide-react";
import type { LlmConnection, LlmModel } from "../../../../lib/llm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function fmtTokens(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function fmtCost(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n < 1 ? n.toFixed(2).replace(/^0/, "") : n.toFixed(2)}`;
}

function Check({ on }: { on: boolean }) {
  return on ? <span className="text-success">✓</span> : <span className="text-muted-foreground/50">—</span>;
}

export function ConnectionModelsDialog({
  connection,
  models,
  pending,
  onClose,
}: {
  connection: LlmConnection | null;
  models: LlmModel[] | undefined;
  pending: boolean;
  onClose: () => void;
}) {
  if (!connection) return null;

  return (
    <Dialog open={!!connection} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Models — {connection.name}</DialogTitle>
          <DialogDescription>
            {models?.length ?? 0} models{pending ? ", loading…" : ""} · limits/costs per million tokens where known
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Model</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Max In / Out</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Thinking</TableHead>
                <TableHead>Modalities</TableHead>
                <TableHead className="text-right">Cost /M (in · out · cache)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(models ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="max-w-64">
                    <div className="truncate font-mono text-xs">{m.modelId}</div>
                    {m.displayName && m.displayName !== m.modelId && <div className="text-muted-foreground truncate text-xs">{m.displayName}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{fmtTokens(m.limitContext ?? m.contextWindow)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {fmtTokens(m.limitInput)} / {fmtTokens(m.limitOutput)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Check on={m.temperature} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.thinking ? (
                      <div className="flex flex-col gap-0.5">
                        <Check on />
                        {m.thinkingLevel.length > 0 && <span className="text-muted-foreground text-[10px]">{m.thinkingLevel.join(" · ")}</span>}
                      </div>
                    ) : (
                      <Check on={false} />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[11px]">
                    <div>{m.input.length > 0 ? `in: ${m.input.join(",")}` : "in: —"}</div>
                    <div>{m.output.length > 0 ? `out: ${m.output.join(",")}` : "out: —"}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right font-mono text-[11px] whitespace-nowrap">
                    {fmtCost(m.costInput)} · {fmtCost(m.costOutput)} · {fmtCost(m.costCacheRead)}
                  </TableCell>
                </TableRow>
              ))}
              {!pending && (models ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground p-6 text-center text-sm">
                    No models stored — hit Sync to fetch the list.
                  </TableCell>
                </TableRow>
              )}
              {pending && (models ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-6">
                    <Loader2 className="text-muted-foreground mx-auto size-4 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
