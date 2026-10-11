import { CheckCheck, CloudUpload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PendingChange } from "../calendar-api";
import { PendingRow } from "./pending-row";
import { usePendingPush } from "./use-pending-push";

export function PendingPush({ tz, onOpenEvent }: { tz: string; onOpenEvent: (row: PendingChange) => void }) {
  const p = usePendingPush();
  const busy = p.approve.isPending || p.reject.isPending || p.retry.isPending || p.resolve.isPending;
  const approvable = p.rows.filter((r) => r.canApprove);
  const attention = (p.history.data ?? []).filter((r) => r.status === "failed" || r.status === "conflict");
  const recent = (p.history.data ?? []).filter((r) => r.status !== "failed" && r.status !== "conflict");

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <header className="flex flex-wrap items-center gap-3">
        <CloudUpload size={18} />
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Pending push</h2>
          <p className="text-muted-foreground text-xs">
            Changes to Google, Microsoft and CalDAV calendars wait here. Approve sends them; reject keeps them in twodb only.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={p.filter.accountId ?? "all"} onValueChange={(v) => p.setFilter({ ...p.filter, accountId: v === "all" ? null : v })}>
            <SelectTrigger size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {p.accounts.map(([id, address]) => (
                <SelectItem key={id} value={id}>
                  {address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={p.filter.op ?? "all"} onValueChange={(v) => p.setFilter({ ...p.filter, op: v === "all" ? null : v })}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All changes</SelectItem>
              <SelectItem value="create">Creates</SelectItem>
              <SelectItem value="update">Updates</SelectItem>
              <SelectItem value="delete">Deletes</SelectItem>
              <SelectItem value="rsvp">RSVPs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={approvable.length > 0 && p.checked.size === approvable.length ? true : p.checked.size ? "indeterminate" : false}
          onCheckedChange={(v) => p.checkAll(v === true)}
          aria-label="Select all"
          disabled={!approvable.length}
        />
        <span className="text-muted-foreground text-sm">{p.rows.length} waiting</span>
        {p.checked.size ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => p.approve.mutate([...p.checked])}>
              Approve {p.checked.size}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => p.reject.mutate([...p.checked])}>
              Reject {p.checked.size}
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={busy || !approvable.length}
          onClick={() =>
            window.confirm(`Approve all ${approvable.length} changes${p.filter.accountId || p.filter.op ? " matching the filter" : ""}?`) &&
            p.approve.mutate("all")
          }
        >
          {p.approve.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Approve all
        </Button>
      </div>
      {p.approve.error || p.reject.error ? <p className="text-destructive text-xs">{(p.approve.error ?? p.reject.error)?.message}</p> : null}

      {p.awaiting.isLoading ? <Loader2 className="text-muted-foreground animate-spin" /> : null}
      {!p.awaiting.isLoading && !p.rows.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nothing waiting. Edits to provider calendars show up here.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {p.rows.map((row) => (
          <PendingRow
            key={row.id}
            row={row}
            tz={tz}
            busy={busy}
            checked={p.checked.has(row.id)}
            onCheck={() => p.toggle(row.id)}
            onApprove={() => p.approve.mutate([row.id])}
            onReject={() => p.reject.mutate([row.id])}
            onOpen={() => onOpenEvent(row)}
          />
        ))}
      </div>

      {attention.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-destructive text-xs font-semibold tracking-wider uppercase">Needs attention</h3>
          {attention.map((row) => (
            <PendingRow
              key={row.id}
              row={row}
              tz={tz}
              history
              busy={busy}
              onOpen={() => onOpenEvent(row)}
              onRetry={() => p.retry.mutate(row.id)}
              onResolve={(resolution) => p.resolve.mutate({ id: row.id, resolution })}
            />
          ))}
        </div>
      ) : null}

      {recent.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">History · last 14 days</h3>
          {recent.map((row) => (
            <PendingRow key={row.id} row={row} tz={tz} history busy={busy} onOpen={() => onOpenEvent(row)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
