import { useRef, useState, type DragEvent } from "react";
import {
	Avatar,
	Badge,
	Button,
	Checkbox,
	IconButton,
	Menu,
	MenuDivider,
	MenuItem,
	NavRail,
} from "@twodb/ui";
import {
	Bell,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronRight,
	FolderKanban,
	Home,
	Inbox,
	ListChecks,
	MoreHorizontal,
	Paperclip,
	Plus,
	SlidersHorizontal,
	Users,
	Zap,
} from "lucide-react";
import "./issue-kanban";

/* ---------- Types ---------- */

type Priority = "high" | "medium" | "low";
type Category = "admin" | "design" | "devops" | "research";
type ColumnId = "todo" | "week" | "progress" | "done";
type DoneGroup = "Today" | "Yesterday";

interface Subtask {
	id: string;
	label: string;
	done: boolean;
}

interface Issue {
	id: string;
	title: string;
	priority: Priority;
	category: Category;
	assignees: string[];
	attachments?: number;
	subtasks?: Subtask[];
	expanded?: boolean;
	/** Done column only — which day group the card sits under. */
	group?: DoneGroup;
}

/* ---------- Data ---------- */

const COLUMNS: { id: ColumnId; label: string }[] = [
	{ id: "todo", label: "To Do" },
	{ id: "week", label: "This Week" },
	{ id: "progress", label: "In Progress" },
	{ id: "done", label: "Done" },
];

const PRIORITY_LABEL: Record<Priority, string> = {
	high: "High",
	medium: "Medium",
	low: "Low",
};

const PRIORITY_TONE: Record<Priority, "danger" | "warning" | "go"> = {
	high: "danger",
	medium: "warning",
	low: "go",
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const CATEGORY_LABEL: Record<Category, string> = {
	admin: "Administration",
	design: "Design",
	devops: "Dev Ops",
	research: "Research",
};

const TEAM = ["Asha Verma", "Ravi Kumar", "Meera Iyer", "Dev Patel"];

const INITIAL: Record<ColumnId, Issue[]> = {
	todo: [
		{
			id: "t1",
			title: "Pay employee salaries",
			priority: "medium",
			category: "admin",
			assignees: ["Asha Verma", "Ravi Kumar"],
			attachments: 2,
		},
		{
			id: "t2",
			title: "Review and update sales pitch for new product",
			priority: "medium",
			category: "design",
			assignees: ["Meera Iyer", "Dev Patel"],
			attachments: 1,
			subtasks: [
				{ id: "t2a", label: "Rewrite the opening slide", done: true },
				{ id: "t2b", label: "Add pricing comparison", done: false },
			],
		},
		{
			id: "t3",
			title: "Design marketing campaign",
			priority: "low",
			category: "design",
			assignees: ["Priya Sharma"],
		},
	],
	week: [
		{
			id: "w1",
			title: "Prepare and send out client invoices",
			priority: "medium",
			category: "admin",
			assignees: ["Asha Verma", "Ravi Kumar"],
			attachments: 3,
		},
		{
			id: "w2",
			title: "Research market trends",
			priority: "low",
			category: "research",
			assignees: ["Nikhil Kapoor"],
			attachments: 1,
		},
		{
			id: "w3",
			title: "Add AI chatbot for support",
			priority: "high",
			category: "devops",
			assignees: ["Dev Patel", "Nikhil Kapoor"],
			subtasks: [
				{ id: "w3a", label: "Pick the model provider", done: true },
				{ id: "w3b", label: "Draft escalation rules", done: false },
				{ id: "w3c", label: "Wire the handoff inbox", done: false },
			],
		},
	],
	progress: [
		{
			id: "p1",
			title: "Organize team-building event",
			priority: "medium",
			category: "admin",
			assignees: ["Meera Iyer", "Priya Sharma"],
			attachments: 1,
		},
		{
			id: "p2",
			title: "Plan exhibition for upcoming trade show",
			priority: "low",
			category: "design",
			assignees: ["Ravi Kumar"],
			attachments: 2,
			expanded: true,
			subtasks: [
				{ id: "p2a", label: "Decide overall budget", done: true },
				{ id: "p2b", label: "Agree on booth size and location", done: true },
				{
					id: "p2c",
					label: "Order brochures, flyers, and popups",
					done: false,
				},
			],
		},
	],
	done: [
		{
			id: "d1",
			title: "Evaluate sales tools",
			priority: "medium",
			category: "admin",
			assignees: ["Asha Verma", "Meera Iyer"],
			group: "Today",
		},
		{
			id: "d2",
			title: "Prototype voice-activated assistant",
			priority: "low",
			category: "design",
			assignees: ["Dev Patel"],
			group: "Today",
		},
		{
			id: "d3",
			title: "Company website relaunch",
			priority: "medium",
			category: "devops",
			assignees: ["Nikhil Kapoor", "Priya Sharma"],
			attachments: 4,
			group: "Yesterday",
		},
		{
			id: "d4",
			title: "Migrate analytics to the new warehouse",
			priority: "high",
			category: "devops",
			assignees: ["Dev Patel"],
			group: "Yesterday",
		},
	],
};

const DONE_GROUPS: DoneGroup[] = ["Today", "Yesterday"];

/* ---------- Helpers ---------- */

/** The card id whose midpoint is below the pointer — i.e. insert before it. */
function insertionBefore(container: HTMLElement, y: number): string | null {
	const cards = [
		...container.querySelectorAll<HTMLElement>(
			".mock-kanban__card:not(.is-dragging)",
		),
	];
	let closest: { offset: number; id: string | null } = {
		offset: Number.NEGATIVE_INFINITY,
		id: null,
	};
	for (const card of cards) {
		const box = card.getBoundingClientRect();
		const offset = y - box.top - box.height / 2;
		if (offset < 0 && offset > closest.offset) {
			closest = { offset, id: card.dataset.id ?? null };
		}
	}
	return closest.id;
}

/* ---------- Card ---------- */

function IssueCard({
	issue,
	column,
	selected,
	onSelect,
	onToggleSubtask,
	onDragStart,
	onDragEnd,
}: {
	issue: Issue;
	column: ColumnId;
	selected: boolean;
	onSelect: () => void;
	onToggleSubtask: (subId: string) => void;
	onDragStart: (e: DragEvent) => void;
	onDragEnd: () => void;
}) {
	const subs = issue.subtasks ?? [];
	const subsDone = subs.filter((s) => s.done).length;

	return (
		<article
			data-id={issue.id}
			className={[
				"mock-kanban__card",
				selected ? "is-selected" : "",
				column === "done" ? "is-done" : "",
			]
				.filter(Boolean)
				.join(" ")}
			draggable
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onClick={onSelect}
		>
			<p className="mock-kanban__card-title">{issue.title}</p>

			<div className="mock-kanban__pills">
				<Badge size="sm" tone={PRIORITY_TONE[issue.priority]}>
					{PRIORITY_LABEL[issue.priority]}
				</Badge>
				<span
					className={`mock-kanban__cat mock-kanban__cat--${issue.category}`}
				>
					{CATEGORY_LABEL[issue.category]}
				</span>
			</div>

			{issue.expanded && subs.length > 0 && (
				<div
					className="mock-kanban__subtasks"
					onClick={(e) => e.stopPropagation()}
				>
					{subs.map((st) => (
						<div
							key={st.id}
							className={`mock-kanban__subtask${st.done ? " is-done" : ""}`}
						>
							<Checkbox
								label={st.label}
								checked={st.done}
								onChange={() => onToggleSubtask(st.id)}
							/>
						</div>
					))}
				</div>
			)}

			<footer className="mock-kanban__card-foot">
				<span className="mock-kanban__stack">
					{issue.assignees.map((name) => (
						<Avatar key={name} name={name} size="sm" />
					))}
				</span>
				<span className="mock-kanban__meta">
					{issue.attachments ? (
						<span className="mock-kanban__meta-item">
							<Paperclip aria-hidden="true" />
							{issue.attachments}
						</span>
					) : null}
					{subs.length > 0 ? (
						<span className="mock-kanban__meta-item">
							<ListChecks aria-hidden="true" />
							{subsDone}/{subs.length}
						</span>
					) : null}
				</span>
			</footer>
		</article>
	);
}

/* ---------- Main Component ---------- */

export function IssueKanbanMock() {
	const [issues, setIssues] = useState(INITIAL);
	const [rail, setRail] = useState("projects");
	const [selectedId, setSelectedId] = useState<string | null>("p2");
	const [priority, setPriority] = useState<Priority | "all">("all");
	const [composer, setComposer] = useState<{
		col: ColumnId;
		text: string;
	} | null>(null);
	const [dragId, setDragId] = useState<string | null>(null);
	const [drop, setDrop] = useState<{
		col: ColumnId;
		beforeId: string | null;
	} | null>(null);
	const nextId = useRef(1);

	const visible = (col: ColumnId) =>
		priority === "all"
			? issues[col]
			: issues[col].filter((i) => i.priority === priority);

	const total = COLUMNS.reduce((n, c) => n + issues[c.id].length, 0);
	const doneCount = issues.done.length;

	/* --- card mutations --- */

	function toggleSubtask(issueId: string, subId: string) {
		setIssues((prev) => {
			const next = { ...prev };
			for (const col of COLUMNS) {
				next[col.id] = next[col.id].map((issue) =>
					issue.id === issueId
						? {
								...issue,
								subtasks: issue.subtasks?.map((s) =>
									s.id === subId ? { ...s, done: !s.done } : s,
								),
							}
						: issue,
				);
			}
			return next;
		});
	}

	function moveIssue(id: string, to: ColumnId, beforeId: string | null) {
		setIssues((prev) => {
			const from = COLUMNS.find((c) => prev[c.id].some((i) => i.id === id));
			if (!from) return prev;
			const issue = prev[from.id].find((i) => i.id === id);
			if (!issue) return prev;

			const rest = {
				...prev,
				[from.id]: prev[from.id].filter((i) => i.id !== id),
			};
			const target = [...rest[to]];

			let moved = issue;
			if (to === "done") {
				const neighbor = beforeId
					? target.find((i) => i.id === beforeId)
					: target[target.length - 1];
				moved = { ...issue, group: neighbor?.group ?? "Today" };
			} else if (issue.group) {
				const { group: _group, ...ungrouped } = issue;
				moved = ungrouped;
			}

			const at = beforeId ? target.findIndex((i) => i.id === beforeId) : -1;
			if (at === -1) target.push(moved);
			else target.splice(at, 0, moved);

			return { ...rest, [to]: target };
		});
	}

	function sortColumn(col: ColumnId) {
		setIssues((prev) => ({
			...prev,
			[col]: [...prev[col]].sort(
				(a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
			),
		}));
	}

	function clearColumn(col: ColumnId) {
		setIssues((prev) => ({ ...prev, [col]: [] }));
	}

	function commitComposer() {
		setComposer((current) => {
			const text = current?.text.trim();
			if (current && text) {
				const issue: Issue = {
					id: `new-${nextId.current++}`,
					title: text,
					priority: "medium",
					category: "admin",
					assignees: ["Asha Verma"],
					group: current.col === "done" ? "Today" : undefined,
				};
				setIssues((prev) => ({
					...prev,
					[current.col]: [...prev[current.col], issue],
				}));
			}
			return null;
		});
	}

	/* --- drag & drop --- */

	function handleDragStart(e: DragEvent, id: string) {
		e.dataTransfer.setData("text/plain", id);
		e.dataTransfer.effectAllowed = "move";
		setDragId(id);
	}

	function handleDragOver(e: DragEvent, col: ColumnId) {
		if (!dragId) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		const beforeId = insertionBefore(e.currentTarget as HTMLElement, e.clientY);
		setDrop((d) =>
			d?.col === col && d.beforeId === beforeId ? d : { col, beforeId },
		);
	}

	function handleDragLeave(e: DragEvent, col: ColumnId) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
			setDrop((d) => (d?.col === col ? null : d));
		}
	}

	function handleDrop(e: DragEvent, col: ColumnId) {
		e.preventDefault();
		const id = e.dataTransfer.getData("text/plain") || dragId;
		if (id) moveIssue(id, col, drop?.col === col ? drop.beforeId : null);
		setDragId(null);
		setDrop(null);
	}

	function endDrag() {
		setDragId(null);
		setDrop(null);
	}

	/* --- rendering --- */

	function renderCard(col: ColumnId, issue: Issue) {
		return (
			<div key={issue.id} className="mock-kanban__cell">
				{drop?.col === col && drop.beforeId === issue.id && (
					<div className="mock-kanban__drop-line" />
				)}
				<div
					className={
						dragId === issue.id
							? "mock-kanban__tilt is-dragging"
							: "mock-kanban__tilt"
					}
				>
					<IssueCard
						issue={issue}
						column={col}
						selected={selectedId === issue.id}
						onSelect={() =>
							setSelectedId((s) => (s === issue.id ? null : issue.id))
						}
						onToggleSubtask={(subId) => toggleSubtask(issue.id, subId)}
						onDragStart={(e) => handleDragStart(e, issue.id)}
						onDragEnd={endDrag}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="mock-kanban">
			{/* ===== APP RAIL ===== */}
			<NavRail
				aria-label="Project navigation"
				value={rail}
				onValueChange={setRail}
				header={
					<span className="mock-kanban__brand" aria-hidden="true">
						<Zap />
					</span>
				}
				items={[
					{ id: "home", icon: <Home />, label: "Home" },
					{ id: "inbox", icon: <Inbox />, label: "Inbox" },
					{ id: "calendar", icon: <CalendarDays />, label: "Calendar" },
					{ id: "projects", icon: <FolderKanban />, label: "Projects" },
					{ id: "team", icon: <Users />, label: "Team" },
				]}
				footer={
					<IconButton
						label="New issue"
						icon={<Plus />}
						variant="secondary"
						onClick={() => setComposer({ col: "todo", text: "" })}
					/>
				}
			/>

			{/* ===== BOARD ===== */}
			<div className="mock-kanban__main">
				<header className="mock-kanban__head">
					<div className="mock-kanban__head-text">
						<nav className="mock-kanban__crumbs" aria-label="Breadcrumb">
							<span>Your Projects</span>
							<ChevronRight aria-hidden="true" />
							<span>July</span>
							<ChevronRight aria-hidden="true" />
							<span className="mock-kanban__crumbs-here">Issues</span>
						</nav>
						<h1>Issues</h1>
					</div>
					<span className="mock-kanban__stack mock-kanban__stack--head">
						{TEAM.map((name) => (
							<Avatar key={name} name={name} />
						))}
					</span>
				</header>

				<div className="mock-kanban__toolbar">
					<Menu
						trigger={
							<Button variant="secondary" size="sm">
								<SlidersHorizontal aria-hidden="true" />
								Filter
								<ChevronDown aria-hidden="true" />
							</Button>
						}
					>
						{(["all", "high", "medium", "low"] as const).map((p) => (
							<MenuItem
								key={p}
								icon={
									priority === p ? (
										<Check aria-hidden="true" />
									) : (
										<span
											className="mock-kanban__menu-tick"
											aria-hidden="true"
										/>
									)
								}
								onClick={() => setPriority(p)}
							>
								{p === "all"
									? "All priorities"
									: `Priority: ${PRIORITY_LABEL[p]}`}
							</MenuItem>
						))}
					</Menu>
					{priority !== "all" && (
						<Badge tone="go">{PRIORITY_LABEL[priority]} only</Badge>
					)}
					<span className="mock-kanban__summary">
						{total} issues · {doneCount} done
					</span>
				</div>

				<div className="mock-kanban__board">
					{COLUMNS.map((col) => {
						const list = visible(col.id);
						const groups =
							col.id === "done"
								? DONE_GROUPS.map((g) => ({
										name: g,
										items: list.filter((i) => i.group === g),
									})).filter((g) => g.items.length > 0)
								: null;

						return (
							<section
								key={col.id}
								className={`mock-kanban__col${
									drop?.col === col.id ? " is-drop" : ""
								}`}
								aria-label={col.label}
							>
								<header className="mock-kanban__col-head">
									<span
										className={`mock-kanban__dot mock-kanban__dot--${col.id}`}
										aria-hidden="true"
									/>
									<span className="mock-kanban__col-title">{col.label}</span>
									<span className="mock-kanban__col-count">
										{priority === "all"
											? issues[col.id].length
											: `${list.length}/${issues[col.id].length}`}
									</span>
									<Menu
										placement="bottom-end"
										trigger={
											<IconButton
												label={`${col.label} actions`}
												icon={<MoreHorizontal />}
												size="sm"
											/>
										}
									>
										<MenuItem
											icon={<Plus />}
											onClick={() => setComposer({ col: col.id, text: "" })}
										>
											Add issue
										</MenuItem>
										<MenuItem
											icon={<ListChecks />}
											onClick={() => sortColumn(col.id)}
										>
											Sort by priority
										</MenuItem>
										<MenuDivider />
										<MenuItem
											icon={<Bell />}
											onClick={() => clearColumn(col.id)}
											danger
										>
											Clear column
										</MenuItem>
									</Menu>
								</header>

								<div
									className="mock-kanban__col-body"
									onDragOver={(e) => handleDragOver(e, col.id)}
									onDragLeave={(e) => handleDragLeave(e, col.id)}
									onDrop={(e) => handleDrop(e, col.id)}
								>
									{composer?.col === col.id ? (
										<div className="mock-kanban__add mock-kanban__add--editing">
											<input
												// biome-ignore lint/a11y/noAutofocus: inline composer in a mock
												autoFocus
												value={composer.text}
												placeholder="Name the issue…"
												aria-label="New issue title"
												onChange={(e) =>
													setComposer({ col: col.id, text: e.target.value })
												}
												onKeyDown={(e) => {
													if (e.key === "Enter") commitComposer();
													if (e.key === "Escape") setComposer(null);
												}}
												onBlur={commitComposer}
											/>
										</div>
									) : (
										<button
											type="button"
											className="mock-kanban__add"
											onClick={() => setComposer({ col: col.id, text: "" })}
											aria-label={`Add issue to ${col.label}`}
										>
											<Plus aria-hidden="true" />
										</button>
									)}

									{groups
										? groups.map((g) => (
												<div key={g.name} className="mock-kanban__group-wrap">
													<div className="mock-kanban__group">
														{g.name}
														<span className="mock-kanban__group-count">
															{g.items.length}
														</span>
													</div>
													{g.items.map((issue) => renderCard(col.id, issue))}
												</div>
											))
										: list.map((issue) => renderCard(col.id, issue))}

									{drop?.col === col.id && drop.beforeId === null && (
										<div className="mock-kanban__drop-line" />
									)}
								</div>
							</section>
						);
					})}
				</div>
			</div>
		</div>
	);
}
