import type { Row, RecordRef } from "@shared/model";
import { cn } from "@twodb/blocks";
import type { ViewField } from "../lib/view-utils";
import { CellDisplay } from "../fields/CellDisplay";
import { RecordIcon } from "../../ui/RecordIcon";

/** Card body for kanban/gallery: title + non-empty visible properties. */
export function RowCard({ row, fields, relations, onOpen, cover, className, draggable, onDragStart }: {
  row: Row;
  fields: ViewField[];
  relations: Record<string, RecordRef>;
  onOpen: () => void;
  cover?: React.ReactNode;
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const props = fields.filter((f) => f.field.id !== "title");
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn("group/card cursor-pointer overflow-hidden rounded-[9px] border border-outline bg-paper text-left transition-colors hover:border-ink/25 hover:bg-ink/[0.015]", className)}
    >
      {cover}
      <div className="space-y-1.5 px-2.5 py-2">
        <div className="flex items-start gap-1.5">
          <RecordIcon icon={row.icon} kind="page" size={15} className="mt-[2px]" />
          <span className={cn("min-w-0 flex-1 break-words text-[13.5px] font-medium leading-snug", !row.title && "text-ink-muted")}>{row.title || "Untitled"}</span>
        </div>
        {props.map(({ field }) => {
          const v = field.id === "created_time" ? row.createdAt : field.id === "updated_time" ? row.updatedAt : field.id === "created_by" ? row.createdBy : row.values[field.id];
          if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length) || (field.type === "checkbox" && !v)) return null;
          return (
            <div key={field.id} className="flex min-w-0 items-center" title={field.name}>
              <CellDisplay field={field} value={v} relations={relations} wrap />
            </div>
          );
        })}
      </div>
    </div>
  );
}
