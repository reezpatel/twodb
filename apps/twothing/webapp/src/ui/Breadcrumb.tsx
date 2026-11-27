import { cn } from "@twodb/blocks";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { back, Link } from "../lib/router";

export interface Crumb {
  label: ReactNode;
  to?: string;
}

/** Header breadcrumb: optional back icon, then `Parent / Parent / Current`. The last crumb is the current page. Same size on every page. */
export function Breadcrumb({ items, onBack, className }: { items: Crumb[]; onBack?: boolean | string; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-2 text-[13px] leading-none", className)}>
      {onBack && (
        <button
          aria-label="Back"
          onClick={() => back(typeof onBack === "string" ? onBack : "/")}
          className="grid size-7 shrink-0 place-items-center rounded-[6px] text-ink-muted transition hover:bg-stone hover:text-ink"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </button>
      )}
      <ol className="flex min-w-0 items-center gap-2">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={cn("flex items-center gap-2", last ? "min-w-0" : "shrink-0")}>
              {last ? (
                <h1 aria-current="page" className="truncate font-normal text-ink">
                  {c.label}
                </h1>
              ) : c.to ? (
                <Link to={c.to} className="font-normal text-ink-muted hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink-muted">{c.label}</span>
              )}
              {!last && <span className="text-ink-muted/60">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
