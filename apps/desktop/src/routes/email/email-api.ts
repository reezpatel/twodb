import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EmailAddress {
  name: string | null;
  address: string;
}

export type EmailRole = "owner" | "member" | "viewer";

export type AccountCapability = "mail" | "calendar";

export interface EmailAccount {
  id: string;
  kind: "google" | "microsoft" | "imap";
  preset: string | null;
  address: string;
  displayName: string | null;
  aliases: string[];
  config: Record<string, unknown>;
  visibility: "private" | "shared";
  role: EmailRole;
  ownerUserId: string;
  status: "active" | "error" | "reauth_required" | "paused";
  lastError: string | null;
  lastSyncedAt: string | null;
  backfillState: "pending" | "running" | "paused" | "done" | "error";
  backfillProgress: { done?: number; total?: number | null; startedAt?: string; finishedAt?: string };
  capabilities: AccountCapability[];
  grantedCapabilities: AccountCapability[];
  calendarState: "disabled" | "active" | "paused" | "error" | "reauth_required";
  calendarError: string | null;
  calendarImportState: "pending" | "running" | "done" | "error";
  calendarImportProgress: { done?: number; calendar?: number; calendars?: number; finishedAt?: string };
  calendarLastSyncedAt: string | null;
  syncMode: "polling" | "webhooks";
  suggestOrgMembers: boolean;
  syncIntervalSec: number;
  signatureHtml: string | null;
  color: string | null;
  hasCredentials: boolean;
  createdAt: string;
}

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean";
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  capability?: AccountCapability;
}

export interface ConnectorPreset {
  id: string;
  label: string;
  kind: "google" | "microsoft" | "imap";
  auth: "oauth" | "password";
  capabilities: AccountCapability[];
  description: string;
  defaults: Record<string, unknown>;
  help?: string;
}

export interface EmailMeta {
  presets: ConnectorPreset[];
  imapFields: ConnectorField[];
  gmail: { configured: boolean; clientId: string; redirectUri: string };
  microsoft: { configured: boolean; clientId: string; tenant: string; redirectUri: string };
  storageReady: boolean;
  views: string[];
  isAdmin: boolean;
}

export type EmailView = "inbox" | "starred" | "sent" | "drafts" | "scheduled" | "outbox" | "snoozed" | "archive" | "spam" | "trash" | "all";

export interface EmailThread {
  id: string;
  accountId: string;
  subject: string;
  snippet: string | null;
  participants: EmailAddress[];
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  location: "inbox" | "archive" | "spam";
  isPinned: boolean;
  snoozedUntil: string | null;
  muted: boolean;
  hasAttachments: boolean;
  hasStarred: boolean;
  hasDraft: boolean;
  hasSent: boolean;
  hasOutbox: boolean;
  hasScheduled: boolean;
  hasDeletedMessages: boolean;
  deletedAt: string | null;
  labelIds: string[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string | null;
  size: number;
  contentId: string | null;
  isInline: boolean;
  status: string;
  url: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  accountId: string;
  direction: "inbound" | "outbound";
  status: "received" | "draft" | "scheduled" | "queued" | "sending" | "sent" | "failed" | "cancelled";
  composeKind: "new" | "reply" | "reply_all" | "forward" | null;
  sourceMessageId: string | null;
  rfcMessageId: string | null;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo: EmailAddress[];
  subject: string;
  snippet: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  date: string;
  sentAt: string | null;
  receivedAt: string | null;
  scheduledAt: string | null;
  sendAfter: string | null;
  lastError: string | null;
  attempts: number;
  isRead: boolean;
  isStarred: boolean;
  sentByUserId: string | null;
  sentByName: string | null;
  includeQuote: boolean;
  listUnsubscribe: string | null;
  hasRaw: boolean;
  deletedAt: string | null;
  updatedAt: string;
  attachments: EmailAttachment[];
}

export interface EmailLabel {
  id: string;
  parentId: string | null;
  accountId: string | null;
  name: string;
  color: string | null;
  effectiveColor: string | null;
  path: string;
  depth: number;
  position: number;
  total: number;
  unread: number;
  rolledTotal: number;
  rolledUnread: number;
  mine: boolean;
}

export interface EmailCounts {
  inbox: number;
  inboxTotal: number;
  starred: number;
  drafts: number;
  scheduled: number;
  outbox: number;
  failed: number;
  snoozed: number;
  spam: number;
  trash: number;
}

export interface ThreadPage {
  pinned: EmailThread[];
  threads: EmailThread[];
  next: string | null;
}

export interface ThreadDetail {
  thread: EmailThread;
  role: EmailRole;
  messages: EmailMessage[];
}

export type ThreadAction =
  | "read"
  | "unread"
  | "star"
  | "unstar"
  | "pin"
  | "unpin"
  | "archive"
  | "inbox"
  | "spam"
  | "not_spam"
  | "trash"
  | "restore"
  | "purge"
  | "snooze"
  | "unsnooze"
  | "mute"
  | "unmute"
  | "label";

export const emailKeys = {
  all: ["email"] as const,
  meta: ["email", "meta"] as const,
  accounts: ["email", "accounts"] as const,
  labels: ["email", "labels"] as const,
  counts: (accountId: string | null) => ["email", "counts", accountId] as const,
  threads: ["email", "threads"] as const,
  thread: (id: string) => ["email", "thread", id] as const,
  draft: (id: string) => ["email", "draft", id] as const,
};

export const fetchMeta = () => api<EmailMeta>("/api/email/meta");
export const fetchAccounts = () => api<EmailAccount[]>("/api/email/accounts");
export const fetchLabels = () => api<EmailLabel[]>("/api/email/labels");

export function threadAction(ids: string[], action: ThreadAction, payload?: Record<string, unknown>) {
  return api<{ ok: true }>("/api/email/threads/bulk", { method: "POST", body: JSON.stringify({ ids, action, payload }) });
}

export async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form, credentials: "include" });
  const json = (await res.json().catch(() => null)) as (T & { error?: string; detail?: string }) | null;
  if (!res.ok) throw new Error(json?.detail ?? json?.error ?? `Upload failed (${res.status})`);
  return json as T;
}

export function useEmailMeta() {
  return useQuery({ queryKey: emailKeys.meta, queryFn: fetchMeta });
}

/** Accounts with the mail capability — the email app ignores calendar-only connections. */
export function useMailAccounts() {
  return useQuery({
    queryKey: emailKeys.accounts,
    queryFn: fetchAccounts,
    select: (list: EmailAccount[]) => list.filter((a) => a.capabilities.includes("mail")),
  });
}

export function useEmailAccounts() {
  return useQuery({ queryKey: emailKeys.accounts, queryFn: fetchAccounts });
}

export function useEmailLabels() {
  return useQuery({ queryKey: emailKeys.labels, queryFn: fetchLabels });
}

type EmailEvent =
  | { type: "message.created" | "message.status"; accountId: string; threadId: string; messageId: string }
  | { type: "thread.updated"; accountId: string; threadIds: string[] }
  | { type: "account.status" | "account.backfill"; accountId: string }
  | { type: "labels.updated" };

/** Per-user email socket — invalidates the right queries on server events. */
export function useEmailSocket() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;
    let pendingThreads = new Set<string>();
    let flush: ReturnType<typeof setTimeout> | null = null;

    const scheduleFlush = () => {
      if (flush) return;
      flush = setTimeout(() => {
        flush = null;
        const ids = pendingThreads;
        pendingThreads = new Set();
        void queryClient.invalidateQueries({ queryKey: emailKeys.threads });
        void queryClient.invalidateQueries({ queryKey: ["email", "counts"] });
        void queryClient.invalidateQueries({ queryKey: emailKeys.labels });
        for (const id of ids) void queryClient.invalidateQueries({ queryKey: emailKeys.thread(id) });
      }, 250);
    };

    const connect = () => {
      if (disposed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/api/email/ws`);
      ws.onopen = () => {
        attempt = 0;
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 25_000);
      };
      ws.onmessage = (evt) => {
        let frame: EmailEvent;
        try {
          frame = JSON.parse(evt.data as string) as EmailEvent;
        } catch {
          return;
        }
        if ((frame as { type: string }).type === "pong") return;
        if (frame.type === "thread.updated") {
          for (const id of frame.threadIds) pendingThreads.add(id);
          scheduleFlush();
        } else if (frame.type === "message.created" || frame.type === "message.status") {
          pendingThreads.add(frame.threadId);
          scheduleFlush();
        } else if (frame.type === "account.status" || frame.type === "account.backfill") {
          void queryClient.invalidateQueries({ queryKey: emailKeys.accounts });
          if (frame.type === "account.backfill") scheduleFlush();
        } else if (frame.type === "labels.updated") {
          void queryClient.invalidateQueries({ queryKey: emailKeys.labels });
        }
      };
      ws.onclose = () => {
        if (ping) clearInterval(ping);
        if (disposed) return;
        attempt += 1;
        retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt));
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      if (flush) clearTimeout(flush);
      ws?.close();
    };
  }, [queryClient]);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function displayName(a: EmailAddress | null | undefined): string {
  if (!a) return "Unknown";
  return a.name || a.address.split("@")[0];
}

export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { day: "numeric", month: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
