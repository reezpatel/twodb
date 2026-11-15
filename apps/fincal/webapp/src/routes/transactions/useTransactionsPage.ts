import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useSpace } from "../../lib/space";
import { useAccounts, useCategories, useTransactions } from "../../lib/queries";
import { thisMonth } from "../../lib/format";
import type { Txn } from "../../lib/types";

export const RANGES = [
  { id: "month", label: "This month" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }, { id: "year", label: "This year" }, { id: "all", label: "All time" },
] as const;

function rangeDates(id: string): { from?: string } {
  const d = new Date();
  if (id === "month") return { from: `${thisMonth()}-01` };
  if (id === "year") return { from: `${d.getFullYear()}-01-01` };
  if (id === "30" || id === "90") { d.setDate(d.getDate() - Number(id)); return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }; }
  return {};
}

/** Holding hook: filters + paging state, data and grouping for the transactions page. */
export function useTransactionsPage() {
  const { spaceId } = useSpace();
  const [params] = useSearchParams();
  const [range, setRange] = useState<string>(params.get("account") ? "all" : "month");
  const [accountId, setAccountId] = useState(params.get("account") ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(200);
  const filters = useMemo(() => ({ ...rangeDates(range), accountId, categoryId, kind, q: q.trim(), limit }), [range, accountId, categoryId, kind, q, limit]);
  const txns = useTransactions(spaceId, filters);
  const accounts = useAccounts(spaceId);
  const categories = useCategories(spaceId);
  const [editing, setEditing] = useState<Txn | null>(null);
  const [creating, setCreating] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    for (const t of txns.data?.items ?? []) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m];
  }, [txns.data]);

  return {
    range, setRange, accountId, setAccountId, categoryId, setCategoryId, kind, setKind, q, setQ, limit, setLimit,
    txns, accounts: accounts.data ?? [], categories: categories.data ?? [], groups, editing, setEditing, creating, setCreating,
    hasFilters: !!(accountId || categoryId || kind || q),
    clear: () => { setAccountId(""); setCategoryId(""); setKind(""); setQ(""); },
  };
}
