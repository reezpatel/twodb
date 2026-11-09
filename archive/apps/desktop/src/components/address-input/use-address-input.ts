import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Address {
  name: string | null;
  address: string;
}

export interface ContactSuggestion {
  id: string;
  email: string;
  name: string | null;
  domain: string;
  orgMember?: boolean;
  lastEmailAt: string | null;
  lastMeetingAt: string | null;
}

/** Suggestions always come from one contact book: the account's (mail) or the calendar's (events). */
export interface AddressScope {
  accountId?: string | null;
  calendarId?: string | null;
}

const ADDRESS_RE = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

export function isValidAddress(value: string) {
  return ADDRESS_RE.test(value);
}

/** Parses "Name <a@b.c>", "a@b.c" and comma/semicolon separated lists. */
export function parseAddresses(input: string): Address[] {
  return input
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*)<([^>]+)>$/);
      const address = (m ? m[2] : part).trim().toLowerCase();
      const name = m ? m[1].trim().replace(/^"|"$/g, "") || null : null;
      return { name, address };
    });
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useAddressInput(value: Address[], onChange: (v: Address[]) => void, scope: AddressScope) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const q = useDebounced(text.trim(), 120);
  const exclude = useMemo(() => value.map((v) => v.address).join(","), [value]);
  const scopeKey = scope.calendarId ? `c:${scope.calendarId}` : scope.accountId ? `a:${scope.accountId}` : null;

  const suggestions = useQuery({
    queryKey: ["contacts", "suggest", scopeKey, q, exclude],
    queryFn: () => {
      const params = new URLSearchParams({ q, exclude });
      if (scope.calendarId) params.set("calendarId", scope.calendarId);
      else if (scope.accountId) params.set("accountId", scope.accountId);
      return api<ContactSuggestion[]>(`/api/contacts/suggest?${params}`);
    },
    enabled: !!scopeKey && open,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const items = open ? (suggestions.data ?? []) : [];

  const add = (list: Address[]) => {
    const seen = new Set(value.map((v) => v.address));
    const fresh = list.filter((p) => !seen.has(p.address));
    if (fresh.length) onChange([...value, ...fresh]);
  };

  const commitText = () => {
    const parsed = parseAddresses(text);
    if (!parsed.length) return false;
    add(parsed);
    setText("");
    return true;
  };

  const pick = (s: ContactSuggestion) => {
    add([{ name: s.name, address: s.email }]);
    setText("");
    setHighlight(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if ((e.key === "Enter" || e.key === "Tab") && items.length && text.trim() && !text.includes("@")) {
      e.preventDefault();
      pick(items[Math.min(highlight, items.length - 1)]);
    } else if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      if (text.trim()) {
        e.preventDefault();
        if (items.length && e.key === "Enter" && !isValidAddress(text.trim())) pick(items[Math.min(highlight, items.length - 1)]);
        else commitText();
      }
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (/[,;\n]/.test(pasted)) {
      e.preventDefault();
      add(parseAddresses(pasted));
    }
  };

  return {
    text,
    setText: (v: string) => {
      setText(v);
      setOpen(true);
      setHighlight(0);
    },
    open: open && items.length > 0,
    setOpen,
    items,
    highlight,
    setHighlight,
    pick,
    commitText,
    onKeyDown,
    onPaste,
    remove: (address: string) => onChange(value.filter((v) => v.address !== address)),
  };
}
