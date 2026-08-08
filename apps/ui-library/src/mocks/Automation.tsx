import { useCallback, useState } from "react";
import {
	ReactFlow,
	Background,
	Handle,
	Position,
	type Node,
	type Edge,
	type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	Button,
	IconButton,
	Input,
	SearchInput,
	Select,
	Tabs,
	Textarea,
} from "@twodb/ui";
import {
	Clock,
	Database,
	FileCode,
	FileDown,
	FileEdit,
	FileSearch,
	GitBranch,
	Globe,
	History,
	MessageSquare,
	Plus,
	Redo2,
	Share2,
	Shuffle,
	Undo2,
	X,
	Zap,
} from "lucide-react";

/* ---------------- palette ---------------- */

const PALETTE = [
	{ icon: <Shuffle />, label: "Boolean cond." },
	{ icon: <GitBranch />, label: "Branch" },
	{ icon: <X />, label: "Break loop" },
	{ icon: <FileEdit />, label: "SCV editor" },
	{ icon: <FileSearch />, label: "SCV reader" },
	{ icon: <Zap />, label: "Call workflow" },
	{ icon: <Shuffle />, label: "Data mapper" },
	{ icon: <Database />, label: "Data storage" },
	{ icon: <Clock />, label: "Delay" },
	{ icon: <FileDown />, label: "FTP client" },
	{ icon: <Globe />, label: "HTTP client" },
	{ icon: <FileCode />, label: "Script" },
];

/* ---------------- custom node ---------------- */

type FlowNodeData = {
	label: string;
	sub: string;
	icon: React.ReactNode;
	tone: "night" | "cobalt" | "rose";
	branches?: number;
};

function AutomationNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
	return (
		<div
			className={
				selected ? "mock-af__node mock-af__node--selected" : "mock-af__node"
			}
		>
			<Handle
				type="target"
				position={Position.Top}
				className="mock-af__handle"
			/>
			<span className={`mock-af__node-icon mock-af__node-icon--${data.tone}`}>
				{data.icon}
			</span>
			<span className="mock-af__node-text">
				<strong>{data.label}</strong>
				<span>{data.sub}</span>
			</span>
			{data.branches === 3 ? (
				<>
					<Handle
						type="source"
						position={Position.Bottom}
						id="q1"
						className="mock-af__handle mock-af__handle--lane1"
					/>
					<Handle
						type="source"
						position={Position.Bottom}
						id="q2"
						className="mock-af__handle mock-af__handle--lane2"
					/>
					<Handle
						type="source"
						position={Position.Bottom}
						id="def"
						className="mock-af__handle mock-af__handle--lane3"
					/>
				</>
			) : (
				<Handle
					type="source"
					position={Position.Bottom}
					className="mock-af__handle"
				/>
			)}
		</div>
	);
}

const nodeTypes = { automation: AutomationNode };

/* ---------------- graph ---------------- */

const N = (
	id: string,
	x: number,
	y: number,
	data: FlowNodeData,
): Node<FlowNodeData> => ({ id, type: "automation", position: { x, y }, data });

const INITIAL_NODES: Node<FlowNodeData>[] = [
	N("trigger", 400, 0, {
		label: "New issue in GitHub",
		sub: "trigger",
		icon: <b>G</b>,
		tone: "night",
	}),
	N("branch", 400, 110, {
		label: "Check issue label",
		sub: "branch-1",
		icon: <GitBranch size={18} />,
		tone: "night",
		branches: 3,
	}),
	N("jira2", 170, 300, {
		label: "Create docs ticket",
		sub: "jira-2",
		icon: <b>J</b>,
		tone: "cobalt",
	}),
	N("zendesk", 400, 300, {
		label: "Zendesk",
		sub: "trigger",
		icon: <b>Z</b>,
		tone: "cobalt",
	}),
	N("jira1", 630, 300, {
		label: "Create triage trigger",
		sub: "jira-1",
		icon: <b>J</b>,
		tone: "cobalt",
	}),
	N("slack", 400, 430, {
		label: "Message support",
		sub: "slack-1",
		icon: <MessageSquare size={18} />,
		tone: "rose",
	}),
	N("boolean", 400, 560, {
		label: "Boolean condition",
		sub: "boolean-1",
		icon: <Shuffle size={18} />,
		tone: "night",
	}),
];

const edgeStyle = { stroke: "var(--line-strong)", strokeWidth: 1.5 };
const addLabel = (
	<span className="mock-af__add">
		<Plus size={11} />
	</span>
);

const EDGES: Edge[] = [
	{
		id: "e1",
		source: "trigger",
		target: "branch",
		type: "smoothstep",
		style: edgeStyle,
		label: addLabel,
	},
	{
		id: "e2",
		source: "branch",
		sourceHandle: "q1",
		target: "jira2",
		type: "smoothstep",
		style: edgeStyle,
		label: "QUESTION",
		labelStyle: { fontSize: 9, letterSpacing: "0.12em", fill: "var(--ink-3)" },
		labelBgStyle: { fill: "transparent" },
	},
	{
		id: "e3",
		source: "branch",
		sourceHandle: "q2",
		target: "zendesk",
		type: "smoothstep",
		style: edgeStyle,
		label: "QUESTION",
		labelStyle: { fontSize: 9, letterSpacing: "0.12em", fill: "var(--ink-3)" },
		labelBgStyle: { fill: "transparent" },
	},
	{
		id: "e4",
		source: "branch",
		sourceHandle: "def",
		target: "jira1",
		type: "smoothstep",
		style: edgeStyle,
		label: "DEFAULT",
		labelStyle: { fontSize: 9, letterSpacing: "0.12em", fill: "var(--ink-3)" },
		labelBgStyle: { fill: "transparent" },
	},
	{
		id: "e5",
		source: "zendesk",
		target: "slack",
		type: "smoothstep",
		style: edgeStyle,
		label: addLabel,
	},
	{
		id: "e6",
		source: "slack",
		target: "boolean",
		type: "smoothstep",
		style: edgeStyle,
		label: addLabel,
	},
];

/* ---------------- right-panel configs ---------------- */

function NodeConfig({ nodeId }: { nodeId: string | null }) {
	if (!nodeId || nodeId === "trigger") {
		return (
			<>
				<Field label="Operation">
					<Select
						defaultValue="new-issue"
						options={[
							{ value: "new-issue", label: "New issue" },
							{ value: "new-pr", label: "New pull request" },
						]}
						aria-label="Operation"
					/>
				</Field>
				<Field label="Repository">
					<Input defaultValue="twodb/twodb-web" aria-label="Repository" />
				</Field>
				<Field label="Events">
					<Select
						defaultValue="opened"
						options={[
							{ value: "opened", label: "opened" },
							{ value: "labeled", label: "labeled" },
						]}
						aria-label="Events"
					/>
				</Field>
			</>
		);
	}
	if (nodeId === "zendesk" || nodeId === "jira1" || nodeId === "jira2") {
		return (
			<>
				<Field label="Operation">
					<Select
						defaultValue="create"
						options={[
							{ value: "create", label: "Create issue" },
							{ value: "update", label: "Update issue" },
						]}
						aria-label="Operation"
					/>
				</Field>
				<span className="tw-cue">Input</span>
				<Field label="Project">
					<Input defaultValue="Documentation issue" aria-label="Project" />
				</Field>
				<Field label="Summary">
					<Textarea
						defaultValue={
							"{{$.steps.trigger.issue.body}} by\n{{$.steps.trigger.issue.user.html_url}}"
						}
						aria-label="Summary"
					/>
				</Field>
				<Field label="Issue type">
					<Select
						defaultValue="task"
						options={[
							{ value: "task", label: "Task" },
							{ value: "bug", label: "Bug" },
						]}
						aria-label="Issue type"
					/>
				</Field>
				<Field label="Labels*">
					<Input defaultValue="documentation" aria-label="Label" />
				</Field>
				<Button variant="secondary" size="sm">
					Add label
				</Button>
			</>
		);
	}
	if (nodeId === "branch" || nodeId === "boolean") {
		return (
			<Field label="Condition">
				<Input
					defaultValue='{{label}} contains "docs"'
					aria-label="Condition"
				/>
			</Field>
		);
	}
	if (nodeId === "slack") {
		return (
			<>
				<Field label="Channel">
					<Select
						defaultValue="support"
						options={[
							{ value: "support", label: "#support" },
							{ value: "eng", label: "#eng" },
						]}
						aria-label="Channel"
					/>
				</Field>
				<Field label="Message">
					<Textarea
						defaultValue="New docs ticket: {{$.steps.jira-2.url}}"
						aria-label="Message"
					/>
				</Field>
			</>
		);
	}
	return null;
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mock-af__field">
			<span className="mock-af__field-label">{label}</span>
			{children}
		</div>
	);
}

/* ---------------- main ---------------- */

export function AutomationMock() {
	const [selected, setSelected] = useState<string | null>("zendesk");
	const [enabled, setEnabled] = useState(false);

	const onNodeClick = useCallback((_: unknown, node: Node<FlowNodeData>) => {
		setSelected(node.id);
	}, []);

	const selectedNode = INITIAL_NODES.find((n) => n.id === selected);

	return (
		<div className="mock-af">
			{/* toolbar */}
			<div className="mock-af__toolbar">
				<div style={{ width: 180 }}>
					<Select
						defaultValue="github"
						options={[
							{ value: "github", label: "Github" },
							{ value: "clinic", label: "Clinic ops" },
						]}
						aria-label="Recipe"
					/>
				</div>
				<IconButton label="Undo" icon={<Undo2 />} />
				<IconButton label="Redo" icon={<Redo2 />} />
				<div className="mock-af__toolbar-center">
					<Tabs
						aria-label="Mode"
						value="build"
						onValueChange={() => {}}
						items={[
							{ id: "build", label: "Build" },
							{ id: "debug", label: "Debug" },
						]}
					/>
				</div>
				<Button size="sm" variant="secondary">
					<Share2 size={14} aria-hidden="true" /> Share
				</Button>
				<Button size="sm" variant="secondary">
					<History size={14} aria-hidden="true" /> History
				</Button>
				<IconButton label="Close" icon={<X />} />
			</div>

			<div className="mock-af__body">
				{/* connector palette */}
				<aside className="mock-af__palette">
					<SearchInput
						placeholder="Search connectors…"
						aria-label="Search connectors"
					/>
					<div className="mock-af__palette-grid">
						{PALETTE.map((p) => (
							<button key={p.label} type="button" className="mock-af__pal">
								<span className="mock-af__pal-icon">{p.icon}</span>
								{p.label}
							</button>
						))}
					</div>
				</aside>

				{/* canvas */}
				<div className="mock-af__canvas">
					<ReactFlow
						nodes={INITIAL_NODES}
						edges={EDGES}
						nodeTypes={nodeTypes}
						fitView
						fitViewOptions={{ padding: 0.25 }}
						onNodeClick={onNodeClick}
						nodesConnectable={false}
						elementsSelectable
						panOnScroll
						zoomOnScroll={false}
						minZoom={0.5}
						maxZoom={1.4}
					>
						<Background gap={18} size={1} color="var(--line)" />
					</ReactFlow>
					<div className="mock-af__canvas-foot">
						<span className="mock-af__saved tw-tnum">✓ saved 3 min ago</span>
						<Button size="sm" onClick={() => setEnabled((e) => !e)}>
							{enabled ? "Disable" : "Enable"}
						</Button>
					</div>
				</div>

				{/* config panel */}
				<aside className="mock-af__config">
					<span className="mock-af__config-title">
						{selectedNode ? selectedNode.data.label : "Select a step"}
					</span>
					<span className="mock-af__config-sub tw-tnum">
						{selectedNode?.data.sub ?? ""}
					</span>
					<NodeConfig nodeId={selected} />
				</aside>
			</div>
		</div>
	);
}
