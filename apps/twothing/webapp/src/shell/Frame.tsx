import { AppShell, AppShellBody, AppShellContent, AppShellMain, isLargeViewport } from "@twodb/blocks";
import { ScanLine } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useRoute } from "../lib/router";
import { useFrame } from "./hooks/useFrame";
import { SideNav } from "./partials/SideNav";
import { TopBar } from "./partials/TopBar";

export function Frame({ children }: { children: ReactNode }) {
  const f = useFrame();
  const [navOpen, setNavOpen] = useState(isLargeViewport);
  const route = useRoute();
  const activeCategory = f.section === "items" && !route.segments[1] ? route.query.get("category") : null;
  return (
    <div className="h-dvh">
      <AppShell>
        <AppShellBody>
          <SideNav section={f.section} activeCategory={activeCategory} open={navOpen} onOpenChange={setNavOpen} />
          <AppShellMain>
            <TopBar
              search={f.search}
              onSearch={(v) => {
                f.setSearch(v);
                if (f.section === "items" && !route.segments[1]) f.submitSearch(v);
              }}
              onSubmit={f.submitSearch}
              searchRef={f.searchRef}
              navOpen={navOpen}
              onToggleNav={() => setNavOpen((o) => !o)}
            />
            <AppShellContent className="block pb-10">{children}</AppShellContent>
          </AppShellMain>
        </AppShellBody>
      </AppShell>
      <button
        onClick={f.openScan}
        aria-label="Scan"
        title="Scan (S)"
        className="tt-safe-bottom fixed right-4 bottom-4 z-40 grid size-14 place-items-center rounded-full bg-ink text-paper shadow-lg transition hover:bg-ink/90 active:scale-95 md:right-6 md:bottom-6"
      >
        <ScanLine className="size-6" />
      </button>
    </div>
  );
}
