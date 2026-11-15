import { memo } from "react";
import type { Column, Item } from "@shared/model";
import { LAYOUT } from "@shared/shapes";
import type { CanvasTheme } from "../../lib/canvas-theme";
import { useEntityEdit } from "../../board-diagram/hooks/useEntityEdit";
import type { Rect } from "../lib/geometry";

/** ERD table: header band + one row per column. Rows double-click to edit inline. */
export const EntityView = memo(function EntityView({ item, rect, theme, selected }: { item: Item; rect: Rect; theme: CanvasTheme; selected: boolean }) {
  const d = item.data as { name?: string; columns?: Column[]; color?: string };
  const columns = d.columns ?? [];
  const e = useEntityEdit(item.id, columns, d.name ?? "");
  const headerH = LAYOUT.entityHeaderH;
  const rowH = LAYOUT.entityRowH;

  return (
    <>
      <rect width={rect.width} height={rect.height} rx={8} style={{ fill: theme.cardBg, stroke: theme.cardBorder, strokeWidth: 1.5 }} className="pa-svg-entity" />
      <path d={`M 0 ${headerH} H ${rect.width}`} style={{ stroke: theme.cardBorder, strokeWidth: 1 }} />
      <path d={`M 8 0 h ${rect.width - 16} a 8 8 0 0 1 8 8 v ${headerH - 8} h -${rect.width} v -${headerH - 8} a 8 8 0 0 1 8 -8 z`} fill={d.color ?? "var(--ion-deep)"} />
      {e.editingName ? (
        <foreignObject x={10} y={4} width={rect.width - 20} height={headerH - 8}>
          <input
            autoFocus
            defaultValue={d.name ?? ""}
            className="pa-svg-editor-input"
            style={{ fontSize: 13, fontWeight: 700 }}
            onBlur={(ev) => e.commitName(ev.currentTarget.value)}
            onKeyDown={(ev) => {
              ev.stopPropagation();
              if (ev.key === "Enter") e.commitName(ev.currentTarget.value);
              if (ev.key === "Escape") e.cancelName();
            }}
          />
        </foreignObject>
      ) : (
        <text x={12} y={headerH / 2} dominantBaseline="middle" fontSize={13} fontWeight={700} fill="#ffffff" className="pa-svg-text" onDoubleClick={(ev) => { ev.stopPropagation(); e.startName(); }}>
          {d.name}
        </text>
      )}
      {columns.map((c, i) => {
        const y = headerH + i * rowH;
        return (
          <g key={c.id} data-col={c.id} onDoubleClick={(ev) => { ev.stopPropagation(); e.startRow(c.id); }}>
            {i > 0 && <path d={`M 0 ${y} H ${rect.width}`} style={{ stroke: theme.chipBorder, strokeWidth: 1 }} />}
            <text x={10} y={y + rowH / 2} dominantBaseline="middle" fontSize={10} fontWeight={700} fill={c.pk ? "#d97706" : c.fk ? "#0284c7" : "transparent"} className="pa-svg-text">
              PK
            </text>
            {e.editingRow === c.id ? (
              <foreignObject x={36} y={y + 2} width={rect.width - 44} height={rowH - 4}>
                <EntityRowEditor column={c} onCommit={(p) => e.updateRow(c.id, p)} onCancel={e.stopRow} />
              </foreignObject>
            ) : (
              <>
                <text x={36} y={y + rowH / 2} dominantBaseline="middle" fontSize={12} fontWeight={500} fill={c.nullable ? theme.subText : theme.shapeText} className="pa-svg-text">
                  {c.name}
                </text>
                <text x={rect.width - 10} y={y + rowH / 2} dominantBaseline="middle" textAnchor="end" fontSize={12} fill={theme.subText} className="pa-svg-text">
                  {c.type}
                </text>
              </>
            )}
          </g>
        );
      })}
      {e.canEdit && selected && (
        <g className="pa-svg-addrow" onClick={(ev) => { ev.stopPropagation(); e.addRow(); }}>
          <rect x={rect.width / 2 - 34} y={rect.height + 4} width={68} height={20} rx={10} style={{ fill: theme.cardBg, stroke: theme.cardBorder, strokeWidth: 1 }} />
          <text x={rect.width / 2} y={rect.height + 14} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={theme.subText} className="pa-svg-text" style={{ cursor: "pointer" }}>
            + column
          </text>
        </g>
      )}
    </>
  );
});

function EntityRowEditor({ column, onCommit, onCancel }: { column: Column; onCommit(p: Partial<Column>): void; onCancel(): void }) {
  return (
    <span className="pa-svg-roweditor">
      <input
        autoFocus
        defaultValue={column.name}
        style={{ width: "60%" }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onCommit({ name: e.currentTarget.value.trim() || column.name, type: (e.currentTarget.nextSibling as HTMLInputElement).value });
          if (e.key === "Escape") onCancel();
        }}
      />
      <input
        defaultValue={column.type}
        style={{ width: "36%", marginLeft: "4%" }}
        onBlur={(e) => onCommit({ name: (e.currentTarget.previousSibling as HTMLInputElement).value.trim() || column.name, type: e.currentTarget.value })}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onCommit({ name: (e.currentTarget.previousSibling as HTMLInputElement).value.trim() || column.name, type: e.currentTarget.value });
          if (e.key === "Escape") onCancel();
        }}
      />
    </span>
  );
}
