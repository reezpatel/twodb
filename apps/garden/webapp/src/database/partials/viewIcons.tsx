import { CalendarDays, Columns3, LayoutGrid, List, Table2 } from "lucide-react";
import type { ViewType } from "@shared/model";

export const VIEW_META: Record<ViewType, { label: string; Icon: typeof Table2 }> = {
  table: { label: "Table", Icon: Table2 },
  kanban: { label: "Kanban", Icon: Columns3 },
  list: { label: "List", Icon: List },
  gallery: { label: "Gallery", Icon: LayoutGrid },
  calendar: { label: "Calendar", Icon: CalendarDays },
};
