import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { api } from "@/lib/api";
import { contactKeys, fetchBooks, fetchContacts, type Contact } from "./contacts-api";

export function useContactsScene() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const books = useQuery({ queryKey: contactKeys.books, queryFn: fetchBooks });
  const bookId = params.get("book") ?? books.data?.[0]?.id ?? null;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [sort, setSort] = useState<"rank" | "name" | "recent">("rank");
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const list = useQuery({
    queryKey: contactKeys.list(bookId ?? "", debounced, domain, sort, showHidden),
    queryFn: () => fetchContacts(bookId!, { q: debounced, domain, sort, hidden: showHidden }),
    enabled: !!bookId,
    placeholderData: (prev) => prev,
  });

  const book = books.data?.find((b) => b.id === bookId) ?? null;
  const contacts = list.data?.contacts ?? [];
  const selectedContact = contacts.find((c) => c.id === selected) ?? null;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: contactKeys.all });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Contact, "name" | "notes" | "pinned" | "hidden">> }) =>
      api<Contact>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
  const forget = useMutation({
    mutationFn: (id: string) => api(`/api/contacts/${id}/forget`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      setSelected(null);
      invalidate();
    },
  });
  const create = useMutation({
    mutationFn: (value: { email: string; name: string }) => api<Contact>("/api/contacts", { method: "POST", body: JSON.stringify({ ...value, bookId }) }),
    onSuccess: (c) => {
      setAdding(false);
      setSelected(c.id);
      invalidate();
    },
  });

  return {
    books,
    book,
    bookId,
    selectBook: (id: string) => {
      setParams({ book: id }, { replace: true });
      setDomain(null);
      setSelected(null);
    },
    query,
    setQuery,
    domain,
    setDomain,
    sort,
    setSort,
    showHidden,
    setShowHidden,
    list,
    contacts,
    selected,
    setSelected,
    selectedContact,
    canEdit: !!book && book.role !== "viewer",
    adding,
    setAdding,
    update,
    forget,
    create,
  };
}

export type ContactsSceneState = ReturnType<typeof useContactsScene>;
