import { Download, Plus, Search } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { dateLabel, titleCase } from "../../lib/format";
import { amountCls, EmptyState, Page, PageHeader, selectCls, Spinner, Swatch } from "../../components/Ui";
import { RANGES, useTransactionsPage } from "./useTransactionsPage";
import { TxnDialog } from "./TxnDialog";
import type { Txn } from "../../lib/types";

function toCsv(items: Txn[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["date", "kind", "amount", "account", "to_account", "category", "payee", "method", "tags", "envelope", "note"];
  return [head.join(","), ...items.map((t) => [t.date, t.kind, t.amount, t.accountName, t.toAccountName, t.categoryName, t.payee, t.method, t.tags.join(" "), t.envelopeName, t.note].map(esc).join(","))].join("\n");
}

export function TransactionsPage() {
  const { money } = useSpace();
  const p = useTransactionsPage();
  const data = p.txns.data;
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(data?.items ?? [])], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "transactions.csv" });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader title="Transactions" subtitle={data ? `${data.total} transactions · ${money(data.income)} in · ${money(data.expense)} out` : undefined}
        actions={<><Button variant="ghost" size="sm" onClick={exportCsv} disabled={!data?.items.length}><Download />CSV</Button><Button size="sm" onClick={() => p.setCreating(true)} disabled={!p.accounts.length}><Plus />Add</Button></>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1"><Search className="absolute top-2.5 left-2.5 size-4 text-ink-muted" /><Input className="pl-8" placeholder="Search payee or note" value={p.q} onChange={(e) => p.setQ(e.target.value)} /></div>
        <select className={`${selectCls} !w-auto`} value={p.range} onChange={(e) => p.setRange(e.target.value)}>{RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <select className={`${selectCls} !w-auto`} value={p.accountId} onChange={(e) => p.setAccountId(e.target.value)}><option value="">All accounts</option>{p.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className={`${selectCls} !w-auto`} value={p.categoryId} onChange={(e) => p.setCategoryId(e.target.value)}><option value="">All categories</option>{p.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className={`${selectCls} !w-auto`} value={p.kind} onChange={(e) => p.setKind(e.target.value)}><option value="">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option></select>
        {p.hasFilters ? <Button variant="ghost" size="sm" onClick={p.clear}>Clear</Button> : null}
      </div>

      {p.txns.isLoading ? <Spinner /> : !data?.items.length ? (
        <EmptyState title={p.hasFilters ? "No matching transactions" : "No transactions yet"} hint={p.accounts.length ? "Record an expense, income or transfer." : "Add an account first, then record transactions."} />
      ) : (
        <div className="overflow-hidden rounded-md border border-outline bg-card">
          {p.groups.map(([date, items]) => (
            <div key={date}>
              <div className="flex justify-between bg-paper-grid px-4 py-1.5 text-xs font-medium text-ink-muted"><span>{dateLabel(date)}</span><span className="tabular-nums">{money(items.reduce((s, t) => s + (t.kind === "income" ? t.amount : t.kind === "expense" ? -t.amount : 0), 0))}</span></div>
              <ul className="divide-y divide-outline">
                {items.map((t) => (
                  <li key={t.id}>
                    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper-grid" onClick={() => p.setEditing(t)}>
                      <Swatch color={t.kind === "transfer" ? "#64748b" : t.categoryColor ?? "#9ca3af"} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{t.payee || t.categoryName || (t.kind === "transfer" ? "Transfer" : "—")}{t.note ? <span className="text-ink-muted"> · {t.note}</span> : null}</div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                          <span>{t.accountName}{t.kind === "transfer" ? ` → ${t.toAccountName}` : ""}</span>
                          {t.categoryName ? <span>· {t.categoryName}</span> : null}
                          {t.method ? <span>· {titleCase(t.method)}</span> : null}
                          {t.envelopeName ? <span>· ✉ {t.envelopeName}</span> : null}
                          {t.tags.map((g) => <span key={g} className="rounded-sm bg-paper-grid px-1">#{g}</span>)}
                        </div>
                      </div>
                      <span className={`tabular-nums ${t.kind === "income" ? amountCls(1) : t.kind === "transfer" ? "text-ink-muted" : ""}`}>{t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""}{money(t.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {data && data.total > data.items.length ? <div className="mt-4 text-center"><Button variant="ghost" onClick={() => p.setLimit(p.limit + 200)}>Show more ({data.total - data.items.length} left)</Button></div> : null}
      {p.creating ? <TxnDialog open onOpenChange={p.setCreating} /> : null}
      {p.editing ? <TxnDialog open onOpenChange={(o) => !o && p.setEditing(null)} txn={p.editing} /> : null}
    </Page>
  );
}
