import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { get, qs } from "./api";
import type * as T from "./types";

/** Every Fincal query key starts with "fc" so one invalidation refreshes all derived numbers (balances, net worth, budgets…). */
const k = (space: string, what: string, params?: unknown) => ["fc", space, what, params ?? null] as const;

const reg = async <R,>(path: string): Promise<R> => {
  const r = await fetch(path, { credentials: "include" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

export const useSpaces = () => useQuery({ queryKey: ["fc", "_spaces"], queryFn: () => reg<{ spaces: { id: string; name: string }[] }>("/registry/spaces").then((r) => r.spaces), staleTime: 60_000 });

export const useSettings = (s: string) => useQuery({ queryKey: k(s, "settings"), queryFn: () => get<{ currency: string; networthTarget: number | null }>(`/settings${qs({ spaceId: s })}`), staleTime: 300_000 });
export const useOverview = (s: string, month?: string) => useQuery({ queryKey: k(s, "overview", month), queryFn: () => get<T.Overview>(`/overview${qs({ spaceId: s, month })}`) });
export const useAccounts = (s: string) => useQuery({ queryKey: k(s, "accounts"), queryFn: () => get<T.Account[]>(`/accounts${qs({ spaceId: s })}`) });
export const useCategories = (s: string) => useQuery({ queryKey: k(s, "categories"), queryFn: () => get<T.Category[]>(`/categories${qs({ spaceId: s })}`), staleTime: 60_000 });
export const usePayees = (s: string) => useQuery({ queryKey: k(s, "payees"), queryFn: () => get<{ payees: string[]; tags: string[] }>(`/payees${qs({ spaceId: s })}`), staleTime: 60_000 });
export const useTransactions = (s: string, f: Record<string, unknown>) =>
  useQuery({ queryKey: k(s, "txns", f), queryFn: () => get<T.TxnList>(`/transactions${qs({ spaceId: s, ...f })}`), placeholderData: keepPreviousData });
export const useBudgets = (s: string, month: string) => useQuery({ queryKey: k(s, "budgets", month), queryFn: () => get<T.Budgets>(`/budgets${qs({ spaceId: s, month })}`) });
export const useEnvelopes = (s: string) => useQuery({ queryKey: k(s, "envelopes"), queryFn: () => get<T.Envelopes>(`/envelopes${qs({ spaceId: s })}`) });
export const useEnvelopeHistory = (id: string | null) => useQuery({ queryKey: ["fc", "_envhist", id], queryFn: () => get<{ allocations: any[]; expenses: any[] }>(`/envelopes/${id}/history`), enabled: !!id });
export const useGoals = (s: string) => useQuery({ queryKey: k(s, "goals"), queryFn: () => get<T.Goal[]>(`/goals${qs({ spaceId: s })}`) });
export const useGoalContributions = (id: string | null) => useQuery({ queryKey: ["fc", "_goalc", id], queryFn: () => get<any[]>(`/goals/${id}/contributions`), enabled: !!id });
export const useHoldings = (s: string) => useQuery({ queryKey: k(s, "holdings"), queryFn: () => get<T.HoldingsResp>(`/holdings${qs({ spaceId: s })}`) });
export const useHoldingTrades = (id: string | null) => useQuery({ queryKey: ["fc", "_trades", id], queryFn: () => get<any[]>(`/holdings/${id}/trades`), enabled: !!id });
export const useLiabilities = (s: string) => useQuery({ queryKey: k(s, "liabilities"), queryFn: () => get<T.Liability[]>(`/liabilities${qs({ spaceId: s })}`) });
export const useNetWorth = (s: string) => useQuery({ queryKey: k(s, "networth"), queryFn: () => get<T.NetWorth>(`/networth${qs({ spaceId: s })}`) });
export const useRetirement = (s: string) => useQuery({ queryKey: k(s, "retirement"), queryFn: () => get<T.RetirementResp>(`/retirement${qs({ spaceId: s })}`) });
export const useAnalytics = (s: string, from?: string, to?: string) => useQuery({ queryKey: k(s, "analytics", { from, to }), queryFn: () => get<T.Analytics>(`/analytics${qs({ spaceId: s, from, to })}`), placeholderData: keepPreviousData });

/** Mutation that refreshes every Fincal query on success. */
export function useApiMutation<V = void, R = unknown>(fn: (v: V) => Promise<R>, onSuccess?: (r: R) => void) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ["fc"] }); onSuccess?.(r); } });
}
