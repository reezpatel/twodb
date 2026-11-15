import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useAccounts } from "../../lib/queries";
import { ACCOUNT_TYPES, accountMeta } from "../../lib/meta";
import { pct } from "../../lib/format";
import { EmptyState, Page, PageHeader, Progress, Section, Spinner, Stat } from "../../components/Ui";
import { AccountDialog } from "./AccountDialog";
import { TxnDialog } from "../transactions/TxnDialog";
import type { Account } from "../../lib/types";

export function AccountsPage() {
  const { spaceId, money } = useSpace();
  const { data: accounts, isLoading } = useAccounts(spaceId);
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Account | null>(null);
  if (isLoading || !accounts) return <Spinner />;

  const cards = accounts.filter((a) => a.type === "credit_card");
  const liquid = accounts.filter((a) => a.type !== "credit_card").reduce((s, a) => s + a.balance, 0);
  const dues = cards.reduce((s, a) => s + (a.due ?? 0), 0);

  return (
    <Page>
      <PageHeader title="Accounts & cards" subtitle="Bank accounts, cash, UPI, wallets and credit cards" actions={<Button size="sm" onClick={() => setCreating(true)}><Plus />New account</Button>} />
      {!accounts.length ? <EmptyState title="No accounts yet" hint="Add each place your money lives — bank accounts, cash, UPI apps, wallets and credit cards." action={<Button onClick={() => setCreating(true)}>Add your first account</Button>} /> : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Cash & bank" value={money(liquid)} />
            <Stat label="Card dues" value={money(dues)} tone={dues > 0 ? "bad" : undefined} />
            <Stat label="Net liquid" value={money(liquid - dues)} tone={liquid - dues >= 0 ? "good" : "bad"} />
          </div>
          {ACCOUNT_TYPES.map((t) => {
            const items = accounts.filter((a) => a.type === t.id);
            if (!items.length) return null;
            return (
              <Section key={t.id} title={t.label + (items.length > 1 ? "s" : "")} className="mb-4">
                <ul className="divide-y divide-outline">
                  {items.map((a) => { const Icon = accountMeta(a.type).icon; return (
                    <li key={a.id} className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full text-white" style={{ background: a.color }}><Icon className="size-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{a.name}{!a.includeInNetworth ? <span className="ml-2 text-xs font-normal text-ink-muted">excluded from net worth</span> : null}</div>
                          <div className="text-xs text-ink-muted">{a.institution ?? ""}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold tabular-nums ${a.balance < 0 && a.type !== "credit_card" ? "text-destructive" : ""}`}>{a.type === "credit_card" ? money(a.due ?? 0) : money(a.balance)}</div>
                          {a.type === "credit_card" ? <div className="text-xs text-ink-muted">outstanding{a.balance > 0 ? ` (${money(a.balance)} credit)` : ""}</div> : null}
                        </div>
                        <div className="flex gap-1">
                          {a.type === "credit_card" ? <Button variant="ghost" size="sm" onClick={() => setPaying(a)}>Pay bill</Button> : null}
                          <Link to={`/s/${spaceId}/transactions?account=${a.id}`}><Button variant="ghost" size="sm">History</Button></Link>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>Edit</Button>
                        </div>
                      </div>
                      {a.type === "credit_card" && a.creditLimit ? (
                        <div className="mt-2 pl-11">
                          <Progress pct={a.utilizationPct ?? 0} over={(a.utilizationPct ?? 0) > 70} />
                          <div className="mt-1 flex justify-between text-xs text-ink-muted"><span>{pct(a.utilizationPct, 0)} of {money(a.creditLimit)} used · {money(a.available)} available</span><span>{a.statementDay ? `Statement ${a.statementDay}th` : ""}{a.statementDay && a.dueDay ? " · " : ""}{a.dueDay ? `Due ${a.dueDay}th` : ""}</span></div>
                        </div>
                      ) : null}
                    </li>
                  ); })}
                </ul>
              </Section>
            );
          })}
        </>
      )}
      {creating ? <AccountDialog open onOpenChange={setCreating} /> : null}
      {editing ? <AccountDialog open onOpenChange={(o) => !o && setEditing(null)} account={editing} key={editing.id} /> : null}
      {paying ? <TxnDialog open onOpenChange={(o) => !o && setPaying(null)} defaults={{ kind: "transfer", toAccountId: paying.id, amount: paying.due || undefined }} key={paying.id} /> : null}
    </Page>
  );
}
