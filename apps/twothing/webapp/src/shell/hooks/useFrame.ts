import { useEffect, useRef, useState } from "react";
import { navigate, useRoute } from "../../lib/router";
import { useScanner } from "../../scanner/ScanContext";

/** Holding hook for <Frame>: active section, global search, keyboard shortcuts. */
export function useFrame() {
  const route = useRoute();
  const scanner = useScanner();
  const section = route.segments[0] ?? "";
  const [search, setSearch] = useState(() => (section === "items" ? (route.query.get("q") ?? "") : ""));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (section !== "items") setSearch("");
  }, [section]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "s" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        scanner.open();
      } else if (e.key === "n" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        navigate("/items/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanner]);

  const submitSearch = (q: string) => {
    setSearch(q);
    const p = new URLSearchParams(section === "items" && !route.segments[1] ? route.query : undefined);
    if (q) p.set("q", q);
    else p.delete("q");
    navigate(`/items?${p}`, { replace: section === "items" && !route.segments[1] });
  };

  return { section, search, setSearch, submitSearch, searchRef, openScan: () => scanner.open() };
}
