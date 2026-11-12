import type { RefObject } from "react";
import { Plus, Search, X } from "lucide-react";
import { Link } from "../../lib/router";
import { Logo } from "./Logo";

export function TopBar({
  search,
  onSearch,
  onSubmit,
  searchRef,
}: {
  search: string;
  onSearch: (v: string) => void;
  onSubmit: (v: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline bg-paper/85 px-4 py-2.5 backdrop-blur md:px-6">
      <div className="md:hidden">
        <Logo />
      </div>
      <form
        className="group relative ml-auto flex max-w-xl flex-1 items-center md:ml-0"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(search);
        }}
      >
        <Search className="pointer-events-none absolute left-3 size-4 text-ink-muted" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search everything — names, specs, tags, labels…"
          className="h-10 w-full rounded-full border border-outline bg-card pr-16 pl-9 text-[14px] outline-none transition placeholder:text-ink-muted focus:border-ink/30 focus:bg-paper focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ion)_25%,transparent)]"
        />
        {search ? (
          <button type="button" aria-label="Clear search" className="absolute right-3 rounded-full p-1 text-ink-muted hover:bg-stone" onClick={() => onSubmit("")}>
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 hidden rounded-md border border-outline px-1.5 font-mono text-[10px] text-ink-muted sm:block">⌘K</kbd>
        )}
      </form>
      <Link to="/items/new" className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90 md:inline-flex">
        <Plus className="size-4" /> Add item
      </Link>
    </header>
  );
}
