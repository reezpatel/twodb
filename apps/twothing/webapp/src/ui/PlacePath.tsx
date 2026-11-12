import { cn } from "@twodb/blocks";
import { ChevronRight, MapPinOff } from "lucide-react";
import { kindOf } from "../lib/catalog";
import { Link } from "../lib/router";
import type { Crumb } from "../lib/types";

/** Room › Shelf › Box breadcrumb; each crumb links to that place. */
export function PlacePath({ path, className, linked = true, compact }: { path: Crumb[]; className?: string; linked?: boolean; compact?: boolean }) {
  if (!path.length)
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-ink-muted", className)}>
        <MapPinOff className="size-3" /> Unplaced
      </span>
    );
  const shown = compact && path.length > 2 ? [path[0], null, path[path.length - 1]] : path;
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-0.5 text-xs text-ink-muted", className)}>
      {shown.map((c, i) => {
        if (!c) return <span key="gap">…</span>;
        const Icon = kindOf(c.kind).icon;
        const inner = (
          <>
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{c.name}</span>
          </>
        );
        return (
          <span key={c.id} className="inline-flex min-w-0 items-center gap-0.5">
            {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-50" />}
            {linked ? (
              <Link to={`/places/${c.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex min-w-0 items-center gap-1 rounded px-0.5 hover:text-ink hover:underline">
                {inner}
              </Link>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-1">{inner}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
