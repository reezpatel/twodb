import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  emailKeys,
  threadAction,
  useEmailAccounts,
  useEmailLabels,
  useEmailMeta,
  useEmailSocket,
  type EmailCounts,
  type EmailMessage,
  type EmailView,
  type ThreadAction,
  type ThreadPage,
} from "./email-api";

export interface UndoState {
  messageId: string;
  until: number;
  scheduled: boolean;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Email client state: account + view/label scope, thread list paging, selection, compose and undo-send. */
export function useEmailScene() {
  useEmailSocket();
  const queryClient = useQueryClient();
  const meta = useEmailMeta();
  const accounts = useEmailAccounts();
  const labels = useEmailLabels();

  const [accountId, setAccountId] = useState<string | null>(null);
  const [view, setViewState] = useState<EmailView>("inbox");
  const [labelId, setLabelIdState] = useState<string | null>(null);
  const [includeChildren, setIncludeChildren] = useState(true);
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [composeId, setComposeId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setView = (v: EmailView) => {
    setViewState(v);
    setLabelIdState(null);
    setSelected(null);
    setChecked(new Set());
  };
  const setLabelId = (id: string | null) => {
    setLabelIdState(id);
    setSelected(null);
    setChecked(new Set());
  };

  const counts = useQuery({
    queryKey: emailKeys.counts(accountId),
    queryFn: () => api<EmailCounts>(`/api/email/counts${accountId ? `?accountId=${accountId}` : ""}`),
  });

  const listParams = useMemo(() => {
    const p = new URLSearchParams({ view });
    if (accountId) p.set("accountId", accountId);
    if (labelId) {
      p.set("labelId", labelId);
      p.set("includeChildren", String(includeChildren));
    }
    if (q) p.set("q", q);
    return p.toString();
  }, [view, accountId, labelId, includeChildren, q]);

  const threads = useInfiniteQuery({
    queryKey: [...emailKeys.threads, listParams],
    queryFn: ({ pageParam }) => api<ThreadPage>(`/api/email/threads?${listParams}${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.next ?? undefined,
  });

  const pinned = threads.data?.pages[0]?.pinned ?? [];
  const rest = useMemo(() => threads.data?.pages.flatMap((p) => p.threads) ?? [], [threads.data]);
  const visibleIds = useMemo(() => [...pinned, ...rest].map((t) => t.id), [pinned, rest]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: emailKeys.threads });
    void queryClient.invalidateQueries({ queryKey: ["email", "counts"] });
    void queryClient.invalidateQueries({ queryKey: emailKeys.labels });
  };

  const act = useMutation({
    mutationFn: ({ ids, action, payload }: { ids: string[]; action: ThreadAction; payload?: Record<string, unknown> }) => threadAction(ids, action, payload),
    onMutate: () => setActionError(null),
    onSuccess: (_d, { ids, action }) => {
      invalidateAll();
      for (const id of ids) void queryClient.invalidateQueries({ queryKey: emailKeys.thread(id) });
      const leaves = ["archive", "inbox", "spam", "not_spam", "trash", "restore", "purge", "snooze"].includes(action);
      if (leaves && selected && ids.includes(selected) && action !== "restore") setSelected(null);
      setChecked(new Set());
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const purgeView = useMutation({
    mutationFn: (which: "trash" | "spam") => api(`/api/email/${which}${accountId ? `?accountId=${accountId}` : ""}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelected(null);
      invalidateAll();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const compose = useMutation({
    mutationFn: (input: { composeKind: "new" | "reply" | "reply_all" | "forward"; sourceMessageId?: string }) =>
      api<EmailMessage>("/api/email/drafts", { method: "POST", body: JSON.stringify({ ...input, accountId }) }),
    onSuccess: (draft) => {
      queryClient.setQueryData(emailKeys.draft(draft.id), draft);
      setComposeId(draft.id);
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: emailKeys.thread(draft.threadId) });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const cancelUndo = useMutation({
    mutationFn: (messageId: string) => api(`/api/email/messages/${messageId}/cancel`, { method: "POST", body: "{}" }),
    onSuccess: (_d, messageId) => {
      setUndo(null);
      void queryClient.invalidateQueries({ queryKey: emailKeys.draft(messageId) });
      setComposeId(messageId);
      invalidateAll();
    },
    onError: (e: Error) => {
      setUndo(null);
      setActionError(e.message === "already_sending" ? "Too late — the message is already being sent." : e.message);
    },
  });

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), Math.max(0, undo.until - Date.now()));
    return () => clearTimeout(t);
  }, [undo]);

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedIndex = selected ? visibleIds.indexOf(selected) : -1;
  const step = (delta: number) => {
    const next = visibleIds[selectedIndex + delta];
    if (next) setSelected(next);
  };

  const sendingAccounts = (accounts.data ?? []).filter((a) => a.role !== "viewer");

  return {
    meta,
    accounts,
    sendingAccounts,
    labels,
    counts,
    accountId,
    setAccountId: (id: string | null) => {
      setAccountId(id);
      setSelected(null);
      setChecked(new Set());
    },
    view,
    setView,
    labelId,
    setLabelId,
    includeChildren,
    setIncludeChildren,
    query,
    setQuery,
    threads,
    pinned,
    rest,
    selected,
    setSelected,
    selectedIndex,
    visibleCount: visibleIds.length,
    step,
    checked,
    toggleChecked,
    setChecked,
    allChecked: visibleIds.length > 0 && visibleIds.every((id) => checked.has(id)),
    checkAll: (on: boolean) => setChecked(on ? new Set(visibleIds) : new Set()),
    act,
    purgeView,
    compose,
    composeId,
    setComposeId,
    undo,
    setUndo,
    cancelUndo,
    actionError,
    setActionError,
  };
}

export type EmailSceneState = ReturnType<typeof useEmailScene>;
