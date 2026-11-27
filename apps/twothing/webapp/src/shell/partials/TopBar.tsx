import type { RefObject } from "react";
import { AppShellHeader, NavSidebarToggle } from "@twodb/blocks";
import { Plus, Search, X } from "lucide-react";
import { Link } from "../../lib/router";

export function TopBar({
  search,
  onSearch,
  onSubmit,
  searchRef,
  navOpen,
  onToggleNav,
}: {
  search: string;
  onSearch: (v: string) => void;
  onSubmit: (v: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  navOpen: boolean;
  onToggleNav: () => void;
}) {
  return (
    <AppShellHeader className="h-14 gap-2 border-b border-outline px-4 sm:gap-3 sm:px-6">
      <NavSidebarToggle open={navOpen} onToggle={onToggleNav} aria-label={navOpen ? "Hide navigation" : "Show navigation"} />
      <div id="tt-header-title" className="min-w-0 flex-1" />
      <form
        className="group relative ml-auto flex w-full max-w-sm items-center"
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
          className="h-8 w-full rounded-[6px] border border-outline/40 bg-white/8 pr-16 pl-9 text-[13px] font-normal outline-none transition placeholder:text-ink-muted focus:ring-1 focus:border-[color-mix(in_oklab,var(--ion-deep)_55%,black)] focus:ring-[color-mix(in_oklab,var(--ion-deep)_55%,black)]"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-3 rounded-[6px] p-1 text-ink-muted hover:bg-stone"
            onClick={() => onSubmit("")}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 hidden rounded-[3px] border border-ink/20 px-1.5 py-[3px] font-sans text-[11px] leading-none font-light text-ink-muted/70 sm:block">
            ⌘K
          </kbd>
        )}
      </form>
      <Link
        to="/items/new"
        aria-label="Add item"
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-ink px-2.5 text-[12px] font-medium text-paper hover:bg-ink/90 md:px-3"
      >
        <Plus className="size-4 md:size-3.5" />
        <span className="hidden md:inline">Add item</span>
      </Link>
    </AppShellHeader>
  );
}
