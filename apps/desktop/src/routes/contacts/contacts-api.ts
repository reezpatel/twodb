import { api } from "@/lib/api";

export interface ContactBook {
  id: string;
  kind: "account" | "local";
  accountId: string | null;
  label: string;
  displayName: string | null;
  role: "owner" | "member" | "viewer";
  suggestOrgMembers: boolean;
  learnState: string;
  learnProgress: { done?: number; total?: number };
  count: number;
}

export interface Contact {
  id: string;
  bookId: string;
  email: string;
  name: string | null;
  kind: string;
  domain: string;
  notes: string | null;
  pinned: boolean;
  hidden: boolean;
  sentCount: number;
  receivedCount: number;
  meetingCount: number;
  lastEmailAt: string | null;
  lastMeetingAt: string | null;
  nextMeetingAt: string | null;
  lastSeenAt: string;
}

export interface ContactList {
  bookId: string;
  role: ContactBook["role"];
  total: number;
  contacts: Contact[];
  domains: { domain: string; count: number }[];
}

export interface ContactActivity {
  emails: { id: string; threadId: string; subject: string; snippet: string | null; direction: string; sentAt: string | null }[];
  meetings: { id: string; title: string; startAt: string | null; startDate: string | null; isAllDay: boolean; calendarId: string }[];
}

export const contactKeys = {
  all: ["contacts"] as const,
  books: ["contacts", "books"] as const,
  list: (bookId: string, q: string, domain: string | null, sort: string, hidden: boolean) => ["contacts", "list", bookId, q, domain, sort, hidden] as const,
  activity: (id: string) => ["contacts", "activity", id] as const,
};

export const fetchBooks = () => api<ContactBook[]>("/api/contacts/books");

export function fetchContacts(bookId: string, opts: { q: string; domain: string | null; sort: string; hidden: boolean }) {
  const params = new URLSearchParams({ bookId, sort: opts.sort });
  if (opts.q) params.set("q", opts.q);
  if (opts.domain) params.set("domain", opts.domain);
  if (opts.hidden) params.set("hidden", "1");
  return api<ContactList>(`/api/contacts?${params}`);
}

export function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 1 && days < 30) return `${days} days ago`;
  if (days < 0 && days > -30) return `in ${-days} days`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
