import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import type { Crumb } from "../hooks/useBreadcrumbs.js";

/** Dumb/presentational — "Apps / TwoMail"; earlier crumbs are links, the last is the current page. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-ink-muted/60" aria-hidden /> : null}
            {c.to ? (
              <Link
                to={c.to}
                className="truncate rounded-sm text-ink-muted font-light outline-none transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ion-deep"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-base text-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
