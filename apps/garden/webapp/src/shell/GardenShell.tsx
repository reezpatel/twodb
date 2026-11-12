import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { QuickSearch } from "./QuickSearch";
import { ShellContext } from "./ShellContext";
import { RowPeek } from "../peek/RowPeek";

const WIDTH_KEY = "garden.sidebarWidth";

/** Sidebar (resizable, collapsible) + routed main area + global overlays (peek, ⌘K). */
export function GardenShell() {
  const [width, setWidth] = useState(() => Number(localStorage.getItem(WIDTH_KEY)) || 260);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("garden.sidebarCollapsed") === "1");
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") setCollapsed((c) => (localStorage.setItem("garden.sidebarCollapsed", c ? "0" : "1"), !c));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    const move = (ev: MouseEvent) => setWidth(Math.max(200, Math.min(480, w0 + ev.clientX - x0)));
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      localStorage.setItem(WIDTH_KEY, String(Math.max(200, Math.min(480, w0 + ev.clientX - x0))));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const setCol = (c: boolean) => (localStorage.setItem("garden.sidebarCollapsed", c ? "1" : "0"), setCollapsed(c));

  return (
    <ShellContext.Provider value={{ collapsed, expand: () => setCol(false), openSearch: () => setSearch(true) }}>
      <div className="flex h-screen overflow-hidden bg-paper text-ink">
        {!collapsed ? (
          <div className="relative shrink-0 border-r border-outline" style={{ width }}>
            <Sidebar onSearch={() => setSearch(true)} onCollapse={() => setCol(true)} />
            <div onMouseDown={startResize} className="absolute -right-[3px] top-0 z-10 h-full w-[6px] cursor-col-resize hover:bg-ion-deep/30" />
          </div>
        ) : null}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <RowPeek />
        <QuickSearch open={search} onOpenChange={setSearch} />
      </div>
    </ShellContext.Provider>
  );
}

