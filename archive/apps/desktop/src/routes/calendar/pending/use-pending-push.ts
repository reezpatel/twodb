import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { calendarKeys, type PendingChange } from "../calendar-api";

export interface PendingFilter {
  accountId: string | null;
  op: string | null;
}

export function usePendingPush() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PendingFilter>({ accountId: null, op: null });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => !!v) as [string, string][]).toString();
  const awaiting = useQuery({ queryKey: calendarKeys.pending(false, qs), queryFn: () => api<PendingChange[]>(`/api/calendar/pending?${qs}`) });
  const history = useQuery({ queryKey: calendarKeys.pending(true, qs), queryFn: () => api<PendingChange[]>(`/api/calendar/pending?history=1&${qs}`) });

  const refresh = () => {
    setChecked(new Set());
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
  };
  const body = (ids: string[] | "all") => JSON.stringify(ids === "all" ? { all: true, filter } : { ids });
  const approve = useMutation({
    mutationFn: (ids: string[] | "all") => api<{ approved: number }>("/api/calendar/pending/approve", { method: "POST", body: body(ids) }),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: (ids: string[] | "all") => api<{ rejected: number }>("/api/calendar/pending/reject", { method: "POST", body: body(ids) }),
    onSuccess: refresh,
  });
  const retry = useMutation({ mutationFn: (id: string) => api(`/api/calendar/pending/${id}/retry`, { method: "POST", body: "{}" }), onSuccess: refresh });
  const resolve = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: "mine" | "theirs" }) =>
      api(`/api/calendar/pending/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),
    onSuccess: refresh,
  });

  const rows = awaiting.data ?? [];
  return {
    filter,
    setFilter,
    awaiting,
    history,
    rows,
    accounts: [...new Map(rows.concat(history.data ?? []).map((r) => [r.accountId, r.accountAddress])).entries()],
    checked,
    toggle: (id: string) =>
      setChecked((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    checkAll: (on: boolean) => setChecked(on ? new Set(rows.filter((r) => r.canApprove).map((r) => r.id)) : new Set()),
    approve,
    reject,
    retry,
    resolve,
  };
}
