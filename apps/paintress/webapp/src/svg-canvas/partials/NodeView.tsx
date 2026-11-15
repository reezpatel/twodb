import { memo } from "react";
import type { Item } from "@shared/model";
import { getShape, getGroupStyle } from "@shared/shapes";
import { paintressClient } from "../../lib/paintress-client";
import { useCanvasTheme, visibleStroke, type CanvasTheme } from "../../lib/canvas-theme";
import { useDiagramActions } from "../../board-diagram/DiagramContext";
import { useInlineEdit } from "../../board-diagram/hooks/useInlineEdit";
import { strokePath, type Rect } from "../lib/geometry";
import { EntityView } from "./EntityView";

export interface NodeViewProps {
  item: Item;
  rect: Rect; // live abs rect (drag/resize already applied)
  selected: boolean;
  hovered: boolean;
  dropTarget: boolean;
  flash: boolean;
  onPointerDown(e: React.PointerEvent, item: Item): void;
  onClick(e: React.MouseEvent, item: Item): void;
}

const GRIP = "cursor-grab";

/** One board item as SVG content. Pure presentation except inline text editing. */
function NodeViewImpl(p: NodeViewProps) {
  const { item, rect } = p;
  const theme = useCanvasTheme();
  const actions = useDiagramActions();
  const text = (item.data as { text?: string }).text ?? "";
  const edit = useInlineEdit(text, (v) => actions.patch(item.id, { data: { text: v } }, "Edit text"), actions.canEdit);

  const common = {
    onPointerDown: (e: React.PointerEvent) => p.onPointerDown(e, item),
    onClick: (e: React.MouseEvent) => p.onClick(e, item),
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      edit.start();
    },
    style: { cursor: actions.canEdit ? GRIP : "default" } as React.CSSProperties,
  };

  // Inline editing: the canvas swaps the SVG text for an HTML editor overlay.
  // Shapes render their label at the vertical centre, so the editor is centred
  // too; stickies/text/groups render top-aligned, so their editor stays on top.
  const centerEditor = item.type === "shape";
  const editor = edit.editing ? (
    <foreignObject x={0} y={0} width={rect.width} height={rect.height}>
      <div style={centerEditor ? { display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" } : { width: "100%", height: "100%" }}>
        <textarea
          autoFocus
          defaultValue={text}
          className="pa-svg-editor"
          rows={centerEditor ? Math.min(6, Math.max(1, (text || " ").split("\n").length)) : undefined}
          style={{ fontSize: (item.data as { fontSize?: number }).fontSize ?? 13, ...(centerEditor ? { width: "calc(100% - 8px)", height: "auto" } : {}) }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => edit.onCommit(e.currentTarget.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") edit.onCancel();
            else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              edit.onCommit(e.currentTarget.value);
            }
          }}
        />
      </div>
    </foreignObject>
  ) : null;

  let body: React.ReactNode = null;
  switch (item.type) {
    case "shape":
      body = <ShapeBody item={item} rect={rect} theme={theme} editing={edit.editing} />;
      break;
    case "sticky":
      body = <StickyBody item={item} rect={rect} theme={theme} editing={edit.editing} />;
      break;
    case "text":
      body = <TextBody item={item} rect={rect} theme={theme} editing={edit.editing} />;
      break;
    case "image":
      body = <ImageBody item={item} rect={rect} />;
      break;
    case "entity":
      body = <EntityView item={item} rect={rect} theme={theme} selected={p.selected} />;
      break;
    case "group":
      body = <GroupBody item={item} rect={rect} theme={theme} editing={edit.editing} />;
      break;
    case "pool":
      body = <PoolBody item={item} rect={rect} theme={theme} editing={edit.editing} />;
      break;
    case "lane":
      body = <LaneBody item={item} rect={rect} theme={theme} editing={edit.editing} />;
      break;
    case "draw":
      body = <DrawBody item={item} rect={rect} />;
      break;
  }

  return (
    <>
      <g
        transform={`translate(${rect.x}, ${rect.y})`}
        data-item={item.id}
        data-type={item.type}
        className={p.flash ? "pa-svg-flash" : undefined}
        opacity={item.locked ? 0.75 : 1}
        {...common}
      >
        {body}
        {p.selected && <rect width={rect.width} height={rect.height} fill="none" stroke="var(--ion-deep)" strokeWidth={1.5 / 1} strokeDasharray="5 4" rx={6} className="pa-select-ring" />}
        {p.dropTarget && <rect width={rect.width} height={rect.height} fill="var(--ion)" fillOpacity={0.12} stroke="var(--ion-deep)" strokeWidth={2} rx={6} />}
        {editor}
      </g>
    </>
  );
}

export const NodeView = memo(NodeViewImpl);

// ---------------------------------------------------------------- shapes

function ShapeBody({ item, rect, theme, editing }: { item: Item; rect: Rect; theme: CanvasTheme; editing: boolean }) {
  const d = item.data as { pack?: string; shape?: string; text?: string; sublabel?: string; icon?: string; fill?: string; stroke?: string; dashed?: boolean; fontSize?: number };
  const def = getShape(d.pack ?? "basic", d.shape ?? "rectangle");
  const w = rect.width;
  const h = rect.height;
  const stroke = visibleStroke(d.stroke ?? def.stroke ?? theme.shapeStroke, theme);
  const filled = def.fill && def.fill !== "#ffffff" && !def.fill.startsWith("#fff");
  const color = filled ? "#ffffff" : theme.shapeText;
  const path = <path d={def.d(w, h)} style={{ fill: d.fill ?? def.fill ?? theme.shapeFill, stroke, strokeWidth: def.heavy ? 3.5 : 1.5 }} strokeLinejoin="round" strokeDasharray={d.dashed ? "6 4" : undefined} />;
  return (
    <>
      {path}
      {def.marks && <path d={def.marks(w, h)} fill="none" style={{ stroke, strokeWidth: 1.2 }} />}
      {!editing && <ShapeLabel item={item} def={{ iconCard: def.id === "icon-card", labelBelow: !!def.labelBelow }} color={color} w={w} h={h} />}
    </>
  );
}

function ShapeLabel({ item, def, color, w, h }: { item: Item; def: { iconCard: boolean; labelBelow: boolean }; color: string; w: number; h: number }) {
  const d = item.data as { text?: string; sublabel?: string; icon?: string; fontSize?: number };
  const iconUrl = d.icon ? paintressClient.iconUrl(d.icon) : null;
  const fontSize = d.fontSize ?? 13;
  if (def.iconCard) {
    return (
      <>
        {iconUrl && <image href={iconUrl} x={w / 2 - 16} y={Math.max(6, h / 2 - 30)} width={32} height={32} />}
        <text x={w / 2} y={h / 2 + 16} textAnchor="middle" fontSize={fontSize} fill={color} className="pa-svg-text">
          {d.text}
        </text>
        {d.sublabel && (
          <text x={w / 2} y={h / 2 + 30} textAnchor="middle" fontSize={11} fill={color} opacity={0.7} className="pa-svg-text">
            {d.sublabel}
          </text>
        )}
      </>
    );
  }
  const labelY = def.labelBelow ? h + 16 : h / 2;
  return (
    <>
      {iconUrl && <image href={iconUrl} x={8} y={h / 2 - 12} width={24} height={24} />}
      <text x={iconUrl ? 38 : w / 2} y={labelY} textAnchor={iconUrl ? "start" : "middle"} dominantBaseline="middle" fontSize={fontSize} fill={color} className="pa-svg-text">
        {d.text}
      </text>
      {d.sublabel && !def.labelBelow && (
        <text x={w / 2} y={h / 2 + 14} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={color} opacity={0.7} className="pa-svg-text">
          {d.sublabel}
        </text>
      )}
    </>
  );
}

function StickyBody({ item, rect, editing }: { item: Item; rect: Rect; theme: CanvasTheme; editing: boolean }) {
  const d = item.data as { text?: string; color?: string };
  return (
    <>
      <rect width={rect.width} height={rect.height} rx={3} fill={d.color ?? "#fde68a"} className="pa-svg-sticky" />
      {!editing && (
        <foreignObject x={8} y={8} width={rect.width - 16} height={rect.height - 16}>
          <div className="pa-svg-fo text-slate-900" style={{ fontSize: 15 }}>
            {d.text}
          </div>
        </foreignObject>
      )}
    </>
  );
}

function TextBody({ item, rect, theme, editing }: { item: Item; rect: Rect; theme: CanvasTheme; editing: boolean }) {
  const d = item.data as { text?: string; fontSize?: number; color?: string; align?: string };
  return (
    <>
      {!editing && (
        <foreignObject x={0} y={0} width={rect.width} height={rect.height}>
          <div className="pa-svg-fo" style={{ fontSize: d.fontSize ?? 16, color: d.color ?? theme.shapeText, textAlign: (d.align ?? "left") as never, fontWeight: 500 }}>
            {d.text || <span style={{ color: theme.subText }}>Text</span>}
          </div>
        </foreignObject>
      )}
    </>
  );
}

function DrawBody({ item, rect }: { item: Item; rect: Rect }) {
  const d = item.data as { points?: number[]; color?: string; width?: number; tool?: string; nw?: number; nh?: number };
  const flat = d.points ?? [];
  const sx = d.nw ? rect.width / d.nw : 1;
  const sy = d.nh ? rect.height / d.nh : 1;
  return (
    <g transform={sx === 1 && sy === 1 ? undefined : `scale(${sx} ${sy})`}>
      {/* fat invisible hit area so thin strokes are easy to grab */}
      <path d={strokePath(flat)} fill="none" stroke="transparent" strokeWidth={Math.max(12, (d.width ?? 3) + 6)} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={strokePath(flat)}
        fill="none"
        stroke={d.color ?? "#1e293b"}
        strokeWidth={d.width ?? 3}
        strokeOpacity={d.tool === "highlighter" ? 0.4 : 1}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
    </g>
  );
}

function ImageBody({ item, rect }: { item: Item; rect: Rect }) {
  const d = item.data as { assetId?: string; alt?: string };
  if (!d.assetId) return null;
  return <image href={paintressClient.assetUrl(d.assetId)} width={rect.width} height={rect.height} preserveAspectRatio="xMidYMid meet" aria-label={d.alt} />;
}

function GroupBody({ item, rect, theme, editing }: { item: Item; rect: Rect; theme: CanvasTheme; editing: boolean }) {
  const d = item.data as { kind?: string; title?: string; icon?: string; fill?: string; stroke?: string; dashed?: boolean };
  const style = getGroupStyle(d.kind ?? "plain");
  const stroke = visibleStroke(d.stroke ?? style.stroke, theme);
  const icon = d.icon ?? style.icon;
  return (
    <>
      <rect width={rect.width} height={rect.height} rx={6} style={{ fill: d.fill ?? style.fill, stroke, strokeWidth: 2 }} strokeDasharray={(d.dashed ?? style.dashed) ? "8 6" : undefined} />
      {!editing && (
        <g style={{ color: stroke }}>
          {icon && <image href={paintressClient.iconUrl(icon)} x={8} y={8} width={22} height={22} />}
          <text x={icon ? 36 : 10} y={19} dominantBaseline="middle" fontSize={13} fontWeight={600} fill={stroke} className="pa-svg-text">
            {d.title}
          </text>
        </g>
      )}
    </>
  );
}

function PoolBody({ item, rect, theme, editing }: { item: Item; rect: Rect; theme: CanvasTheme; editing: boolean }) {
  const title = (item.data as { title?: string }).title ?? "";
  return (
    <>
      <rect width={rect.width} height={rect.height} rx={4} fill={theme.dark ? "rgba(53,53,53,0.35)" : "rgba(255,255,255,0.4)"} stroke={theme.poolBorder} strokeWidth={2} />
      <rect width={36} height={rect.height} fill={theme.laneTitleBg} stroke={theme.poolBorder} strokeWidth={2} rx={4} />
      {!editing && (
        <text transform={`translate(18, ${rect.height / 2}) rotate(-90)`} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill={theme.shapeText} className="pa-svg-text">
          {title}
        </text>
      )}
    </>
  );
}

function LaneBody({ item, rect, theme, editing }: { item: Item; rect: Rect; theme: CanvasTheme; editing: boolean }) {
  const d = item.data as { title?: string; fill?: string };
  return (
    <>
      <rect width={rect.width} height={rect.height} style={{ fill: d.fill ?? (theme.dark ? "rgba(165,160,168,0.07)" : "rgba(148,163,184,0.06)") }} stroke={theme.cardBorder} strokeWidth={1.5} />
      <rect x={-36} width={36} height={rect.height} fill={theme.laneTitleBg} stroke={theme.cardBorder} strokeWidth={1.5} />
      {!editing && (
        <text transform={`translate(-18, ${rect.height / 2}) rotate(-90)`} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600} fill={theme.subText} className="pa-svg-text">
          {d.title}
        </text>
      )}
    </>
  );
}
