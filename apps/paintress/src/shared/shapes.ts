// Shape + group-style catalogue. Pure data and SVG path generators so the
// server (sizes, /catalog) and the webapp (rendering) share one definition.

export interface ShapeDef {
  id: string;
  pack: string;
  label: string;
  w: number;
  h: number;
  /** Outline path (filled + stroked). */
  d: (w: number, h: number) => string;
  /** Extra stroke-only decoration (inner lines, markers). */
  marks?: (w: number, h: number) => string;
  /** Thick outline (BPMN end event). */
  heavy?: boolean;
  fill?: string;
  stroke?: string;
  /** Text goes below the shape instead of inside it (events, gateways). */
  labelBelow?: boolean;
}

const f = (n: number) => Math.round(n * 100) / 100;
const rect = (w: number, h: number) => `M0 0H${w}V${h}H0Z`;
const rrect = (w: number, h: number, r = 12) =>
  `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${r}Q0 0 ${r} 0Z`;
const ellipse = (w: number, h: number) =>
  `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z`;
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
const diamond = (w: number, h: number) => `M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`;
const cylinder = (w: number, h: number) => {
  const e = Math.min(h * 0.18, 18);
  return `M0 ${e}A${w / 2} ${e} 0 0 1 ${w} ${e}V${h - e}A${w / 2} ${e} 0 0 1 0 ${h - e}Z`;
};
const cylinderMarks = (w: number, h: number) => {
  const e = Math.min(h * 0.18, 18);
  return `M0 ${e}A${w / 2} ${e} 0 0 0 ${w} ${e}`;
};
const docPath = (w: number, h: number) =>
  `M0 0H${w}V${h * 0.85}C${w * 0.75} ${h * 0.7} ${w * 0.6} ${h * 1.0} ${w * 0.5} ${h * 0.9}C${w * 0.3} ${h * 0.8} ${w * 0.15} ${h * 1.0} 0 ${h * 0.9}Z`;

export const SHAPES: ShapeDef[] = [
  // ---- basic ----
  { id: "rectangle", pack: "basic", label: "Rectangle", w: 160, h: 80, d: rect },
  { id: "rounded", pack: "basic", label: "Rounded", w: 160, h: 80, d: (w, h) => rrect(w, h, 14) },
  { id: "ellipse", pack: "basic", label: "Ellipse", w: 160, h: 90, d: ellipse },
  { id: "diamond", pack: "basic", label: "Diamond", w: 160, h: 110, d: diamond },
  { id: "triangle", pack: "basic", label: "Triangle", w: 140, h: 120, d: (w, h) => `M${w / 2} 0L${w} ${h}L0 ${h}Z` },
  {
    id: "hexagon", pack: "basic", label: "Hexagon", w: 170, h: 90,
    d: (w, h) => `M${w * 0.22} 0H${w * 0.78}L${w} ${h / 2}L${w * 0.78} ${h}H${w * 0.22}L0 ${h / 2}Z`,
  },
  { id: "parallelogram", pack: "basic", label: "Parallelogram", w: 170, h: 80, d: (w, h) => `M${w * 0.2} 0H${w}L${w * 0.8} ${h}H0Z` },
  { id: "cylinder", pack: "basic", label: "Cylinder", w: 110, h: 110, d: cylinder, marks: cylinderMarks },
  {
    id: "cloud", pack: "basic", label: "Cloud", w: 190, h: 110,
    d: (w, h) =>
      `M${w * 0.25} ${h * 0.9}C${w * 0.05} ${h * 0.9} ${w * 0.02} ${h * 0.55} ${w * 0.2} ${h * 0.5}C${w * 0.15} ${h * 0.2} ${w * 0.45} ${h * 0.05} ${w * 0.55} ${h * 0.25}C${w * 0.7} ${h * 0.05} ${w * 0.95} ${h * 0.25} ${w * 0.85} ${h * 0.5}C${w * 1.02} ${h * 0.6} ${w * 0.95} ${h * 0.9} ${w * 0.75} ${h * 0.9}Z`,
  },
  {
    id: "note", pack: "basic", label: "Note", w: 150, h: 100, fill: "#fff7cc",
    d: (w, h) => `M0 0H${w - 18}L${w} 18V${h}H0Z`, marks: (w) => `M${w - 18} 0V18H${w}`,
  },
  { id: "icon-card", pack: "basic", label: "Icon card", w: 120, h: 100, d: (w, h) => rrect(w, h, 10) },

  // ---- flowchart ----
  { id: "process", pack: "flowchart", label: "Process", w: 160, h: 70, d: rect },
  { id: "decision", pack: "flowchart", label: "Decision", w: 170, h: 110, d: diamond },
  { id: "terminator", pack: "flowchart", label: "Start / End", w: 160, h: 60, d: (w, h) => rrect(w, h, h / 2) },
  { id: "io", pack: "flowchart", label: "Input / Output", w: 170, h: 70, d: (w, h) => `M${w * 0.15} 0H${w}L${w * 0.85} ${h}H0Z` },
  { id: "document", pack: "flowchart", label: "Document", w: 160, h: 80, d: docPath },
  {
    id: "multi-document", pack: "flowchart", label: "Multiple documents", w: 170, h: 90,
    d: (w, h) => docPath(w - 12, h - 12).replace(/^M0 0/, "M12 12"), marks: (w, h) => `M12 12V6H${w - 6}V${h - 18}M18 6V0H${w}V${h - 24}`,
  },
  { id: "database", pack: "flowchart", label: "Database", w: 110, h: 110, d: cylinder, marks: cylinderMarks },
  {
    id: "predefined", pack: "flowchart", label: "Predefined process", w: 170, h: 70, d: rect,
    marks: (w, h) => `M14 0V${h}M${w - 14} 0V${h}`,
  },
  { id: "manual-input", pack: "flowchart", label: "Manual input", w: 160, h: 70, d: (w, h) => `M0 ${h * 0.25}L${w} 0V${h}H0Z` },
  { id: "manual-operation", pack: "flowchart", label: "Manual operation", w: 160, h: 70, d: (w, h) => `M0 0H${w}L${w * 0.85} ${h}H${w * 0.15}Z` },
  { id: "delay", pack: "flowchart", label: "Delay", w: 150, h: 70, d: (w, h) => `M0 0H${w * 0.65}A${w * 0.35} ${h / 2} 0 0 1 ${w * 0.65} ${h}H0Z` },
  {
    id: "preparation", pack: "flowchart", label: "Preparation", w: 170, h: 70,
    d: (w, h) => `M${w * 0.15} 0H${w * 0.85}L${w} ${h / 2}L${w * 0.85} ${h}H${w * 0.15}L0 ${h / 2}Z`,
  },
  { id: "offpage", pack: "flowchart", label: "Off-page connector", w: 70, h: 80, d: (w, h) => `M0 0H${w}V${h * 0.65}L${w / 2} ${h}L0 ${h * 0.65}Z` },
  { id: "connector", pack: "flowchart", label: "Connector", w: 48, h: 48, d: ellipse },
  { id: "merge", pack: "flowchart", label: "Merge", w: 80, h: 70, d: (w, h) => `M0 0H${w}L${w / 2} ${h}Z` },
  {
    id: "display", pack: "flowchart", label: "Display", w: 170, h: 70,
    d: (w, h) => `M${w * 0.15} 0H${w * 0.8}A${w * 0.2} ${h / 2} 0 0 1 ${w * 0.8} ${h}H${w * 0.15}L0 ${h / 2}Z`,
  },
  {
    id: "stored-data", pack: "flowchart", label: "Stored data", w: 160, h: 70,
    d: (w, h) => `M${w * 0.1} 0H${w}A${w * 0.06} ${h / 2} 0 0 0 ${w} ${h}H${w * 0.1}A${w * 0.06} ${h / 2} 0 0 1 ${w * 0.1} 0Z`,
  },

  // ---- bpmn ----
  { id: "start-event", pack: "bpmn", label: "Start event", w: 48, h: 48, d: ellipse, stroke: "#4d7c0f", labelBelow: true },
  { id: "intermediate-event", pack: "bpmn", label: "Intermediate event", w: 48, h: 48, d: ellipse, marks: (w, h) => circle(w / 2, h / 2, w / 2 - 5), labelBelow: true },
  { id: "end-event", pack: "bpmn", label: "End event", w: 48, h: 48, d: ellipse, heavy: true, stroke: "#b91c1c", labelBelow: true },
  { id: "task", pack: "bpmn", label: "Task", w: 150, h: 76, d: (w, h) => rrect(w, h, 10) },
  { id: "subprocess", pack: "bpmn", label: "Sub-process", w: 170, h: 90, d: (w, h) => rrect(w, h, 10), marks: (w, h) => `M${w / 2 - 7} ${h - 16}h14v12h-14Z M${w / 2} ${h - 14}v8 M${w / 2 - 4} ${h - 10}h8` },
  { id: "gateway-exclusive", pack: "bpmn", label: "Exclusive gateway", w: 56, h: 56, d: diamond, marks: (w, h) => `M${w * 0.35} ${h * 0.35}L${w * 0.65} ${h * 0.65}M${w * 0.65} ${h * 0.35}L${w * 0.35} ${h * 0.65}`, labelBelow: true },
  { id: "gateway-parallel", pack: "bpmn", label: "Parallel gateway", w: 56, h: 56, d: diamond, marks: (w, h) => `M${w / 2} ${h * 0.25}V${h * 0.75}M${w * 0.25} ${h / 2}H${w * 0.75}`, labelBelow: true },
  { id: "gateway-inclusive", pack: "bpmn", label: "Inclusive gateway", w: 56, h: 56, d: diamond, marks: (w, h) => circle(w / 2, h / 2, w * 0.2), labelBelow: true },
  { id: "data-object", pack: "bpmn", label: "Data object", w: 60, h: 76, d: (w, h) => `M0 0H${w - 14}L${w} 14V${h}H0Z`, marks: (w) => `M${w - 14} 0V14H${w}`, labelBelow: true },
  { id: "data-store", pack: "bpmn", label: "Data store", w: 70, h: 70, d: cylinder, marks: cylinderMarks, labelBelow: true },

  // ---- c4 ----
  { id: "person", pack: "c4", label: "Person", w: 170, h: 120, fill: "#08427b", stroke: "#073b6f", d: (w, h) => rrect(w, h, 14) },
  { id: "system", pack: "c4", label: "Software system", w: 200, h: 120, fill: "#1168bd", stroke: "#0b4884", d: (w, h) => rrect(w, h, 8) },
  { id: "container", pack: "c4", label: "Container", w: 200, h: 120, fill: "#438dd5", stroke: "#3c7fc0", d: (w, h) => rrect(w, h, 8) },
  { id: "component", pack: "c4", label: "Component", w: 200, h: 110, fill: "#85bbf0", stroke: "#78a8d8", d: (w, h) => rrect(w, h, 8) },
  { id: "c4-database", pack: "c4", label: "Database", w: 150, h: 130, fill: "#438dd5", stroke: "#3c7fc0", d: cylinder, marks: cylinderMarks },
  { id: "external-system", pack: "c4", label: "External system", w: 200, h: 120, fill: "#999999", stroke: "#8a8a8a", d: (w, h) => rrect(w, h, 8) },
];

export const SHAPE_BY_ID: Record<string, ShapeDef> = Object.fromEntries(SHAPES.map((s) => [`${s.pack}:${s.id}`, s]));

export function getShape(pack: string, id: string): ShapeDef {
  return SHAPE_BY_ID[`${pack}:${id}`] ?? SHAPE_BY_ID["basic:rectangle"]!;
}

/** Look a shape up by bare id (agents often omit the pack). */
export function findShape(id: string, pack?: string): ShapeDef | undefined {
  if (pack && SHAPE_BY_ID[`${pack}:${id}`]) return SHAPE_BY_ID[`${pack}:${id}`];
  return SHAPES.find((s) => s.id === id);
}

export const SHAPE_PACKS = ["basic", "flowchart", "bpmn", "c4"] as const;

// ---------------------------------------------------------------------------
// Group styles (AWS / GCP / C4 / plain). Colours follow the vendors' diagram guidelines.
// ---------------------------------------------------------------------------
export interface GroupStyle {
  id: string;
  pack: "aws" | "gcp" | "c4" | "basic";
  label: string;
  stroke: string;
  fill: string;
  dashed?: boolean;
  /** Icon id (see /icons), drawn top-left of the group header. */
  icon?: string;
}

export const GROUP_STYLES: GroupStyle[] = [
  { id: "plain", pack: "basic", label: "Group", stroke: "#94a3b8", fill: "rgba(148,163,184,0.08)" },
  { id: "boundary", pack: "c4", label: "Boundary", stroke: "#444444", fill: "transparent", dashed: true },
  { id: "aws-cloud", pack: "aws", label: "AWS Cloud", stroke: "#232f3e", fill: "rgba(35,47,62,0.03)", icon: "logos:aws" },
  { id: "aws-account", pack: "aws", label: "AWS Account", stroke: "#e7157b", fill: "rgba(231,21,123,0.03)", dashed: true },
  { id: "aws-region", pack: "aws", label: "Region", stroke: "#00a4a6", fill: "rgba(0,164,166,0.03)", dashed: true },
  { id: "aws-vpc", pack: "aws", label: "VPC", stroke: "#8c4fff", fill: "rgba(140,79,255,0.04)", icon: "logos:aws-vpc" },
  { id: "aws-az", pack: "aws", label: "Availability Zone", stroke: "#00a4a6", fill: "transparent", dashed: true },
  { id: "aws-subnet-public", pack: "aws", label: "Public subnet", stroke: "#7aa116", fill: "rgba(122,161,22,0.08)" },
  { id: "aws-subnet-private", pack: "aws", label: "Private subnet", stroke: "#00a4a6", fill: "rgba(0,164,166,0.08)" },
  { id: "aws-sg", pack: "aws", label: "Security group", stroke: "#dd344c", fill: "transparent", dashed: true },
  { id: "aws-asg", pack: "aws", label: "Auto Scaling group", stroke: "#ed7100", fill: "transparent", dashed: true },
  { id: "aws-datacenter", pack: "aws", label: "Corporate data center", stroke: "#7d8998", fill: "rgba(125,137,152,0.06)" },
  { id: "gcp-cloud", pack: "gcp", label: "Google Cloud", stroke: "#4285f4", fill: "rgba(66,133,244,0.03)", icon: "gcp:google-cloud-platform" },
  { id: "gcp-project", pack: "gcp", label: "Project", stroke: "#4285f4", fill: "rgba(66,133,244,0.04)" },
  { id: "gcp-region", pack: "gcp", label: "Region", stroke: "#34a853", fill: "transparent", dashed: true },
  { id: "gcp-zone", pack: "gcp", label: "Zone", stroke: "#9aa0a6", fill: "transparent", dashed: true },
  { id: "gcp-vpc", pack: "gcp", label: "VPC network", stroke: "#a142f4", fill: "rgba(161,66,244,0.04)" },
  { id: "gcp-subnet", pack: "gcp", label: "Subnet", stroke: "#12b5cb", fill: "rgba(18,181,203,0.06)" },
  { id: "gcp-cluster", pack: "gcp", label: "Kubernetes cluster", stroke: "#326ce5", fill: "rgba(50,108,229,0.05)", icon: "logos:kubernetes" },
];

export const GROUP_STYLE_BY_ID: Record<string, GroupStyle> = Object.fromEntries(GROUP_STYLES.map((g) => [g.id, g]));
export const getGroupStyle = (id: string): GroupStyle => GROUP_STYLE_BY_ID[id] ?? GROUP_STYLE_BY_ID["plain"]!;

// Layout constants shared by the server layout engine and the renderers.
export const LAYOUT = {
  groupPadding: { top: 44, right: 24, bottom: 24, left: 24 },
  nodeGap: 48,
  layerGap: 80,
  entityWidth: 250,
  entityHeaderH: 38,
  entityRowH: 26,
  laneGutter: 36,
  laneMinH: 140,
  laneGap: 0,
} as const;

export const entityHeight = (columns: number) => LAYOUT.entityHeaderH + Math.max(1, columns) * LAYOUT.entityRowH + 6;
