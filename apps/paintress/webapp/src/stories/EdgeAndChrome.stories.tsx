import type { Meta, StoryObj } from "@storybook/react-vite";
import { EdgeView } from "../svg-canvas/partials/EdgeView";
import { Handles, ResizeHandles } from "../svg-canvas/partials/Handles";
import { Minimap } from "../svg-canvas/partials/Minimap";
import { ArmedPreview } from "../svg-canvas/partials/ArmedPreview";
import { CardinalityGlyph } from "../board-diagram/partials/CardinalityGlyph";
import { WithDiagram, item, noop, sampleItems, toMap } from "./fixtures";

const meta = {
  title: "Canvas/Edge & chrome",
  parameters: { layout: "centered" },
} satisfies Meta;
export default meta;

function EdgeScene(props: { data: Record<string, unknown>; label: string }) {
  const a = item({ id: "a", type: "shape", x: 20, y: 60, width: 120, height: 60, data: { pack: "basic", shape: "rectangle", text: "A" } });
  const b = item({ id: "b", type: "shape", x: 320, y: 140, width: 120, height: 60, data: { pack: "basic", shape: "ellipse", text: "B" } });
  const e = item({ id: "e", type: "edge", data: { from: { itemId: "a" }, to: { itemId: "b" }, endCap: "arrow", ...props.data } });
  const map = toMap([a, b, e]);
  return (
    <WithDiagram>
      <svg width={480} height={260} style={{ overflow: "visible" }}>
        <EdgeView item={e} map={map} selected={false} onClick={noop} />
        <text x={10} y={20} fontSize={12} className="pa-svg-text" fill="var(--ink-muted)">
          {props.label}
        </text>
      </svg>
    </WithDiagram>
  );
}

export const OrthogonalArrow: StoryObj = { render: () => <EdgeScene label="orthogonal + arrow" data={{}} /> };
export const StraightDashed: StoryObj = { render: () => <EdgeScene label="straight, dashed, label" data={{ routing: "straight", dashed: true, label: "calls" }} /> };
export const BezierAsync: StoryObj = { render: () => <EdgeScene label="bezier async" data={{ routing: "bezier", kind: "async", label: "events" }} /> };
export const CrowsFootEdge: StoryObj = { render: () => <EdgeScene label="erd relation (crow's foot)" data={{ cardinality: { from: "one", to: "zero_or_many" } }} /> };

export const SelectionHandles: StoryObj = {
  render: () => (
    <svg width={220} height={150} style={{ overflow: "visible" }}>
      <g transform="translate(30,20)">
        <rect width={160} height={80} rx={10} fill="var(--paper)" stroke="var(--ion-deep)" strokeWidth={1.5} />
        <Handles item={item({ type: "shape" })} rect={{ x: 0, y: 0, width: 160, height: 80 }} visible onPointerDown={noop} />
        <ResizeHandles item={item({ type: "shape" })} rect={{ x: 0, y: 0, width: 160, height: 80 }} zoom={1} onPointerDown={noop} />
      </g>
    </svg>
  ),
};

export const BoardMinimap: StoryObj = {
  render: () => <Minimap map={sampleItems()} viewport={{ x: 100, y: 60, zoom: 0.9 }} viewportSize={{ width: 900, height: 600 }} onPan={noop} />,
};

export const Cardinality: StoryObj = {
  render: () => (
    <svg width={360} height={140}>
      {(["one", "zero_or_one", "many", "zero_or_many", "one_or_many"] as const).map((k, i) => (
        <g key={k}>
          <line x1={30 + i * 70} y1={50} x2={60 + i * 70} y2={50} stroke="var(--ink)" strokeWidth={1.4} />
          <CardinalityGlyph x={60 + i * 70} y={50} side="right" kind={k} stroke="var(--ink)" />
          <text x={45 + i * 70} y={90} fontSize={9} textAnchor="middle" fill="var(--ink-muted)">
            {k}
          </text>
        </g>
      ))}
    </svg>
  ),
};

export const ArmedGhosts: StoryObj = {
  render: () => (
    <svg width={980} height={340} style={{ overflow: "visible" }}>
      <g transform="translate(10,10)">
        <ArmedPreview spec={{ kind: "shape", pack: "flowchart", shape: "decision" }} at={{ x: 85, y: 55 }} />
        <ArmedPreview spec={{ kind: "icon", icon: "logos:aws-lambda", label: "lambda" }} at={{ x: 250, y: 50 }} />
        <ArmedPreview spec={{ kind: "sticky", color: "#bfdbfe" }} at={{ x: 400, y: 90 }} />
        <ArmedPreview spec={{ kind: "group", style: "aws-region" }} at={{ x: 720, y: 160 }} />
      </g>
    </svg>
  ),
};
