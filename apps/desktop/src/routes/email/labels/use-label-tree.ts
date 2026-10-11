import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { emailKeys, type EmailLabel } from "../email-api";

export const LABEL_COLORS = ["#3b82f6", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
export const MAX_LABEL_DEPTH = 4;

export interface LabelNode extends EmailLabel {
  children: LabelNode[];
}

export function buildLabelTree(labels: EmailLabel[]): LabelNode[] {
  const nodes = new Map<string, LabelNode>(labels.map((l) => [l.id, { ...l, children: [] }]));
  const roots: LabelNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: LabelNode[]) => {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

/** "Work / Clients / Acme" — full path for chips and pickers. */
export function labelPathName(labels: EmailLabel[], id: string): string {
  const byId = new Map(labels.map((l) => [l.id, l]));
  const parts: string[] = [];
  let cur = byId.get(id);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(" / ");
}

const EXPANDED_KEY = "twodb.email.labels.expanded";

export type LabelDialog =
  | { kind: "create"; parentId: string | null; accountId: string | null }
  | { kind: "rename"; label: EmailLabel }
  | { kind: "delete"; label: EmailLabel }
  | null;

export function useLabelTree(labels: EmailLabel[]) {
  const queryClient = useQueryClient();
  const tree = useMemo(() => buildLabelTree(labels), [labels]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const [dialog, setDialog] = useState<LabelDialog>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      return next;
    });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: emailKeys.labels });
    void queryClient.invalidateQueries({ queryKey: emailKeys.threads });
  };
  const onError = (e: Error) => setError(e.message);

  const create = useMutation({
    mutationFn: (input: { name: string; parentId: string | null; accountId: string | null; color: string | null }) =>
      api<{ id: string }>("/api/email/labels", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_d, input) => {
      if (input.parentId) setExpanded((prev) => new Set(prev).add(input.parentId!));
      setDialog(null);
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api(`/api/email/labels/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      setDialog(null);
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: ({ id, children }: { id: string; children: "delete" | "reparent" }) => api(`/api/email/labels/${id}?children=${children}`, { method: "DELETE" }),
    onSuccess: () => {
      setDialog(null);
      refresh();
    },
    onError,
  });

  const byId = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  /** Valid drop: not onto itself / its subtree, same scope, depth limit respected. */
  const canDrop = (targetId: string | "root"): boolean => {
    const dragged = dragId ? byId.get(dragId) : undefined;
    if (!dragged) return false;
    if (targetId === "root") return dragged.parentId !== null;
    const target = byId.get(targetId);
    if (!target || target.id === dragged.id || target.path.startsWith(`${dragged.path}/`) || target.id === dragged.parentId) return false;
    if (target.accountId !== dragged.accountId) return false;
    const subtreeDepth = Math.max(...labels.filter((l) => l.id === dragged.id || l.path.startsWith(`${dragged.path}/`)).map((l) => l.depth)) - dragged.depth;
    return target.depth + 1 + subtreeDepth <= MAX_LABEL_DEPTH;
  };
  const drop = (targetId: string | "root") => {
    if (dragId && canDrop(targetId)) {
      update.mutate({ id: dragId, patch: { parentId: targetId === "root" ? null : targetId } });
      if (targetId !== "root") setExpanded((prev) => new Set(prev).add(targetId));
    }
    setDragId(null);
    setDropTarget(null);
  };

  return { tree, expanded, toggle, dialog, setDialog, create, update, remove, dragId, setDragId, dropTarget, setDropTarget, canDrop, drop, error, setError };
}
