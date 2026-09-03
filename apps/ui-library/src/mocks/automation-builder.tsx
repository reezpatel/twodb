import { useCallback, useMemo, useState } from "react";
import {
	Background,
	BackgroundVariant,
	BaseEdge,
	EdgeLabelRenderer,
	Handle,
	Position,
	ReactFlow,
	ReactFlowProvider,
	getSmoothStepPath,
	useEdgesState,
	useNodesState,
	useReactFlow,
	useViewport,
	type Edge,
	type EdgeProps,
	type Node,
	type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	Avatar,
	Badge,
	Button,
	IconButton,
	Menu,
	MenuDivider,
	MenuItem,
	SearchInput,
} from "@twodb/ui";
import {
	Atom,
	Bot,
	Briefcase,
	CalendarDays,
	ChartColumn,
	ChevronDown,
	ChevronLeft,
	CircleUserRound,
	Cloud,
	Copy,
	Database,
	Ellipsis,
	FileSpreadsheet,
	FileText,
	Flame,
	Folder,
	HardDrive,
	Hexagon,
	Home,
	Info,
	LayoutGrid,
	Mail,
	MessageSquare,
	Minus,
	MoreHorizontal,
	MoreVertical,
	NotebookPen,
	Pencil,
	PieChart,
	Plus,
	Presentation,
	RotateCw,
	Settings,
	Table2,
	Trash2,
	Trophy,
	Waypoints,
	Workflow,
	X,
	type LucideIcon,
} from "lucide-react";
import "./automation-builder.css";

/* ============================================================
   Automation Builder — a visual path builder on React Flow.
   Trigger → branch → steps, with edge "+" insertion fed by
   the Add Integration panel.
   ============================================================ */

/* ---------- integration catalog (nodes + panel share it) ---------- */

interface Integration {
	id: string;
	name: string;
	blurb: string;
	ink: string /* brand-ish ink for the tile */;
	Icon: LucideIcon;
	nodeSubtitle: string /* subtitle when dropped on the canvas */;
	tags: string[];
}

const GOOGLE: Integration[] = [
	{
		id: "gdocs",
		name: "Google Docs",
		blurb: "Collaborative document creation",
		ink: "#1a66d2",
		Icon: FileText,
		nodeSubtitle: "New document in Google Docs",
		tags: ["Docs", "Google"],
	},
	{
		id: "gsheets",
		name: "Google Sheets",
		blurb: "Easy data analysis and visualization",
		ink: "#0f9d58",
		Icon: Table2,
		nodeSubtitle: "New row in Google Spreadsheets",
		tags: ["Spreadsheets", "Google"],
	},
	{
		id: "gslides",
		name: "Google Slides",
		blurb: "Impactful slideshows made easy",
		ink: "#d9930d",
		Icon: Presentation,
		nodeSubtitle: "New deck in Google Slides",
		tags: ["Slides", "Google"],
	},
	{
		id: "gdrive",
		name: "Google Drive",
		blurb: "Every file, one calm shelf",
		ink: "#0f9d8f",
		Icon: HardDrive,
		nodeSubtitle: "New file in Google Drive",
		tags: ["Drive", "Google"],
	},
	{
		id: "gforms",
		name: "Google Forms",
		blurb: "Intake forms without the fuss",
		ink: "#7c3aed",
		Icon: FileSpreadsheet,
		nodeSubtitle: "The new lead filled out the form",
		tags: ["Forms", "Google"],
	},
	{
		id: "gcal",
		name: "Google Calendar",
		blurb: "The day, visible at a glance",
		ink: "#2563eb",
		Icon: CalendarDays,
		nodeSubtitle: "New event in Google Calendar",
		tags: ["Calendar", "Google"],
	},
	{
		id: "gcontacts",
		name: "Google Contacts",
		blurb: "People, deduplicated and linked",
		ink: "#1a66d2",
		Icon: CircleUserRound,
		nodeSubtitle: "New lead in Google Contacts",
		tags: ["Contacts", "Google"],
	},
	{
		id: "gmail",
		name: "Gmail",
		blurb: "Mail that files itself",
		ink: "#d92d20",
		Icon: Mail,
		nodeSubtitle: "Send email via Gmail",
		tags: ["Mail", "Google"],
	},
];

const OTHERS: Integration[] = [
	{
		id: "hotjar",
		name: "Hotjar",
		blurb: "Analyze user behavior with HotJar",
		ink: "#e11d48",
		Icon: Flame,
		nodeSubtitle: "New heatmap insight from Hotjar",
		tags: ["Analytics"],
	},
	{
		id: "office365",
		name: "Office 365",
		blurb: "Enhance workflow with Office 365",
		ink: "#7c3aed",
		Icon: LayoutGrid,
		nodeSubtitle: "New event in Office 365",
		tags: ["Suite", "Microsoft"],
	},
	{
		id: "mailchimp",
		name: "Mailchimp",
		blurb: "Streamline your marketing efforts",
		ink: "#b45309",
		Icon: MessageSquare,
		nodeSubtitle: "Add subscriber in Mailchimp",
		tags: ["Marketing"],
	},
	{
		id: "chatgpt",
		name: "ChatGPT",
		blurb: "Drafts, summaries, and commands",
		ink: "#0f9d8f",
		Icon: Bot,
		nodeSubtitle: "Send command to ChatGPT",
		tags: ["AI", "Chat GPT"],
	},
	{
		id: "notion",
		name: "Notion",
		blurb: "Docs and databases in one place",
		ink: "#121218",
		Icon: NotebookPen,
		nodeSubtitle: "New page in Notion",
		tags: ["Docs"],
	},
	{
		id: "hubspot",
		name: "HubSpot",
		blurb: "The pipeline, kept honest",
		ink: "#ea580c",
		Icon: Hexagon,
		nodeSubtitle: "New deal in HubSpot",
		tags: ["CRM"],
	},
	{
		id: "salesforce",
		name: "Salesforce",
		blurb: "Enterprise CRM on tap",
		ink: "#0ea5e9",
		Icon: Cloud,
		nodeSubtitle: "New record in Salesforce",
		tags: ["CRM"],
	},
	{
		id: "airtable",
		name: "Airtable",
		blurb: "A spreadsheet that thinks in rows",
		ink: "#d9930d",
		Icon: Database,
		nodeSubtitle: "New record in Airtable",
		tags: ["Tables"],
	},
];

const INTEGRATIONS = [...GOOGLE, ...OTHERS];

/* ---------- flow types ---------- */

type StepStatus = "trigger" | "approved" | "pending";

interface StepData extends Record<string, unknown> {
	title: string;
	subtitle: string;
	iconId: string;
	tags: string[];
	status?: StepStatus;
	onDelete: (id: string) => void;
}

type StepNode = Node<StepData, "step">;
type BuilderNode = Node<Record<string, unknown>>;

interface FlowEdgeData extends Record<string, unknown> {
	label?: string;
	onAdd: (edgeId: string) => void;
}

type FlowEdge = Edge<FlowEdgeData>;

/* measured constants for hand layout + insertion */
const NODE_W: Record<string, number> = {
	launch: 76,
	paths: 300,
	step: 320,
	add: 26,
};
const NODE_H: Record<string, number> = {
	launch: 34,
	paths: 76,
	step: 118,
	add: 26,
};
const INSERT_DROP = 220;

const centerX = (n: BuilderNode) =>
	n.position.x + (NODE_W[n.type ?? "step"] ?? 320) / 2;

/* ---------- custom nodes ---------- */

function StatusBadge({ status }: { status: StepStatus }) {
	if (status === "trigger") return <Badge tone="danger">Trigger</Badge>;
	if (status === "approved") return <Badge tone="go">Approved</Badge>;
	return <Badge tone="rose">Pending</Badge>;
}

function StepNodeCard({ id, data }: NodeProps<StepNode>) {
	const integ =
		INTEGRATIONS.find((i) => i.id === data.iconId) ?? INTEGRATIONS[0];
	return (
		<div className="mock-ab__node">
			<Handle type="target" position={Position.Top} />
			<div className="mock-ab__nodehead">
				<span
					className="mock-ab__tile"
					style={{ color: integ.ink, background: `${integ.ink}14` }}
				>
					<integ.Icon size={18} />
				</span>
				<span className="mock-ab__nodetext">
					<strong>{data.title}</strong>
					<em>{data.subtitle}</em>
				</span>
				<Menu
					trigger={
						<IconButton
							label={`${data.title} actions`}
							icon={<MoreHorizontal />}
							size="sm"
							variant="ghost"
						/>
					}
				>
					<MenuItem icon={<Pencil />}>Rename</MenuItem>
					<MenuItem icon={<Copy />}>Duplicate</MenuItem>
					<MenuDivider />
					<MenuItem icon={<Trash2 />} danger onClick={() => data.onDelete(id)}>
						Delete
					</MenuItem>
				</Menu>
			</div>
			<div className="mock-ab__nodefoot">
				{data.tags.map((t) => (
					<span key={t} className="mock-ab__tag">
						{t}
					</span>
				))}
				{data.status ? (
					<span className="mock-ab__status">
						<StatusBadge status={data.status} />
					</span>
				) : null}
			</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

function PathsNodeCard() {
	return (
		<div className="mock-ab__node mock-ab__node--paths">
			<Handle type="target" position={Position.Top} />
			<div className="mock-ab__nodehead">
				<span className="mock-ab__tile mock-ab__tile--brand">
					<Atom size={18} />
				</span>
				<span className="mock-ab__nodetext">
					<strong>Add paths</strong>
					<em>twodb Automation</em>
				</span>
				<Menu
					trigger={
						<IconButton
							label="Path actions"
							icon={<MoreHorizontal />}
							size="sm"
							variant="ghost"
						/>
					}
				>
					<MenuItem icon={<Plus />}>Add another path</MenuItem>
					<MenuItem icon={<Pencil />}>Rename</MenuItem>
				</Menu>
			</div>
			<Handle
				type="source"
				id="a"
				position={Position.Bottom}
				style={{ left: "20%" }}
			/>
			<Handle
				type="source"
				id="b"
				position={Position.Bottom}
				style={{ left: "80%" }}
			/>
		</div>
	);
}

function LaunchNode() {
	return (
		<div className="mock-ab__launch">
			Launch
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}

function AddNode({ data }: NodeProps<BuilderNode>) {
	const onOpen = data.onOpen as () => void;
	return (
		<button
			type="button"
			className="mock-ab__add"
			aria-label="Add a step here"
			onClick={(e) => {
				e.stopPropagation();
				onOpen();
			}}
		>
			<Plus size={13} />
			<Handle type="target" position={Position.Top} />
		</button>
	);
}

const nodeTypes = {
	step: StepNodeCard,
	paths: PathsNodeCard,
	launch: LaunchNode,
	add: AddNode,
};

/* ---------- custom edge: smoothstep + label chip + insert "+" ---------- */

function FlowEdge(props: EdgeProps<FlowEdge>) {
	const {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		data,
	} = props;
	const [path, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		borderRadius: 14,
	});
	return (
		<>
			<BaseEdge id={id} path={path} className="mock-ab__edgepath" />
			<EdgeLabelRenderer>
				<div
					className="mock-ab__edgetools"
					style={{
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
					}}
				>
					{data?.label ? (
						<span className="mock-ab__edgelabel">{data.label}</span>
					) : null}
					<button
						type="button"
						className="mock-ab__edgeadd"
						aria-label="Insert a step on this path"
						onClick={() => data?.onAdd(id)}
					>
						<Plus size={11} />
					</button>
				</div>
			</EdgeLabelRenderer>
		</>
	);
}

const edgeTypes = { flow: FlowEdge };

/* ---------- graph construction ---------- */

function mkEdge(
	onAdd: (edgeId: string) => void,
	opts: {
		id: string;
		source: string;
		target: string;
		sourceHandle?: string;
		label?: string;
	},
): FlowEdge {
	return {
		id: opts.id,
		source: opts.source,
		target: opts.target,
		sourceHandle: opts.sourceHandle,
		type: "flow",
		data: { label: opts.label, onAdd },
	};
}

function stepNode(
	id: string,
	x: number,
	y: number,
	integration: Integration,
	title: string,
	status: StepStatus | undefined,
	onDelete: (id: string) => void,
	subtitle?: string,
): StepNode {
	return {
		id,
		type: "step",
		position: { x, y },
		data: {
			title,
			subtitle: subtitle ?? integration.nodeSubtitle,
			iconId: integration.id,
			tags: integration.tags,
			status,
			onDelete,
		},
	};
}

function buildInitialGraph(
	onAdd: (edgeId: string) => void,
	onDelete: (id: string) => void,
): { nodes: BuilderNode[]; edges: FlowEdge[] } {
	const gforms = GOOGLE.find((i) => i.id === "gforms")!;
	const chatgpt = OTHERS.find((i) => i.id === "chatgpt")!;
	const gcontacts = GOOGLE.find((i) => i.id === "gcontacts")!;
	const gsheets = GOOGLE.find((i) => i.id === "gsheets")!;

	const nodes: BuilderNode[] = [
		{ id: "launch", type: "launch", position: { x: 382, y: 0 }, data: {} },
		stepNode(
			"trigger",
			260,
			84,
			gforms,
			"New entry in Google Forms",
			"trigger",
			onDelete,
		),
		{ id: "paths", type: "paths", position: { x: 270, y: 258 }, data: {} },
		stepNode(
			"email",
			-60,
			436,
			chatgpt,
			"Write an email in Chat GPT",
			"approved",
			onDelete,
			"Send command to write an email",
		),
		stepNode(
			"contact",
			600,
			436,
			gcontacts,
			"Create new contact",
			"approved",
			onDelete,
		),
		stepNode(
			"sheet",
			600,
			632,
			gsheets,
			"New spreadsheet entry",
			"pending",
			onDelete,
		),
		{
			id: "add-email",
			type: "add",
			position: { x: 87, y: 606 },
			data: { onOpen: () => onAdd("e-email-add") },
		},
		{
			id: "add-sheet",
			type: "add",
			position: { x: 747, y: 802 },
			data: { onOpen: () => onAdd("e-sheet-add") },
		},
	];

	const edges: FlowEdge[] = [
		mkEdge(onAdd, {
			id: "e-launch-trigger",
			source: "launch",
			target: "trigger",
		}),
		mkEdge(onAdd, {
			id: "e-trigger-paths",
			source: "trigger",
			target: "paths",
		}),
		mkEdge(onAdd, {
			id: "e-paths-email",
			source: "paths",
			sourceHandle: "a",
			target: "email",
			label: "Path 1",
		}),
		mkEdge(onAdd, {
			id: "e-paths-contact",
			source: "paths",
			sourceHandle: "b",
			target: "contact",
			label: "Path 2",
		}),
		mkEdge(onAdd, {
			id: "e-contact-sheet",
			source: "contact",
			target: "sheet",
		}),
		mkEdge(onAdd, { id: "e-email-add", source: "email", target: "add-email" }),
		mkEdge(onAdd, { id: "e-sheet-add", source: "sheet", target: "add-sheet" }),
	];

	return { nodes, edges };
}

/* ---------- zoom bar ( − 100% + ) ---------- */

function ZoomBar() {
	const { zoomIn, zoomOut } = useReactFlow();
	const { zoom } = useViewport();
	return (
		<div className="mock-ab__zoom" aria-label="Canvas zoom">
			<button type="button" aria-label="Zoom out" onClick={() => zoomOut()}>
				<Minus size={13} />
			</button>
			<span className="tw-tnum">{Math.round(zoom * 100)}%</span>
			<button type="button" aria-label="Zoom in" onClick={() => zoomIn()}>
				<Plus size={13} />
			</button>
		</div>
	);
}

/* ---------- integration row ---------- */

function IntegrationRow({
	integration,
	selected,
	onSelect,
}: {
	integration: Integration;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			className={
				selected ? "mock-ab__integ mock-ab__integ--picked" : "mock-ab__integ"
			}
			aria-pressed={selected}
			onClick={onSelect}
		>
			<span
				className="mock-ab__tile"
				style={{ color: integration.ink, background: `${integration.ink}14` }}
			>
				<integration.Icon size={18} />
			</span>
			<span className="mock-ab__nodetext">
				<strong>{integration.name}</strong>
				<em>{integration.blurb}</em>
			</span>
		</button>
	);
}

/* ---------- the builder ---------- */

function Builder() {
	const [tab, setTab] = useState("builder");
	const [rail, setRail] = useState("automations");
	const [query, setQuery] = useState("");

	const [panelEdge, setPanelEdge] = useState<string | null>(null);
	const [picked, setPicked] = useState<string | null>(null);
	const [googleShown, setGoogleShown] = useState(3);
	const [othersShown, setOthersShown] = useState(3);

	const openPanel = useCallback((edgeId: string) => {
		setPanelEdge(edgeId);
		setPicked(null);
	}, []);

	const deleteNode = useCallback(
		(id: string) => {
			setEdges((eds) => {
				const incoming = eds.find((e) => e.target === id);
				const outgoing = eds.filter((e) => e.source === id);
				let next = eds.filter((e) => e.source !== id && e.target !== id);
				if (incoming && outgoing.length === 1) {
					next = [
						...next,
						mkEdge(openPanel, {
							id: incoming.id,
							source: incoming.source,
							sourceHandle: incoming.sourceHandle ?? undefined,
							target: outgoing[0].target,
							label: incoming.data?.label,
						}),
					];
				}
				return next;
			});
			setNodes((nds) => nds.filter((n) => n.id !== id));
		},
		[openPanel],
	);

	const [initial] = useState(() => buildInitialGraph(openPanel, deleteNode));
	const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(
		initial.nodes,
	);
	const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(
		initial.edges,
	);

	/* Insert the picked integration as a step on the pending edge. */
	const insertStep = useCallback(() => {
		if (!panelEdge || !picked) return;
		const edge = edges.find((e) => e.id === panelEdge);
		const integ = INTEGRATIONS.find((i) => i.id === picked);
		setPanelEdge(null);
		if (!edge || !integ) return;

		const id = `step-${Math.random().toString(36).slice(2, 8)}`;
		setNodes((nds) => {
			const src = nds.find((n) => n.id === edge.source);
			const tgt = nds.find((n) => n.id === edge.target);
			if (!src || !tgt) return nds;
			const srcCx = centerX(src);
			const srcBottom = src.position.y + (NODE_H[src.type ?? "step"] ?? 118);

			if (tgt.type === "add") {
				/* terminal "+": the step takes its place, the "+" drops below */
				const node = stepNode(
					id,
					srcCx - NODE_W.step / 2,
					tgt.position.y - 30,
					integ,
					integ.name,
					undefined,
					deleteNode,
				);
				return [
					...nds.map((n) =>
						n.id === tgt.id
							? {
									...n,
									position: {
										x: srcCx - NODE_W.add / 2,
										y: tgt.position.y - 30 + NODE_H.step + 52,
									},
								}
							: n,
					),
					node,
				];
			}

			const tgtCx = centerX(tgt);
			const node = stepNode(
				id,
				(srcCx + tgtCx) / 2 - NODE_W.step / 2,
				(srcBottom + tgt.position.y) / 2 - NODE_H.step / 2,
				integ,
				integ.name,
				undefined,
				deleteNode,
			);
			return [
				...nds.map((n) =>
					n.position.y >= tgt.position.y
						? {
								...n,
								position: {
									x: n.position.x,
									y: n.position.y + INSERT_DROP,
								},
							}
						: n,
				),
				node,
			];
		});
		setEdges((eds) => [
			...eds.filter((e) => e.id !== edge.id),
			mkEdge(openPanel, {
				id: `${edge.id}__a`,
				source: edge.source,
				sourceHandle: edge.sourceHandle ?? undefined,
				target: id,
				label: edge.data?.label,
			}),
			mkEdge(openPanel, {
				id: `${edge.id}__b`,
				source: id,
				target: edge.target,
			}),
		]);
	}, [panelEdge, picked, edges, openPanel, deleteNode, setNodes, setEdges]);

	/* search dims non-matching step cards */
	const q = query.trim().toLowerCase();
	const displayNodes = useMemo(
		() =>
			q
				? nodes.map((n) =>
						n.type === "step" &&
						!(n.data.title as string).toLowerCase().includes(q)
							? { ...n, className: "is-dim" }
							: n,
					)
				: nodes,
		[nodes, q],
	);

	const railItems = [
		{ id: "home", Icon: Home, label: "Home" },
		{ id: "insights", Icon: PieChart, label: "Insights" },
		{ id: "automations", Icon: Workflow, label: "Automations" },
		{ id: "docs", Icon: FileText, label: "Documents" },
		{ id: "files", Icon: Folder, label: "Files" },
		{ id: "work", Icon: Briefcase, label: "Work" },
	];

	return (
		<div className="mock-ab">
			{/* --- slim app rail --- */}
			<aside className="mock-ab__rail" aria-label="App">
				<span className="mock-ab__logo" aria-hidden="true">
					<Atom size={20} />
				</span>
				{railItems.map(({ id, Icon, label }) => (
					<button
						key={id}
						type="button"
						className={
							rail === id
								? "mock-ab__railitem mock-ab__railitem--active"
								: "mock-ab__railitem"
						}
						aria-label={label}
						aria-current={rail === id ? "page" : undefined}
						onClick={() => setRail(id)}
					>
						<Icon size={18} />
					</button>
				))}
				<span className="mock-ab__railspacer" />
				{[
					{ Icon: Info, label: "Help" },
					{ Icon: Settings, label: "Settings" },
					{ Icon: Ellipsis, label: "More" },
				].map(({ Icon, label }) => (
					<button
						key={label}
						type="button"
						className="mock-ab__railitem"
						aria-label={label}
					>
						<Icon size={18} />
					</button>
				))}
			</aside>

			{/* --- main column --- */}
			<div className="mock-ab__main">
				<header className="mock-ab__topbar">
					<IconButton
						label="Back to automations"
						icon={<ChevronLeft />}
						variant="secondary"
						size="sm"
					/>
					<div className="mock-ab__title">
						<strong>New Lead Sales Process</strong>
						<span>Last edited: 3 days ago</span>
					</div>
					<nav className="mock-ab__tabs" aria-label="Builder sections">
						<button
							type="button"
							className={
								tab === "campaigns"
									? "mock-ab__tab mock-ab__tab--active"
									: "mock-ab__tab"
							}
							onClick={() => setTab("campaigns")}
						>
							<Trophy size={15} /> Campaigns
						</button>
						<button
							type="button"
							className={
								tab === "builder"
									? "mock-ab__tab mock-ab__tab--active"
									: "mock-ab__tab"
							}
							onClick={() => setTab("builder")}
						>
							<Waypoints size={15} /> Path Builder
						</button>
						<button
							type="button"
							className={
								tab === "analytics"
									? "mock-ab__tab mock-ab__tab--active"
									: "mock-ab__tab"
							}
							onClick={() => setTab("analytics")}
						>
							<ChartColumn size={15} /> Analytics
						</button>
					</nav>
					<div className="mock-ab__actions">
						<Button variant="secondary" size="sm">
							Present
						</Button>
						<Button variant="secondary" size="sm">
							Share
						</Button>
						<Button size="sm">Publish</Button>
					</div>
				</header>

				<div className="mock-ab__canvas">
					{tab === "builder" ? (
						<>
							<div className="mock-ab__search">
								<SearchInput
									placeholder="Search"
									aria-label="Search steps"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
								/>
							</div>
							<div className="mock-ab__people">
								<span className="mock-ab__faces">
									<Avatar name="Asha Verma" size="sm" />
									<Avatar name="Ravi Kumar" size="sm" />
									<Avatar name="Meera Iyer" size="sm" />
									<Avatar name="Dev Patel" size="sm" />
								</span>
								<IconButton
									label="Collaboration options"
									icon={<MoreVertical />}
									size="sm"
									variant="ghost"
								/>
							</div>
							<ReactFlow
								nodes={displayNodes}
								edges={edges}
								nodeTypes={nodeTypes}
								edgeTypes={edgeTypes}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								nodesConnectable={false}
								deleteKeyCode={null}
								fitView
								fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
								minZoom={0.4}
								maxZoom={1.6}
								proOptions={{ hideAttribution: true }}
							>
								<Background
									variant={BackgroundVariant.Dots}
									gap={26}
									size={1.2}
									color="#d9d7e3"
								/>
							</ReactFlow>
							<ZoomBar />
						</>
					) : (
						<div className="mock-ab__placeholder">
							<span className="tw-cue">
								{tab === "campaigns" ? "Campaigns" : "Analytics"}
							</span>
							<p>
								This mock covers the Path Builder — the rest of the product is
								still on the horizon.
							</p>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setTab("builder")}
							>
								Back to Path Builder
							</Button>
						</div>
					)}

					{/* --- Add Integration panel --- */}
					<aside
						className={
							panelEdge
								? "mock-ab__panel mock-ab__panel--open"
								: "mock-ab__panel"
						}
						aria-hidden={!panelEdge}
					>
						<header className="mock-ab__panelhead">
							<h3>Add Integration</h3>
							<span className="mock-ab__paneltools">
								<IconButton
									label="Refresh integrations"
									icon={<RotateCw />}
									size="sm"
									variant="ghost"
								/>
								<IconButton
									label="Close panel"
									icon={<X />}
									size="sm"
									variant="ghost"
									onClick={() => setPanelEdge(null)}
								/>
							</span>
						</header>
						<div className="mock-ab__panelbody">
							<span className="mock-ab__group">Google</span>
							{GOOGLE.slice(0, googleShown).map((i) => (
								<IntegrationRow
									key={i.id}
									integration={i}
									selected={picked === i.id}
									onSelect={() => setPicked(i.id)}
								/>
							))}
							{googleShown < GOOGLE.length ? (
								<button
									type="button"
									className="mock-ab__more"
									onClick={() => setGoogleShown(GOOGLE.length)}
								>
									<ChevronDown size={14} /> Load more (
									{GOOGLE.length - googleShown})
								</button>
							) : null}
							<span className="mock-ab__group">Others</span>
							{OTHERS.slice(0, othersShown).map((i) => (
								<IntegrationRow
									key={i.id}
									integration={i}
									selected={picked === i.id}
									onSelect={() => setPicked(i.id)}
								/>
							))}
							{othersShown < OTHERS.length ? (
								<button
									type="button"
									className="mock-ab__more"
									onClick={() => setOthersShown(OTHERS.length)}
								>
									<ChevronDown size={14} /> Load more (
									{OTHERS.length - othersShown})
								</button>
							) : null}
						</div>
						<footer className="mock-ab__panelfoot">
							<Button variant="secondary" onClick={() => setPanelEdge(null)}>
								Dismiss
							</Button>
							<Button disabled={!picked} onClick={insertStep}>
								Continue
							</Button>
						</footer>
					</aside>
				</div>
			</div>
		</div>
	);
}

export function AutomationBuilderMock() {
	return (
		<ReactFlowProvider>
			<Builder />
		</ReactFlowProvider>
	);
}
