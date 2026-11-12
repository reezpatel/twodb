import { cn } from "@twodb/blocks";
import { ArrowRightLeft, FilePlus2, Minus, Pencil, Plus, QrCode, Trash2, Upload } from "lucide-react";
import { formatQty, timeAgo } from "../lib/format";
import { Link } from "../lib/router";
import type { Activity } from "../lib/types";

const ICON = { created: FilePlus2, updated: Pencil, moved: ArrowRightLeft, labeled: QrCode, deleted: Trash2, imported: Upload } as const;

export function describe(a: Activity): string {
  const d = a.detail as Record<string, unknown>;
  switch (a.action) {
    case "created":
      return a.targetKind === "item" ? `Added${d.quantity !== undefined ? ` (${formatQty(Number(d.quantity))} ${d.unit ?? ""})` : ""}` : `Created ${d.kind ?? "place"}${d.parent ? ` in ${d.parent}` : ""}`;
    case "quantity": {
      const delta = Number(d.delta);
      return `${delta > 0 ? "+" : ""}${formatQty(delta)} → ${formatQty(Number(d.to))}${d.reason ? ` · ${d.reason}` : ""}`;
    }
    case "moved":
      return `Moved ${d.from ? `from ${d.from} ` : ""}to ${d.to ?? "unplaced"}`;
    case "labeled":
      return d.to ? `Label set to ${String(d.to).replace(/^(.{3})(.{3})$/, "$1-$2")}` : "Label removed";
    case "updated":
      return `Edited ${(d.fields as string[] | undefined)?.join(", ") ?? ""}`;
    case "deleted":
      return "Deleted";
    case "imported":
      return `Imported ${d.created ?? ""} items`;
    default:
      return a.action;
  }
}

export function ActivityList({ entries, showTarget, empty = "No activity yet." }: { entries: Activity[]; showTarget?: boolean; empty?: string }) {
  if (!entries.length) return <div className="py-6 text-center text-sm text-ink-muted">{empty}</div>;
  return (
    <ol className="relative space-y-0.5">
      {entries.map((a) => {
        const delta = a.action === "quantity" ? Number((a.detail as { delta?: number }).delta) : 0;
        const Icon = a.action === "quantity" ? (delta >= 0 ? Plus : Minus) : ICON[a.action];
        const linkable = showTarget && a.action !== "deleted" && a.targetId !== "import";
        return (
          <li key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-stone/50">
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border",
                a.action === "quantity" && delta >= 0 && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
                a.action === "quantity" && delta < 0 && "border-amber-500/30 bg-amber-500/10 text-amber-600",
                a.action === "deleted" && "border-destructive/30 bg-destructive/10 text-destructive",
                a.action !== "quantity" && a.action !== "deleted" && "border-outline bg-paper text-ink-muted",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              {showTarget &&
                (linkable ? (
                  <Link to={`/${a.targetKind === "item" ? "items" : "places"}/${a.targetId}`} className="font-semibold hover:underline">
                    {a.targetName}
                  </Link>
                ) : (
                  <span className="font-semibold">{a.targetName}</span>
                ))}
              <div className={cn("text-ink-muted", !showTarget && "text-ink")}>{describe(a)}</div>
            </div>
            <time className="shrink-0 text-xs text-ink-muted" dateTime={a.at} title={new Date(a.at).toLocaleString()}>
              {timeAgo(a.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
