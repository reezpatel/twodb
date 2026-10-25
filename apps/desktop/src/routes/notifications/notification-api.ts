import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { subscribeToGateway } from "@/lib/gateway-client";

// Notification types shared by bell, center, toasts and settings.

export type Urgency = "low" | "normal" | "high" | "critical";

export interface NotificationMedia {
  kind: "image" | "file" | "audio";
  url: string;
  filename?: string;
  contentType?: string | null;
  size?: number | null;
}

export interface NotificationAction {
  id: string;
  label: string;
  style?: "default" | "primary" | "destructive";
  verb: "link" | "api" | "dismiss";
  deepLink?: string | null;
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  origin: string;
  type: string;
  urgency: Urgency;
  icon: string | null;
  accent: string | null;
  audience: string | null;
  actorName: string | null;
  actorImage: string | null;
  media: NotificationMedia[];
  actions: NotificationAction[];
  deepLink: string | null;
  groupingKey: string | null;
  dedupeKey: string | null;
  silent: boolean;
  revision: number;
  data: Record<string, unknown> | null;
  seen: boolean;
  read: boolean;
  archived: boolean;
  seenAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  expiresAt: string | null;
}

export interface NotificationCounts {
  unseen: number;
  unread: number;
}

export interface RegistryType {
  id: string;
  label: string;
  description: string | null;
  defaultUrgency: Urgency;
  expiryDays: number | null;
  defaultChannels: { inApp?: boolean; toast?: boolean; osPush?: boolean; emailDigest?: boolean };
}

export interface RegistryGroup {
  id: string;
  label: string;
  description: string | null;
  types: RegistryType[];
}

export interface NotificationPreference {
  groupId: string;
  typeId: string | null;
  channels: { inApp?: boolean | null; toast?: boolean | null; osPush?: boolean | null; emailDigest?: boolean | null };
  urgencyFloor: string | null;
}

export type FeedState = "active" | "unread" | "archived";

export const notificationKeys = {
  feed: (state: FeedState, group?: string) => ["notifications", "feed", state, group ?? "all"] as const,
  counts: ["notifications", "counts"] as const,
  registry: ["notifications", "registry"] as const,
  settings: ["notifications", "settings"] as const,
};

export function useNotificationCounts() {
  return useQuery({
    queryKey: notificationKeys.counts,
    queryFn: () => api<NotificationCounts>("/api/notifications/counts"),
  });
}

export function useNotificationFeed(state: FeedState, group?: string) {
  return useQuery({
    queryKey: notificationKeys.feed(state, group),
    queryFn: () =>
      api<{ items: NotificationItem[]; counts: NotificationCounts; nextCursor: string | null }>(
        `/api/notifications?state=${state}${group ? `&group=${group}` : ""}`,
      ),
  });
}

export function useNotificationRegistry() {
  return useQuery({
    queryKey: notificationKeys.registry,
    queryFn: () => api<{ groups: RegistryGroup[] }>("/api/notifications/registry"),
    staleTime: Infinity,
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings,
    queryFn: () => api<{ preferences: NotificationPreference[] }>("/api/notifications/settings"),
  });
}

/** Mark-read / dismiss / unarchive, keeping feed + counts fresh. */
export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const read = useMutation({
    mutationFn: (id: string) => api<NotificationItem>(`/api/notifications/${id}/read`, { method: "POST" }),
    onSettled: invalidate,
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => api<NotificationItem>(`/api/notifications/${id}/dismiss`, { method: "POST" }),
    onSettled: invalidate,
  });
  const unarchive = useMutation({
    mutationFn: (id: string) => api<NotificationItem>(`/api/notifications/${id}/unarchive`, { method: "POST" }),
    onSettled: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => api<NotificationCounts>("/api/notifications/read-all", { method: "POST" }),
    onSettled: invalidate,
  });
  return { read, dismiss, unarchive, readAll };
}

/** Batched mark-seen: collects ids for 1.5s (or 50 items) before POSTing. */
export function useSeenBatcher() {
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const flush = useCallback(() => {
    timer.current = null;
    const ids = [...pending.current];
    pending.current.clear();
    if (!ids.length) return;
    void api<NotificationCounts>("/api/notifications/seen", { method: "POST", body: JSON.stringify({ ids }) })
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => {});
  }, [queryClient]);

  const markSeen = useCallback(
    (id: string) => {
      pending.current.add(id);
      if (pending.current.size >= 50) flush();
      else if (!timer.current) timer.current = setTimeout(flush, 1500);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return markSeen;
}

/** Live counts + feed invalidation from the gateway's implicit notif rooms. */
export function useNotificationLive() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    const offs = [
      subscribeToGateway("notification.new", invalidate),
      subscribeToGateway("notification.updated", invalidate),
      subscribeToGateway("notification.state", invalidate),
    ];
    return () => offs.forEach((off) => off());
  }, [queryClient]);
}

/** Toast queue fed by gateway events — persisted new arrivals + ephemerals. */
export interface ToastEntry {
  id: string;
  title: string;
  body: string;
  urgency: Urgency;
  icon: string | null;
  accent: string | null;
  actorName: string | null;
  actorImage: string | null;
  deepLink: string | null;
  ttlMs: number;
  ephemeral: boolean;
  onRead?: () => void;
}

export const TOAST_TTL: Record<Urgency, number> = { low: 0, normal: 6000, high: 10000, critical: 0 };

export function useNotificationToasts() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (entry: ToastEntry) => {
      if (!entry.ttlMs) return; // ttl 0 = sticky handled by UI; here: skip auto-dismiss setup
      setToasts((t) => [...t.slice(-5), entry]);
      timers.current.set(
        entry.id,
        setTimeout(() => remove(entry.id), entry.ttlMs),
      );
    },
    [remove],
  );

  useEffect(() => {
    const onNew = (data: unknown) => {
      const n = data as NotificationItem;
      if (!n || n.silent) return;
      const ttl = TOAST_TTL[n.urgency] ?? 6000;
      if (!ttl) return;
      push({ id: n.id, title: n.title, body: n.body, urgency: n.urgency, icon: n.icon, accent: n.accent, actorName: n.actorName, actorImage: n.actorImage, deepLink: n.deepLink, ttlMs: ttl, ephemeral: false });
    };
    const onEphemeral = (data: unknown) => {
      const n = data as ToastEntry & { title: string; ttlMs: number };
      push({ id: n.id, title: n.title, body: n.body ?? "", urgency: n.urgency ?? "normal", icon: n.icon ?? null, accent: n.accent ?? null, actorName: n.actorName ?? null, actorImage: n.actorImage ?? null, deepLink: n.deepLink ?? null, ttlMs: n.ttlMs ?? 8000, ephemeral: true });
    };
    const offs = [subscribeToGateway("notification.new", onNew), subscribeToGateway("notification.ephemeral", onEphemeral)];
    return () => offs.forEach((off) => off());
  }, [push]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  return { toasts, remove };
}
