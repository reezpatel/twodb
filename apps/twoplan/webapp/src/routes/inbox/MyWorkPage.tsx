import { useState } from "react";
import { Link } from "react-router";
import { EmptyState, PriorityIcon, Spinner, StatusIcon } from "../../components/Visuals";
import { useMyTickets } from "../../lib/queries";
import { formatDate, today } from "../../lib/format";
import { isOpen } from "../../lib/meta";

const SCOPES = [["assigned", "Assigned to me"], ["watching", "Watching"], ["created", "Created by me"]] as const;

/** Cross-project view of the caller's tickets (all projects in the workspace). */
export function MyWorkPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number][0]>("assigned");
  const { data, isLoading } = useMyTickets(scope);
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <h1 className="mb-4 text-lg font-semibold">My work</h1>
      <div className="mb-4 flex gap-1">{SCOPES.map(([id, label]) => <button key={id} onClick={() => setScope(id)} className={`rounded-md px-3 py-1.5 text-sm ${scope === id ? "bg-paper-grid text-ink" : "text-ink-muted hover:text-ink"}`}>{label}</button>)}</div>
      {isLoading ? <Spinner /> : !data?.length ? <EmptyState title="Nothing here" hint="Open tickets in this scope show up here, across all projects." /> : (
        <div className="overflow-hidden rounded-md border border-outline">
          {data.map((t) => (
            <Link key={t.id} to={`/p/${t.projectKey}/t/${t.identifier}`} className="flex h-10 items-center gap-3 border-b border-outline/60 px-4 text-sm last:border-0 hover:bg-stone">
              <PriorityIcon priority={t.priority} /><span className="w-24 shrink-0 font-mono text-xs text-ink-muted">{t.identifier}</span>
              <StatusIcon category={t.statusCategory} color={t.statusColor} /><span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">{t.projectName}</span>
              {t.dueDate ? <span className={`w-16 shrink-0 text-right text-xs ${t.dueDate < today() && isOpen(t.statusCategory) ? "text-destructive" : "text-ink-muted"}`}>{formatDate(t.dueDate)}</span> : <span className="w-16" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
