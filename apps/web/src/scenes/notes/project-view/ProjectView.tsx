import { useState } from "react";
import {
	BookOpen,
	Calendar,
	Check,
	ChevronDown,
	ChevronRight,
	Cloud,
	FileText,
	FolderKanban,
	GanttChart,
	Hash,
	HelpCircle,
	Home,
	Inbox,
	LayoutGrid,
	ListTodo,
	MessageCircle,
	MoreHorizontal,
	Paperclip,
	Play,
	Plus,
	Search,
	Settings,
	Star,
	Users,
	X,
} from "lucide-react";
import type { NotesViewProps } from "../types";
import { projectViewStyles } from "./ProjectView.style.jsx";

type Progress = "ongoing" | "completed" | "review" | "pending";
type Urgency = "critical" | "moderate" | "minor";

interface Assignee {
	initials: string;
	color: "default" | "orange" | "purple" | "teal" | "pink";
}

interface Task {
	id: string;
	taskId: string;
	title: string;
	comments?: number;
	progress: Progress;
	urgency: Urgency;
	assignees: Assignee[];
	done?: boolean;
	isParent?: boolean;
	isSubtask?: boolean;
}

interface Comment {
	author: string;
	initials: string;
	color: "default" | "orange" | "purple" | "teal" | "pink";
	text: string;
}

const TASKS: Task[] = [
	{
		id: "1",
		taskId: "TSK-8",
		title: "Improve Navigation & Menu Organization",
		progress: "ongoing",
		urgency: "moderate",
		assignees: [{ initials: "MA", color: "orange" }],
		isParent: true,
		done: true,
	},
	{
		id: "2",
		taskId: "TSK-20",
		title: "Enhance Search Functionality",
		comments: 6,
		progress: "completed",
		urgency: "critical",
		assignees: [
			{ initials: "PS", color: "purple" },
			{ initials: "DL", color: "teal" },
		],
		isSubtask: true,
	},
	{
		id: "3",
		taskId: "TSK-22",
		title: "Dark Mode Implementation",
		progress: "review",
		urgency: "minor",
		assignees: [
			{ initials: "RK", color: "pink" },
			{ initials: "MI", color: "default" },
		],
		isSubtask: true,
	},
	{
		id: "4",
		taskId: "TSK-6",
		title: "Optimize Mobile Responsiveness",
		progress: "ongoing",
		urgency: "moderate",
		assignees: [{ initials: "AV", color: "teal" }],
		isSubtask: true,
	},
	{
		id: "5",
		taskId: "TSK-6",
		title: "Redesign Checkout Flow",
		progress: "ongoing",
		urgency: "critical",
		assignees: [
			{ initials: "PS", color: "orange" },
			{ initials: "NK", color: "purple" },
		],
		isSubtask: true,
	},
	{
		id: "6",
		taskId: "TSK-10",
		title: "Speed Optimization for Home Page",
		progress: "ongoing",
		urgency: "critical",
		assignees: [
			{ initials: "DL", color: "default" },
			{ initials: "RK", color: "pink" },
		],
		isSubtask: true,
	},
	{
		id: "7",
		taskId: "TSK-40",
		title: "Reduce Load Time for Large Data Sets",
		progress: "pending",
		urgency: "minor",
		assignees: [{ initials: "MA", color: "orange" }],
		isSubtask: true,
	},
	{
		id: "8",
		taskId: "TSK-12",
		title: "Optimize Image Compression for Faster Loading",
		progress: "review",
		urgency: "moderate",
		assignees: [{ initials: "PS", color: "purple" }],
		isSubtask: true,
	},
	{
		id: "9",
		taskId: "TSK-18",
		title: "Introduce AI-powered Task Prioritization",
		comments: 4,
		progress: "completed",
		urgency: "moderate",
		assignees: [{ initials: "AV", color: "teal" }],
		isParent: true,
		done: true,
	},
	{
		id: "10",
		taskId: "TSK-12",
		title: "Multi-language Support Implementation",
		comments: 1,
		progress: "completed",
		urgency: "critical",
		assignees: [{ initials: "MI", color: "default" }],
		isParent: true,
		done: true,
	},
	{
		id: "11",
		taskId: "TSK-12",
		title: "Missing Tooltip on Product Images",
		progress: "completed",
		urgency: "moderate",
		assignees: [
			{ initials: "RK", color: "pink" },
			{ initials: "DL", color: "teal" },
			{ initials: "NK", color: "orange" },
		],
		isParent: true,
		done: true,
	},
	{
		id: "12",
		taskId: "TSK-22",
		title: "Integrate Third-party Calendar Sync",
		comments: 4,
		progress: "completed",
		urgency: "critical",
		assignees: [{ initials: "PS", color: "purple" }],
		isParent: true,
		done: true,
	},
	{
		id: "13",
		taskId: "TSK-14",
		title: "Enhance User Authentication with 2FA",
		progress: "pending",
		urgency: "minor",
		assignees: [{ initials: "MA", color: "orange" }],
		isSubtask: true,
	},
	{
		id: "14",
		taskId: "TSK-27",
		title: "GDPR Compliance Updates",
		progress: "pending",
		urgency: "minor",
		assignees: [
			{ initials: "AV", color: "teal" },
			{ initials: "NK", color: "purple" },
		],
		isSubtask: true,
	},
	{
		id: "15",
		taskId: "TSK-18",
		title: "Data Encryption for Sensitive Information",
		comments: 3,
		progress: "review",
		urgency: "minor",
		assignees: [{ initials: "RK", color: "pink" }],
		isSubtask: true,
	},
];

const COMMENTS: Comment[] = [
	{
		author: "David Lee",
		initials: "DL",
		color: "teal",
		text: "Have you considered AI-driven task prioritization?",
	},
	{
		author: "Priya Sharma",
		initials: "PS",
		color: "purple",
		text: "Don't forget to add accessibility features in the design phase.",
	},
];

const NAV_ITEMS = [
	{ id: "home", label: "Home", icon: Home },
	{ id: "inbox", label: "Inbox", icon: Inbox },
	{ id: "saved", label: "Saved items", icon: FolderKanban },
];

const WORKSPACE_ITEMS = [
	{ id: "tasks", label: "My tasks", icon: ListTodo },
	{ id: "projects", label: "Projects", icon: LayoutGrid },
	{ id: "calendar", label: "Calendar", icon: Calendar },
	{ id: "roadmaps", label: "Roadmaps", icon: GanttChart },
];

const CHANNELS = [
	{
		id: "engineering",
		label: "Engineering",
		icon: Hash,
		expanded: true,
		children: [
			{ id: "docs", label: "Docs", icon: BookOpen },
			{ id: "teams", label: "Teams", icon: Users },
			{ id: "initiatives", label: "Initiatives", icon: FileText },
			{ id: "sprint", label: "Active sprint", icon: Play },
		],
	},
	{ id: "design", label: "Design", icon: Hash },
	{ id: "marketing", label: "Marketing", icon: Hash },
];

function ProgressBadge({ status }: { status: Progress }) {
	const config = {
		ongoing: { label: "Ongoing", icon: "⚡" },
		completed: { label: "Completed", icon: "✓" },
		review: { label: "In review", icon: "👁" },
		pending: { label: "Pending", icon: "⏸" },
	};

	return (
		<>
			<style jsx>{projectViewStyles}</style>
			<span
				className={`mock-issues__progress mock-issues__progress--${status}`}
			>
				<span className="mock-issues__progress-icon">
					{config[status].icon}
				</span>
				{config[status].label}
			</span>
		</>
	);
}

function UrgencyBadge({ level }: { level: Urgency }) {
	const labels = { critical: "Critical", moderate: "Moderate", minor: "Minor" };
	return (
		<>
			<style jsx>{projectViewStyles}</style>
			<span className={`mock-issues__urgency mock-issues__urgency--${level}`}>
				<span className="mock-issues__urgency-bars">
					<span className="mock-issues__urgency-bar" />
					<span className="mock-issues__urgency-bar" />
					<span className="mock-issues__urgency-bar" />
				</span>
				{labels[level]}
			</span>
		</>
	);
}

function AssigneeStack({ assignees }: { assignees: Assignee[] }) {
	return (
		<>
			<style jsx>{projectViewStyles}</style>
			<div className="mock-issues__assignees">
				{assignees.map((a, i) => (
					<span
						key={i}
						className={`mock-issues__assignee mock-issues__assignee--${a.color}`}
					>
						{a.initials}
					</span>
				))}
			</div>
		</>
	);
}

function TaskRow({
	task,
	selected,
	onSelect,
	onToggle,
}: {
	task: Task;
	selected: boolean;
	onSelect: () => void;
	onToggle: () => void;
}) {
	const rowClasses = [
		"mock-issues__row",
		selected && "is-selected",
		task.done && "is-done",
		task.isSubtask && "is-subtask",
		task.isParent && "is-parent",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<style jsx>{projectViewStyles}</style>
			<div className={rowClasses} onClick={onSelect}>
				<div className="mock-issues__task-cell">
					<span
						className={`mock-issues__checkbox${task.isParent ? " is-parent" : ""}${task.done ? " is-checked" : ""}`}
						onClick={(e) => {
							e.stopPropagation();
							onToggle();
						}}
					>
						{(task.done || task.isParent) && <Check aria-hidden="true" />}
					</span>
					<span className="mock-issues__task-id">{task.taskId}</span>
					<span className="mock-issues__task-title">{task.title}</span>
					{task.comments && (
						<span className="mock-issues__task-comments">
							<MessageCircle aria-hidden="true" />
							{task.comments}
						</span>
					)}
				</div>
				<ProgressBadge status={task.progress} />
				<UrgencyBadge level={task.urgency} />
				<AssigneeStack assignees={task.assignees} />
			</div>
		</>
	);
}

export function ProjectView(_props: NotesViewProps) {
	const [tasks, setTasks] = useState(TASKS);
	const [selectedId, setSelectedId] = useState<string>("2");
	const [activeNav, setActiveNav] = useState("tasks");
	const [expandedChannels, setExpandedChannels] = useState<
		Record<string, boolean>
	>({ engineering: true });

	const taskCount = tasks.length;

	function toggleTask(id: string) {
		setTasks((ts) =>
			ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
		);
	}

	function toggleChannel(id: string) {
		setExpandedChannels((c) => ({ ...c, [id]: !c[id] }));
	}

	return (
		<div className="mock-issues">
			<style jsx>{projectViewStyles}</style>
			<aside className="mock-issues__sidebar">
				<div className="mock-issues__brand">
					<span className="mock-issues__logo">C</span>
					<div className="mock-issues__brand-info">
						<span className="mock-issues__brand-name">
							Atlas, Inc
							<ChevronDown aria-hidden="true" />
						</span>
						<span className="mock-issues__brand-status">
							<Cloud aria-hidden="true" />
							Syncing up
						</span>
					</div>
				</div>

				<nav className="mock-issues__nav">
					{NAV_ITEMS.map((item) => (
						<button
							key={item.id}
							className={`mock-issues__nav-item${activeNav === item.id ? " is-active" : ""}`}
							onClick={() => setActiveNav(item.id)}
						>
							<item.icon aria-hidden="true" />
							{item.label}
						</button>
					))}
				</nav>

				<div
					className="mock-issues__section-head"
					onClick={() => toggleChannel("workspace")}
				>
					Workspace
					<ChevronDown aria-hidden="true" />
				</div>
				<nav className="mock-issues__nav">
					{WORKSPACE_ITEMS.map((item) => (
						<button
							key={item.id}
							className={`mock-issues__nav-item${activeNav === item.id ? " is-active" : ""}`}
							onClick={() => setActiveNav(item.id)}
						>
							<item.icon aria-hidden="true" />
							{item.label}
						</button>
					))}
				</nav>

				<div className="mock-issues__section-head">
					Your channels
					<ChevronDown aria-hidden="true" />
				</div>
				<div className="mock-issues__nav">
					{CHANNELS.map((ch) => (
						<div key={ch.id}>
							<button
								className="mock-issues__channel"
								onClick={() => ch.children && toggleChannel(ch.id)}
							>
								<ch.icon aria-hidden="true" />
								{ch.label}
								{ch.children && (
									<span className="mock-issues__channel-expand">
										{expandedChannels[ch.id] ? (
											<ChevronDown aria-hidden="true" />
										) : (
											<ChevronRight aria-hidden="true" />
										)}
									</span>
								)}
							</button>
							{ch.children && expandedChannels[ch.id] && (
								<>
									{ch.children.map((sub) => (
										<button key={sub.id} className="mock-issues__subchannel">
											<sub.icon aria-hidden="true" />
											{sub.label}
										</button>
									))}
								</>
							)}
						</div>
					))}
				</div>

				<div className="mock-issues__trial">
					<p className="mock-issues__trial-text">
						There are <strong>6 days</strong> left in your trial. Upgrade for
						unlimited access.
					</p>
					<button className="mock-issues__trial-btn">Upgrade</button>
				</div>

				<div className="mock-issues__sidebar-foot">
					<button className="mock-issues__nav-item">
						<Settings aria-hidden="true" />
						Settings
					</button>
					<button className="mock-issues__nav-item">
						<HelpCircle aria-hidden="true" />
						Help & support
					</button>
				</div>
			</aside>

			<main className="mock-issues__main">
				<div className="mock-issues__topbar">
					<div className="mock-issues__topbar-tabs">
						<button className="mock-issues__topbar-tab">Overview</button>
						<button className="mock-issues__topbar-tab">
							<LayoutGrid aria-hidden="true" />
							Projects
						</button>
						<button className="mock-issues__topbar-tab is-active">
							<LayoutGrid aria-hidden="true" />
							Q3 Plan
						</button>
					</div>
					<div className="mock-issues__topbar-search">
						<Search aria-hidden="true" />
						<input placeholder="Find feature" />
					</div>
					<button className="mock-issues__new-btn">
						<Plus aria-hidden="true" />
						New feature
					</button>
				</div>

				<header className="mock-issues__header">
					<span className="mock-issues__header-icon" />
					<h2>Q3 Plan</h2>
					<span className="mock-issues__header-star">
						<Star aria-hidden="true" />
					</span>
					<div className="mock-issues__header-actions">
						<button className="mock-issues__header-btn">Share</button>
						<button className="mock-issues__header-btn">
							<MoreHorizontal aria-hidden="true" />
						</button>
					</div>
				</header>

				<div className="mock-issues__content-tabs">
					<button className="mock-issues__content-tab">Overview</button>
					<button className="mock-issues__content-tab is-active">
						Tasks
						<span className="mock-issues__tab-count">{taskCount}</span>
					</button>
				</div>

				<div className="mock-issues__table">
					<div className="mock-issues__table-head">
						<span>Feature</span>
						<span>Progress</span>
						<span>Urgency</span>
						<span>Assigned to</span>
					</div>
					<div className="mock-issues__table-body">
						{tasks.map((task) => (
							<TaskRow
								key={task.id}
								task={task}
								selected={selectedId === task.id}
								onSelect={() => setSelectedId(task.id)}
								onToggle={() => toggleTask(task.id)}
							/>
						))}
					</div>
				</div>
			</main>

			<aside className="mock-issues__panel">
				<div className="mock-issues__panel-head">
					<span className="mock-issues__panel-title">Properties</span>
					<button className="mock-issues__panel-close">
						<X aria-hidden="true" />
					</button>
				</div>

				<div className="mock-issues__props">
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Progress</span>
						<span className="mock-issues__prop-value">
							<span className="mock-issues__prop-icon mock-issues__prop-icon--blue">
								⚡
							</span>
							Ongoing
						</span>
					</div>
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Category</span>
						<span className="mock-issues__prop-value">
							<span className="mock-issues__prop-icon mock-issues__prop-icon--file">
								<FileText aria-hidden="true" />
							</span>
							API Documentation
						</span>
					</div>
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Task owner</span>
						<span className="mock-issues__prop-value">
							<span className="mock-issues__assignee mock-issues__assignee--purple">
								PS
							</span>
							Priya
						</span>
					</div>
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Urgency</span>
						<span className="mock-issues__prop-value">
							<span className="mock-issues__prop-icon mock-issues__prop-icon--red">
								<span
									style={{
										display: "flex",
										gap: 1,
									}}
								>
									<span
										style={{
											width: 2,
											height: 10,
											background: "currentColor",
											borderRadius: 1,
										}}
									/>
									<span
										style={{
											width: 2,
											height: 10,
											background: "currentColor",
											borderRadius: 1,
										}}
									/>
									<span
										style={{
											width: 2,
											height: 10,
											background: "currentColor",
											borderRadius: 1,
										}}
									/>
								</span>
							</span>
							Critical
						</span>
					</div>
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Department</span>
						<span className="mock-issues__prop-value">
							<span className="mock-issues__prop-icon mock-issues__prop-icon--purple">
								<LayoutGrid aria-hidden="true" />
							</span>
							Engineering
						</span>
					</div>
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Date added</span>
						<span className="mock-issues__prop-value">March 15, 2025</span>
					</div>
					<div className="mock-issues__prop">
						<span className="mock-issues__prop-label">Deadline</span>
						<span className="mock-issues__prop-value">May 15, 2025</span>
					</div>
				</div>

				<div className="mock-issues__panel-section">
					<div className="mock-issues__panel-section-title">Tags</div>
					<div className="mock-issues__tags">
						<span className="mock-issues__tag mock-issues__tag--blue">
							Features
						</span>
						<span className="mock-issues__tag mock-issues__tag--red">Bugs</span>
						<span className="mock-issues__tag mock-issues__tag--green">
							Improvements
						</span>
					</div>
				</div>

				<div className="mock-issues__panel-section">
					<div className="mock-issues__panel-section-title">Attachments</div>
					<div className="mock-issues__attachments">
						<div className="mock-issues__attachment">
							<span className="mock-issues__attachment-icon">
								<Paperclip aria-hidden="true" />
							</span>
							<div className="mock-issues__attachment-info">
								<div className="mock-issues__attachment-name">
									Client_Proposal.xls
								</div>
								<div className="mock-issues__attachment-meta">Today · 4 MB</div>
							</div>
						</div>
						<div className="mock-issues__attachment">
							<span className="mock-issues__attachment-icon">
								<FileText aria-hidden="true" />
							</span>
							<div className="mock-issues__attachment-info">
								<div className="mock-issues__attachment-name">PRD.docx</div>
								<div className="mock-issues__attachment-meta">
									Yesterday · Google Docs
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="mock-issues__panel-section">
					<div className="mock-issues__panel-section-title">Discussion</div>
					<div className="mock-issues__discussion">
						{COMMENTS.map((c, i) => (
							<div key={i} className="mock-issues__comment">
								<span
									className={`mock-issues__comment-avatar mock-issues__assignee--${c.color}`}
								>
									{c.initials}
								</span>
								<div className="mock-issues__comment-content">
									<div className="mock-issues__comment-author">{c.author}</div>
									<p className="mock-issues__comment-text">{c.text}</p>
								</div>
							</div>
						))}
					</div>
					<div className="mock-issues__comment-input">Write a comment</div>
				</div>
			</aside>
		</div>
	);
}
