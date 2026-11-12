import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useDatabaseView } from "./hooks/useDatabaseView";
import { ViewTabs } from "./partials/ViewTabs";
import { Toolbar } from "./partials/Toolbar";
import { TableView } from "./views/TableView";
import { KanbanView } from "./views/KanbanView";
import { ListView } from "./views/ListView";
import { GalleryView } from "./views/GalleryView";
import { CalendarView } from "./views/CalendarView";

/** Views tab bar + toolbar + the active view. Shared by full-page databases and inline database blocks. */
export function DatabaseView({ databaseId, viewId, onViewChange, header, compact }: { databaseId: string; viewId: string | null; onViewChange?: (id: string) => void; header?: ReactNode; compact?: boolean }) {
  const m = useDatabaseView(databaseId, viewId, onViewChange);
  if (m.loading) return <div className="flex h-24 items-center justify-center text-ink-muted"><Loader2 size={16} className="animate-spin" /></div>;
  if (m.error || !m.view) return <div className="rounded-md border border-dashed border-outline p-4 text-[13px] text-ink-muted">This database is unavailable (deleted or no access).</div>;
  const body = (() => {
    switch (m.view.type) {
      case "table":
        return <TableView m={m} />;
      case "kanban":
        return <KanbanView m={m} />;
      case "list":
        return <ListView m={m} />;
      case "gallery":
        return <GalleryView m={m} />;
      case "calendar":
        return <CalendarView m={m} />;
    }
  })();
  return (
    <div className="garden-database min-w-0">
      {header}
      <div className="mb-2 flex items-center gap-2 border-b border-outline/70 pb-1">
        <div className="min-w-0 flex-1">
          <ViewTabs m={m} />
        </div>
        <Toolbar m={m} compact={compact} />
      </div>
      {body}
    </div>
  );
}
