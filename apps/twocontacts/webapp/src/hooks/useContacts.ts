import { useEffect, useRef, useState } from "react";
export interface Book { id: string; spaceId: string; name: string }
export interface Contact { id: string; bookId: string; name: string; email: string; phone: string; company: string; notes: string; pinned: boolean }
export type Draft = Omit<Contact, "id">;
const blank = (bookId: string): Draft => ({ bookId, name: "", email: "", phone: "", company: "", notes: "", pinned: false });
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(res.status === 401 ? "Sign in to TwoDB, then reload this page." : body.error ?? `Request failed (${res.status})`); }
  return res.json();
}
const base = "/apps/twocontacts";
export function useContacts() {
  const [books, setBooks] = useState<Book[]>([]);
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [bookId, setBookId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bookName, setBookName] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    Promise.all([api<Book[]>(`${base}/books`), api<{ spaces: { id: string; name: string }[] }>("/registry/spaces")])
      .then(([b, s]) => { if (active) { setBooks(b); setBookId(b[0]?.id ?? ""); setSpaces(s.spaces); setSpaceId(s.spaces[0]?.id ?? ""); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      api<Contact[]>(`${base}/contacts?${new URLSearchParams({ bookId, q: query, limit: "200" })}`)
        .then(rows => { if (active) setContacts(rows); }).catch(e => { if (active) setError(e.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [bookId, query, revision]);
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  const createBook = () => perform(async () => {
    const book = await api<Book>(`${base}/books`, { method: "POST", body: JSON.stringify({ name: bookName, spaceId }) });
    setBooks(b => [...b, book]); setBookId(book.id); setBookName(""); setDraft(null);
  });
  const save = () => perform(async () => {
    if (!draft) return;
    const { bookId: selectedBook, ...fields } = draft;
    await api(`${base}/contacts${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PATCH" : "POST", body: JSON.stringify(editingId ? fields : draft) });
    setDraft(null); setRevision(r => r + 1);
  });
  const remove = () => { if (editingId && window.confirm("Permanently delete this contact?")) void perform(async () => {
    await api(`${base}/contacts/${editingId}`, { method: "DELETE" }); setDraft(null); setRevision(r => r + 1);
  }); };
  return { books, spaces, contacts, query, setQuery, bookId, selectBook: (id: string) => { setBookId(id); setDraft(null); }, error, loading, busy,
    draft, setDraft, editingId, bookName, setBookName, spaceId, setSpaceId, createBook, save, remove,
    add: () => { setEditingId(null); setDraft(blank(bookId)); },
    edit: (c: Contact) => { setEditingId(c.id); setDraft({ bookId: c.bookId, name: c.name, email: c.email, phone: c.phone, company: c.company, notes: c.notes, pinned: c.pinned }); },
  };
}
