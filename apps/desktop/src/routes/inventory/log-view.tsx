import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInventoryContext } from "./inventory-provider";
import { useInventoryLog } from "./use-inventory";

export function LogView() {
  const inv = useInventoryContext();
  const log = useInventoryLog(inv.id, null);
  const entries = log.data?.entries ?? [];
  if (log.isPending) return <Loader2 size={16} className="animate-spin" />;
  if (entries.length === 0) return <p className="text-muted-foreground py-16 text-center text-sm">No activity yet.</p>;
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="text-muted-foreground w-36 shrink-0 text-xs tabular-nums">{e.at ? new Date(e.at).toLocaleString() : ""}</span>
          <Badge variant="outline" className="w-20 capitalize">
            {e.action}
          </Badge>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{e.targetLabel}</span>
            <span className="text-muted-foreground"> — {e.title}</span>
            {e.reason ? <span className="text-muted-foreground italic"> ({e.reason})</span> : null}
          </span>
          {e.actor ? <span className="text-muted-foreground text-xs">{e.actor}</span> : null}
        </li>
      ))}
    </ul>
  );
}
