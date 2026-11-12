import type { ReactNode } from "react";
import { useRoute } from "../lib/router";
import { useFrame } from "./hooks/useFrame";
import { BottomNav } from "./partials/BottomNav";
import { SideNav } from "./partials/SideNav";
import { TopBar } from "./partials/TopBar";

export function Frame({ children }: { children: ReactNode }) {
  const f = useFrame();
  const route = useRoute();
  const activeCategory = f.section === "items" && !route.segments[1] ? route.query.get("category") : null;
  return (
    <div className="flex h-dvh overflow-hidden">
      <SideNav section={f.section} onScan={f.openScan} activeCategory={activeCategory} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          search={f.search}
          onSearch={(v) => {
            f.setSearch(v);
            if (f.section === "items" && !route.segments[1]) f.submitSearch(v);
          }}
          onSubmit={f.submitSearch}
          searchRef={f.searchRef}
        />
        <main className="tt-grid-bg min-h-0 flex-1 overflow-y-auto pb-28 md:pb-10">{children}</main>
      </div>
      <BottomNav section={f.section} onScan={f.openScan} />
    </div>
  );
}
