import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import {
	forceCenter,
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	type SimulationLinkDatum,
	type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { Badge, Dialog, SearchInput } from "@twodb/ui";
import { Waypoints } from "lucide-react";
import "./KnowledgeGraph.css";

/* --- model ------------------------------------------------- */

type NodeType = "task" | "crm_profile" | "wiki_page" | "memory";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

interface GraphNode extends SimulationNodeDatum {
	id: string;
	label: string;
	type: NodeType;
	extra: Record<string, string>;
}

interface GraphEdge {
	source: string;
	target: string;
	confidence: number;
	context?: string;
}

type SimEdge = SimulationLinkDatum<GraphNode> & {
	confidence: number;
	context?: string;
};

/** A node after the simulation has run: x/y are guaranteed. */
type PNode = GraphNode & { x: number; y: number };

/* --- visual constants --------------------------------------- */

const TYPE_COLORS: Record<NodeType, string> = {
	task: "#8b5cf6",
	crm_profile: "#22c55e",
	wiki_page: "#38bdf8",
	memory: "#f59e0b",
};

const TYPE_LABELS: Record<NodeType, string> = {
	task: "Task",
	crm_profile: "Contact",
	wiki_page: "Wiki",
	memory: "Memory",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
	todo: "#94a3b8",
	in_progress: "#f59e0b",
	blocked: "#ef4444",
	done: "#22c55e",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
	todo: "todo",
	in_progress: "in progress",
	blocked: "blocked",
	done: "done",
};

const BLOCKED = "#ef4444";
const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const TYPES: NodeType[] = ["task", "crm_profile", "wiki_page", "memory"];

/* --- sample data -------------------------------------------- */

const NODES: GraphNode[] = [
	{
		id: "task_launch",
		label: "Ship graph preview",
		type: "task",
		extra: { status: "in_progress", priority: "high" },
	},
	{
		id: "task_copy",
		label: "Polish landing copy",
		type: "task",
		extra: { status: "done", priority: "medium" },
	},
	{
		id: "task_sync",
		label: "Send stakeholder update",
		type: "task",
		extra: { status: "blocked", priority: "high" },
	},
	{
		id: "task_qa",
		label: "Run release QA",
		type: "task",
		extra: { status: "todo", priority: "medium" },
	},
	{
		id: "contact_maya",
		label: "Maya Chen",
		type: "crm_profile",
		extra: { role_context: "Product lead", email: "maya@zenmori.app" },
	},
	{
		id: "contact_jon",
		label: "Jon Rivera",
		type: "crm_profile",
		extra: { role_context: "Stakeholder", email: "jon@zenmori.app" },
	},
	{
		id: "wiki_brand",
		label: "Brand voice guide",
		type: "wiki_page",
		extra: { updated: "2 days ago", sections: "12" },
	},
	{
		id: "wiki_release",
		label: "Release checklist",
		type: "wiki_page",
		extra: { updated: "yesterday", sections: "8" },
	},
	{
		id: "memory_call",
		label: "Maya wants the hero simpler",
		type: "memory",
		extra: { source: "Call notes", captured: "Mon 09:40" },
	},
	{
		id: "memory_note",
		label: "QA found an onboarding edge case",
		type: "memory",
		extra: { source: "QA session", captured: "Tue 14:15" },
	},
];

const EDGES: GraphEdge[] = [
	{ source: "task_launch", target: "contact_jon", confidence: 0.8 },
	{ source: "task_launch", target: "wiki_release", confidence: 0.9 },
	{ source: "task_launch", target: "memory_note", confidence: 0.6 },
	{ source: "task_copy", target: "contact_maya", confidence: 0.75 },
	{ source: "task_copy", target: "wiki_brand", confidence: 0.85 },
	{ source: "task_copy", target: "memory_call", confidence: 0.7 },
	{ source: "task_sync", target: "contact_jon", confidence: 0.65 },
	{
		source: "task_sync",
		target: "task_launch",
		confidence: 0.7,
		context: "blocked_by",
	},
	{ source: "task_qa", target: "wiki_release", confidence: 0.8 },
	{ source: "task_qa", target: "memory_note", confidence: 0.5 },
	{ source: "memory_call", target: "contact_maya", confidence: 0.45 },
];

/* --- helpers ------------------------------------------------- */

function clamp(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v));
}

/** Pre-ticked force layout — the simulation runs synchronously
    so the graph renders in its final, stable positions. */
function buildLayout(
	nodes: GraphNode[],
	edges: GraphEdge[],
	width: number,
	height: number,
	ticks = 300,
): { nodes: PNode[]; edges: SimEdge[] } {
	/* clone: d3 mutates nodes and link source/target in place */
	const simNodes = nodes.map((n) => ({ ...n }));
	const simEdges: SimEdge[] = edges.map((e) => ({ ...e }));

	const radius = Math.max(
		22,
		Math.min(34, 700 / Math.sqrt(simNodes.length || 1)),
	);

	const sim = forceSimulation<GraphNode>(simNodes)
		.force("charge", forceManyBody().strength(-240).distanceMax(220))
		.force("center", forceCenter(width / 2, height / 2))
		.force(
			"link",
			forceLink<GraphNode, SimEdge>(simEdges)
				.id((d) => d.id)
				.distance(90)
				.strength(0.28),
		)
		.force(
			"collide",
			forceCollide<GraphNode>((d) =>
				d.type === "memory" ? radius * 0.55 : radius,
			).strength(0.95),
		)
		.alphaDecay(0.022)
		.stop();

	for (let i = 0; i < ticks; i++) {
		sim.tick();
		for (const n of simNodes) {
			n.x = clamp(n.x ?? width / 2, radius, width - radius);
			n.y = clamp(n.y ?? height / 2, radius, height - radius);
		}
	}

	return { nodes: simNodes as PNode[], edges: simEdges };
}

/** Quadratic edge curve, bent ~0.14 of the perpendicular, with
    both ends trimmed to the node boundaries so arrowheads land
    on the rim instead of under the circle. */
function edgePath(a: PNode, b: PNode, ra: number, rb: number) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const cx = (a.x + b.x) / 2 - dy * 0.14;
	const cy = (a.y + b.y) / 2 + dx * 0.14;

	const unit = (x: number, y: number, fx: number, fy: number) => {
		const len = Math.hypot(x, y) || 1;
		return { x: x / len || fx, y: y / len || fy };
	};
	const out = unit(cx - a.x, cy - a.y, dx / (Math.hypot(dx, dy) || 1), 0);
	const inn = unit(cx - b.x, cy - b.y, -dx / (Math.hypot(dx, dy) || 1), 0);

	const sx = a.x + out.x * (ra + 2);
	const sy = a.y + out.y * (ra + 2);
	const tx = b.x + inn.x * (rb + 5);
	const ty = b.y + inn.y * (rb + 5);

	return {
		path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,
		labelX: 0.25 * sx + 0.5 * cx + 0.25 * tx,
		labelY: 0.25 * sy + 0.5 * cy + 0.25 * ty,
	};
}

function truncate(label: string): string {
	return label.length > 18 ? `${label.slice(0, 17)}…` : label;
}

function nodeRadius(n: GraphNode, matchId: string | null): number {
	return n.id === matchId ? 16 : n.type === "memory" ? 7 : 11;
}

/* --- component ----------------------------------------------- */

export function KnowledgeGraphMock() {
	const [query, setQuery] = useState("");
	const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [transform, setTransform] = useState(zoomIdentity.toString());
	const [showTypes, setShowTypes] = useState<Record<NodeType, boolean>>({
		task: true,
		crm_profile: true,
		wiki_page: true,
		memory: true,
	});
	const [statusFilters, setStatusFilters] = useState<Set<TaskStatus>>(
		new Set(STATUSES),
	);
	const [dimensions, setDimensions] = useState({ width: 1120, height: 680 });

	const canvasRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	/* size the viewport from its container (the showcase column) */
	useEffect(() => {
		const el = canvasRef.current;
		if (!el) return;
		const update = () => {
			const width = Math.max(680, el.clientWidth);
			setDimensions({
				width,
				height: Math.max(520, Math.min(720, Math.round(width * 0.62))),
			});
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	/* pan & zoom on the svg itself */
	useEffect(() => {
		const node = svgRef.current;
		if (!node) return;
		const svg = select(node);
		const behavior = zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.25, 4])
			.on("zoom", (event) => setTransform(event.transform.toString()));
		svg.call(behavior);
		svg.call(behavior.transform, zoomIdentity);
		return () => {
			svg.on(".zoom", null);
		};
	}, []);

	/* visible subgraph: type pills + task-status pills */
	const graph = useMemo(() => {
		const nodes = NODES.filter(
			(n) =>
				showTypes[n.type] &&
				(n.type !== "task" || statusFilters.has(n.extra.status as TaskStatus)),
		);
		const ids = new Set(nodes.map((n) => n.id));
		const edges = EDGES.filter((e) => ids.has(e.source) && ids.has(e.target));
		return { nodes, edges };
	}, [showTypes, statusFilters]);

	const layout = useMemo(
		() =>
			buildLayout(
				graph.nodes,
				graph.edges,
				dimensions.width,
				dimensions.height,
			),
		[graph, dimensions],
	);

	const byId = useMemo(
		() => new Map(layout.nodes.map((n) => [n.id, n])),
		[layout],
	);

	/* search: first visible node whose label contains the query */
	const q = query.trim().toLowerCase();
	const matchId = q
		? (layout.nodes.find((n) => n.label.toLowerCase().includes(q))?.id ?? null)
		: null;

	const resolvedEdges = useMemo(
		() =>
			layout.edges.flatMap((edge) => {
				const a = byId.get((edge.source as GraphNode).id);
				const b = byId.get((edge.target as GraphNode).id);
				if (!a || !b) return [];
				return [
					{
						edge,
						...edgePath(a, b, nodeRadius(a, matchId), nodeRadius(b, matchId)),
					},
				];
			}),
		[layout, byId, matchId],
	);

	/* focus: hovered > search match > selected — fade the rest */
	const activeId = hoveredId ?? matchId ?? selectedNode?.id ?? null;

	const focus = useMemo(() => {
		if (!activeId || !byId.has(activeId)) return null;
		const nodeIds = new Set<string>([activeId]);
		const edgeIndices = new Set<number>();
		resolvedEdges.forEach((r, i) => {
			const s = (r.edge.source as GraphNode).id;
			const t = (r.edge.target as GraphNode).id;
			if (s === activeId || t === activeId) {
				edgeIndices.add(i);
				nodeIds.add(s);
				nodeIds.add(t);
			}
		});
		return { nodeIds, edgeIndices, activeId };
	}, [activeId, resolvedEdges, byId]);

	function toggleType(t: NodeType) {
		setShowTypes((s) => ({ ...s, [t]: !s[t] }));
	}

	function toggleStatus(status: TaskStatus) {
		setStatusFilters((prev) => {
			const next = new Set(prev);
			if (next.has(status)) next.delete(status);
			else next.add(status);
			return next;
		});
	}

	return (
		<div className="mock-kg">
			{/* header */}
			<header className="mock-kg__head">
				<div className="mock-kg__title">
					<span className="mock-kg__mark" aria-hidden="true">
						<Waypoints />
					</span>
					<div>
						<h3>Zenmori-style knowledge graph</h3>
						<p>
							Custom React + D3 — force layout, curved edges, zoom &amp; pan
						</p>
					</div>
				</div>
				<div className="mock-kg__counts">
					<Badge>{layout.nodes.length} nodes</Badge>
					<Badge>{resolvedEdges.length} edges</Badge>
				</div>
			</header>

			{/* toolbar */}
			<div className="mock-kg__toolbar">
				<div className="mock-kg__search">
					<SearchInput
						placeholder="Search the graph…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label="Search the graph"
					/>
				</div>
				<div className="mock-kg__pills" role="group" aria-label="Node types">
					{TYPES.map((t) => (
						<button
							key={t}
							type="button"
							aria-pressed={showTypes[t]}
							className={"mock-kg__pill" + (showTypes[t] ? " is-on" : "")}
							style={{ "--pill": TYPE_COLORS[t] } as CSSProperties}
							onClick={() => toggleType(t)}
						>
							<i className="mock-kg__dot" aria-hidden="true" />
							{TYPE_LABELS[t]}
						</button>
					))}
				</div>
				<div className="mock-kg__pills" role="group" aria-label="Task status">
					{STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							aria-pressed={statusFilters.has(s)}
							className={
								"mock-kg__pill" + (statusFilters.has(s) ? " is-on" : "")
							}
							style={{ "--pill": STATUS_COLORS[s] } as CSSProperties}
							onClick={() => toggleStatus(s)}
						>
							<i className="mock-kg__dot" aria-hidden="true" />
							{STATUS_LABELS[s]}
						</button>
					))}
				</div>
			</div>

			{/* graph viewport */}
			<div className="mock-kg__canvas" ref={canvasRef}>
				<svg
					ref={svgRef}
					className="mock-kg__svg"
					width={dimensions.width}
					height={dimensions.height}
					role="img"
					aria-label="Knowledge graph"
				>
					<defs>
						<marker
							id="arrow-normal"
							viewBox="0 0 10 10"
							refX="9"
							refY="5"
							markerWidth="7"
							markerHeight="7"
							orient="auto-start-reverse"
						>
							<path d="M 0 1 L 9 5 L 0 9 z" className="mock-kg__arrow" />
						</marker>
						<marker
							id="arrow-blocked"
							viewBox="0 0 10 10"
							refX="9"
							refY="5"
							markerWidth="7"
							markerHeight="7"
							orient="auto-start-reverse"
						>
							<path d="M 0 1 L 9 5 L 0 9 z" fill={BLOCKED} />
						</marker>
						<filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
							<feGaussianBlur stdDeviation="3.5" result="blur" />
							<feMerge>
								<feMergeNode in="blur" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
					</defs>

					<g className="graph-content" transform={transform}>
						{/* edges */}
						{resolvedEdges.map((r, i) => {
							const blocked = r.edge.context === "blocked_by";
							const active = focus?.edgeIndices.has(i) ?? false;
							const opacity = focus
								? active
									? 0.95
									: 0.08
								: blocked
									? 0.7
									: r.edge.confidence * 0.55 + 0.12;
							return (
								<g
									key={`${(r.edge.source as GraphNode).id}-${(r.edge.target as GraphNode).id}`}
								>
									<path
										d={r.path}
										fill="none"
										className={
											"mock-kg__edge" +
											(blocked ? " mock-kg__edge--blocked" : "")
										}
										strokeOpacity={opacity}
										strokeWidth={active ? 3 : blocked ? 1.8 : 1.25}
										strokeDasharray={blocked ? "6,4" : undefined}
										markerEnd={
											focus
												? undefined
												: `url(#arrow-${blocked ? "blocked" : "normal"})`
										}
										filter={active ? "url(#node-glow)" : undefined}
									/>
									{blocked ? (
										<text
											className="mock-kg__edge-label"
											x={r.labelX}
											y={r.labelY - 6}
											textAnchor="middle"
											opacity={focus ? (active ? 0.95 : 0.08) : 0.9}
										>
											blocked by
										</text>
									) : null}
								</g>
							);
						})}

						{/* nodes */}
						{layout.nodes.map((n) => {
							const isMatch = n.id === matchId;
							const connected = focus?.nodeIds.has(n.id) ?? false;
							const lit = focus !== null && connected;
							const opacity = focus
								? connected
									? 1
									: 0.14
								: n.type === "memory"
									? 0.82
									: 1;
							return (
								<g
									key={n.id}
									className="mock-kg__node"
									transform={`translate(${n.x} ${n.y})`}
									opacity={opacity}
									filter={lit ? "url(#node-glow)" : undefined}
									onMouseEnter={() => setHoveredId(n.id)}
									onMouseLeave={() => setHoveredId(null)}
									onClick={() => setSelectedNode(n)}
								>
									<circle
										r={nodeRadius(n, matchId)}
										fill={TYPE_COLORS[n.type]}
										fillOpacity={n.type === "memory" ? 0.6 : 0.86}
										className="mock-kg__node-circle"
										strokeWidth={isMatch ? 4 : connected && focus ? 3 : 2}
									/>
									<text
										className={
											"mock-kg__node-label" + (isMatch ? " is-match" : "")
										}
										y={22}
										textAnchor="middle"
										fontSize={isMatch ? 12 : n.type === "memory" ? 9 : 10}
									>
										{truncate(n.label)}
									</text>
								</g>
							);
						})}
					</g>
				</svg>

				<span className="mock-kg__hint">
					Scroll to zoom · drag to pan · click a node
				</span>
			</div>

			{/* detail modal */}
			<Dialog
				open={selectedNode !== null}
				onClose={() => setSelectedNode(null)}
				title={selectedNode?.label}
			>
				{selectedNode ? (
					<div className="mock-kg__meta">
						<span
							className="mock-kg__type"
							style={{ color: TYPE_COLORS[selectedNode.type] }}
						>
							<i
								className="mock-kg__dot"
								style={{ background: TYPE_COLORS[selectedNode.type] }}
								aria-hidden="true"
							/>
							{TYPE_LABELS[selectedNode.type]}
						</span>
						<dl className="mock-kg__fields">
							{Object.entries(selectedNode.extra).map(([k, v]) => (
								<div key={k} className="mock-kg__field">
									<dt>{k.replaceAll("_", " ")}</dt>
									<dd>{v.replaceAll("_", " ")}</dd>
								</div>
							))}
						</dl>
					</div>
				) : null}
			</Dialog>
		</div>
	);
}
