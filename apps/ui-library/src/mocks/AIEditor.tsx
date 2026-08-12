import { useState } from "react";
import {
	BookOpen,
	ChevronUp,
	Circle,
	Code2,
	FileText,
	Filter,
	Flag,
	Folder,
	GitBranch,
	GitCommit,
	History,
	Layers,
	Link,
	Loader2,
	MessageSquare,
	RefreshCw,
	Settings,
	Sparkles,
	Tag,
	User,
	Wand2,
	Check,
} from "lucide-react";
import "./AIEditor.css";

/* ---------- Types ---------- */

type IssueStatus = "open" | "progress" | "done";
type IssueType = "feature" | "bug" | null;

interface Issue {
	id: string;
	number: number;
	title: string;
	status: IssueStatus;
	type: IssueType;
	section: "backlog" | "planning" | "done";
}

interface GitFile {
	name: string;
	additions: number;
	deletions: number;
}

/* ---------- Data ---------- */

const ISSUES: Issue[] = [
	{
		id: "1",
		number: 742,
		title: "Add dark mode",
		status: "open",
		type: null,
		section: "backlog",
	},
	{
		id: "2",
		number: 743,
		title: "Add user authentication",
		status: "open",
		type: "feature",
		section: "backlog",
	},
	{
		id: "3",
		number: 737,
		title: "Fix server crash on corrupt...",
		status: "progress",
		type: "bug",
		section: "planning",
	},
	{
		id: "4",
		number: 739,
		title: "Set up CLI pipeline",
		status: "done",
		type: null,
		section: "done",
	},
	{
		id: "5",
		number: 734,
		title: "Set up git and repo",
		status: "done",
		type: "feature",
		section: "done",
	},
];

const GIT_FILES: GitFile[] = [
	{ name: "server.ts", additions: 12, deletions: 2 },
	{ name: "db.ts", additions: 8, deletions: 1 },
];

const WORKFLOW_ITEMS = [
	{ id: "backlog", label: "Backlog", icon: Circle },
	{ id: "labels", label: "Labels", icon: Tag },
	{ id: "deps", label: "Dependencies", icon: Link },
	{ id: "assignee", label: "Ava Elizabeth", icon: User },
];

const SESSION_ITEMS = [
	{ id: "api", label: "api", icon: Folder },
	{ id: "worktree", label: "No worktree", icon: GitBranch },
	{ id: "flag", label: "1 flag", icon: Flag },
];

/* ---------- Components ---------- */

function IconRail() {
	const [active, setActive] = useState("issues");

	const items = [
		{ id: "files", icon: FileText },
		{ id: "issues", icon: MessageSquare },
		{ id: "ai", icon: Wand2 },
		{ id: "settings", icon: Settings },
	];

	const bottomItems = [
		{ id: "git", icon: GitBranch },
		{ id: "layers", icon: Layers },
	];

	return (
		<nav className="mock-ai-editor__rail">
			{items.map((item) => (
				<button
					key={item.id}
					className={`mock-ai-editor__rail-item${active === item.id ? " is-active" : ""}`}
					onClick={() => setActive(item.id)}
					aria-label={item.id}
				>
					<item.icon aria-hidden="true" />
				</button>
			))}
			<div className="mock-ai-editor__rail-spacer" />
			{bottomItems.map((item) => (
				<button
					key={item.id}
					className="mock-ai-editor__rail-item"
					aria-label={item.id}
				>
					<item.icon aria-hidden="true" />
				</button>
			))}
		</nav>
	);
}

function IssueStatus({ status }: { status: IssueStatus }) {
	if (status === "done") {
		return (
			<span className="mock-ai-editor__issue-status mock-ai-editor__issue-status--done">
				<Check aria-hidden="true" />
			</span>
		);
	}
	if (status === "progress") {
		return (
			<span className="mock-ai-editor__issue-status mock-ai-editor__issue-status--progress">
				<Loader2 aria-hidden="true" />
			</span>
		);
	}
	return (
		<span className="mock-ai-editor__issue-status">
			<Circle aria-hidden="true" />
		</span>
	);
}

function IssueBadge({ type }: { type: IssueType }) {
	if (!type) return null;
	return (
		<span
			className={`mock-ai-editor__issue-badge mock-ai-editor__issue-badge--${type}`}
		>
			{type.charAt(0).toUpperCase() + type.slice(1)}
		</span>
	);
}

function IssueItem({
	issue,
	selected,
	onSelect,
}: {
	issue: Issue;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<div
			className={`mock-ai-editor__issue${selected ? " is-selected" : ""}`}
			onClick={onSelect}
		>
			<span className="mock-ai-editor__issue-id">#{issue.number}</span>
			<IssueStatus status={issue.status} />
			<span className="mock-ai-editor__issue-title">{issue.title}</span>
			<IssueBadge type={issue.type} />
			{issue.status !== "done" && (
				<span className="mock-ai-editor__issue-circle" />
			)}
		</div>
	);
}

function Sidebar({
	issues,
	selectedId,
	onSelect,
}: {
	issues: Issue[];
	selectedId: string;
	onSelect: (id: string) => void;
}) {
	const sections = [
		{ id: "backlog", label: "Backlog" },
		{ id: "planning", label: "Planning & Implementation" },
		{ id: "done", label: "Done" },
	];

	return (
		<aside className="mock-ai-editor__sidebar">
			{/* Header */}
			<div className="mock-ai-editor__sidebar-header">
				<span className="mock-ai-editor__project-name">my-project</span>
				<div className="mock-ai-editor__header-actions">
					<button className="mock-ai-editor__header-btn" aria-label="Git">
						<GitBranch aria-hidden="true" />
					</button>
					<button className="mock-ai-editor__header-btn" aria-label="Folder">
						<Folder aria-hidden="true" />
					</button>
					<button className="mock-ai-editor__header-btn" aria-label="GitHub">
						<Code2 aria-hidden="true" />
					</button>
					<button className="mock-ai-editor__header-btn" aria-label="Tags">
						<Tag aria-hidden="true" />
					</button>
					<button className="mock-ai-editor__header-btn" aria-label="Filter">
						<Filter aria-hidden="true" />
					</button>
				</div>
			</div>

			{/* Sections */}
			<div className="mock-ai-editor__sections">
				{sections.map((section) => {
					const sectionIssues = issues.filter((i) => i.section === section.id);
					if (sectionIssues.length === 0) return null;
					return (
						<div key={section.id} className="mock-ai-editor__section">
							<div className="mock-ai-editor__section-header">
								{section.label}
								<span className="mock-ai-editor__section-count">
									{sectionIssues.length}
								</span>
							</div>
							{sectionIssues.map((issue) => (
								<IssueItem
									key={issue.id}
									issue={issue}
									selected={selectedId === issue.id}
									onSelect={() => onSelect(issue.id)}
								/>
							))}
						</div>
					);
				})}
			</div>
		</aside>
	);
}

function MainContent({ issue }: { issue: Issue | undefined }) {
	const tabs = [
		{ id: "issue", label: "Issue", icon: BookOpen },
		{ id: "session", label: "Session", icon: MessageSquare, active: true },
		{ id: "history", label: "History", icon: History },
		{ id: "changes", label: "Changes", icon: GitCommit },
	];

	return (
		<main className="mock-ai-editor__main">
			{/* Tabs */}
			<div className="mock-ai-editor__tabs">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						className={`mock-ai-editor__tab${tab.active ? " is-active" : ""}`}
					>
						<tab.icon aria-hidden="true" />
						{tab.label}
					</button>
				))}
			</div>

			{/* Header */}
			<div className="mock-ai-editor__content-header">
				<h1 className="mock-ai-editor__content-title">
					{issue?.title ?? "Select an issue"}
				</h1>
			</div>

			{/* Empty state */}
			<div className="mock-ai-editor__empty">
				<div className="mock-ai-editor__empty-icon">
					<svg viewBox="0 0 48 48" fill="none">
						<rect
							x="12"
							y="24"
							width="24"
							height="24"
							rx="2"
							transform="rotate(-45 12 24)"
							stroke="currentColor"
							strokeWidth="2"
						/>
						<rect
							x="12"
							y="24"
							width="16"
							height="16"
							rx="1"
							transform="rotate(-45 12 24)"
							fill="currentColor"
							fillOpacity="0.2"
						/>
					</svg>
				</div>
				<h2 className="mock-ai-editor__empty-title">Ready to get started?</h2>
				<p className="mock-ai-editor__empty-subtitle">
					#{issue?.number} {issue?.title}
				</p>
				<button className="mock-ai-editor__start-btn">
					<Sparkles aria-hidden="true" />
					Start in plan mode
				</button>
			</div>
		</main>
	);
}

function PanelSection({
	title,
	children,
	defaultOpen = true,
}: {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="mock-ai-editor__panel-section">
			<div
				className="mock-ai-editor__panel-header"
				onClick={() => setOpen(!open)}
			>
				<span className="mock-ai-editor__panel-title">{title}</span>
				<span
					className="mock-ai-editor__panel-toggle"
					style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
				>
					<ChevronUp aria-hidden="true" />
				</span>
			</div>
			{open && <div className="mock-ai-editor__panel-items">{children}</div>}
		</div>
	);
}

function RightPanel() {
	return (
		<aside className="mock-ai-editor__panel">
			{/* Workflow */}
			<PanelSection title="Workflow">
				{WORKFLOW_ITEMS.map((item) => (
					<div key={item.id} className="mock-ai-editor__panel-item">
						<item.icon aria-hidden="true" />
						{item.label}
					</div>
				))}
			</PanelSection>

			{/* Session */}
			<PanelSection title="Session">
				{SESSION_ITEMS.map((item) => (
					<div key={item.id} className="mock-ai-editor__panel-item">
						<item.icon aria-hidden="true" />
						{item.label}
					</div>
				))}
			</PanelSection>

			{/* Git Summary */}
			<PanelSection title={`Git Summary (${GIT_FILES.length})`}>
				<div className="mock-ai-editor__branch-row">
					<GitBranch aria-hidden="true" />
					<span className="mock-ai-editor__branch-name">main</span>
					<button
						className="mock-ai-editor__branch-refresh"
						aria-label="Refresh"
					>
						<RefreshCw aria-hidden="true" />
					</button>
				</div>
				{GIT_FILES.map((file) => (
					<div key={file.name} className="mock-ai-editor__git-file">
						<span className="mock-ai-editor__git-file-icon">M</span>
						<span className="mock-ai-editor__git-file-name">{file.name}</span>
						<span className="mock-ai-editor__git-file-stats">
							<span className="mock-ai-editor__git-add">+{file.additions}</span>
							<span className="mock-ai-editor__git-del">-{file.deletions}</span>
						</span>
					</div>
				))}
			</PanelSection>

			{/* Statistics */}
			<PanelSection title="Statistics">
				<div className="mock-ai-editor__stat-row">
					<span className="mock-ai-editor__stat-label">Total tokens</span>
					<span className="mock-ai-editor__stat-value">8.2k</span>
				</div>
			</PanelSection>
		</aside>
	);
}

/* ---------- Main Component ---------- */

export function AIEditorMock() {
	const [selectedId, setSelectedId] = useState("2");
	const selectedIssue = ISSUES.find((i) => i.id === selectedId);

	return (
		<div className="mock-ai-editor">
			<IconRail />
			<Sidebar
				issues={ISSUES}
				selectedId={selectedId}
				onSelect={setSelectedId}
			/>
			<MainContent issue={selectedIssue} />
			<RightPanel />
		</div>
	);
}
