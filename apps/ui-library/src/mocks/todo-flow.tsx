import { useMemo, useState } from "react";
import { Avatar, Badge, IconButton, Input } from "@twodb/ui";
import {
	ArrowUpDown,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronRight,
	CircleUser,
	ClipboardList,
	Inbox as InboxIcon,
	ListChecks,
	Mail,
	MoreHorizontal,
	Plus,
	Search,
	SendHorizonal,
	Settings,
	Star,
	Sun,
	Sunrise,
	Trash2,
	CircleHelp,
} from "lucide-react";
import "./todo-flow";

/* ---------- data ---------- */

type Bucket = "today" | "tomorrow" | "week";
type Priority = 1 | 2 | 3 | 0;

interface Comment {
	author: string;
	time: string;
	text: string;
}

interface Task {
	id: string;
	title: string;
	group: string;
	bucket: Bucket;
	time?: string;
	priority: Priority;
	assignee: string;
	done?: boolean;
	subtasks?: { id: string; title: string; done: boolean }[];
	comments?: Comment[];
}

const INITIAL_TASKS: Task[] = [
	{
		id: "t1",
		title: "Meeting with PM",
		group: "Design team",
		bucket: "today",
		time: "09:00",
		priority: 1,
		assignee: "Asha Verma",
		comments: [
			{
				author: "Ravi Kumar",
				time: "18:32",
				text: "@Asha the ward 4 summary is attached",
			},
		],
	},
	{
		id: "t2",
		title: "Website redesign",
		group: "Design team",
		bucket: "today",
		time: "10:00",
		priority: 2,
		assignee: "Meera Iyer",
	},
	{
		id: "t3",
		title: "Promo video",
		group: "Design team",
		bucket: "today",
		time: "10:00",
		priority: 2,
		assignee: "Dev Patel",
	},
	{
		id: "t4",
		title: "Dark theme for iOS",
		group: "Design team",
		bucket: "tomorrow",
		priority: 3,
		assignee: "Sana Sheikh",
	},
	{
		id: "t5",
		title: "New landing page",
		group: "Design team",
		bucket: "tomorrow",
		priority: 0,
		assignee: "Asha Verma",
	},
	{
		id: "t6",
		title: "Walmart Shopping",
		group: "Inbox",
		bucket: "tomorrow",
		priority: 1,
		assignee: "Asha Verma",
		subtasks: [
			{ id: "s1", title: "Skim milk", done: true },
			{ id: "s2", title: "Nut-free snacks", done: false },
			{ id: "s3", title: "Pumpkin pie", done: false },
			{ id: "s4", title: "Eggs, duck eggs, hen eggs", done: false },
			{ id: "s5", title: "Printing paper", done: false },
		],
		comments: [
			{
				author: "Shaw",
				time: "18:32",
				text: "@Jan pumpkin pie is sold out 😕",
			},
			{ author: "Jan", time: "18:41", text: "Get the apple one instead" },
		],
	},
	{
		id: "t7",
		title: "#Meeting with clients",
		group: "Inbox",
		bucket: "today",
		time: "10:00",
		priority: 1,
		assignee: "Ravi Kumar",
	},
	{
		id: "t8",
		title: '"Corporate Finance" Seminar',
		group: "Inbox",
		bucket: "tomorrow",
		priority: 2,
		assignee: "Meera Iyer",
	},
	{
		id: "t9",
		title: "Brain storming",
		group: "Inbox",
		bucket: "week",
		priority: 2,
		assignee: "Dev Patel",
	},
	{
		id: "t10",
		title: "Team building",
		group: "Inbox",
		bucket: "week",
		priority: 0,
		assignee: "Sana Sheikh",
	},
	{
		id: "t11",
		title: "Buy groceries",
		group: "Inbox",
		bucket: "today",
		time: "11:00",
		priority: 0,
		assignee: "Asha Verma",
		done: true,
	},
	{
		id: "t12",
		title: "Christmas activities",
		group: "Inbox",
		bucket: "today",
		time: "11:00",
		priority: 0,
		assignee: "Asha Verma",
		done: true,
	},
];

const VIEWS = [
	{ id: "all", label: "All", icon: <ClipboardList aria-hidden="true" /> },
	{ id: "today", label: "Today", icon: <Star aria-hidden="true" /> },
	{ id: "tomorrow", label: "Tomorrow", icon: <Sunrise aria-hidden="true" /> },
	{ id: "week", label: "Next 7 Days", icon: <Sun aria-hidden="true" /> },
	{
		id: "assigned",
		label: "Assigned to me",
		icon: <CircleUser aria-hidden="true" />,
	},
	{ id: "inbox", label: "Inbox", icon: <InboxIcon aria-hidden="true" /> },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const BUCKET_LABEL: Record<Bucket, string> = {
	today: "Today",
	tomorrow: "Tomorrow",
	week: "Fri",
};

const WEEK = [
	{ d: "Su", n: "13" },
	{ d: "Mo", n: "14" },
	{ d: "Tu", n: "15", today: true },
	{ d: "We", n: "16" },
	{ d: "Th", n: "17" },
	{ d: "Fr", n: "18" },
	{ d: "Sa", n: "19" },
];

/* ---------- pieces ---------- */

function PriorityBox({
	priority,
	done,
	onToggle,
	label,
}: {
	priority: Priority;
	done: boolean;
	onToggle: () => void;
	label: string;
}) {
	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={done}
			aria-label={label}
			className={`mock-td__check mock-td__check--p${priority}${done ? " is-done" : ""}`}
			onClick={(e) => {
				e.stopPropagation();
				onToggle();
			}}
		>
			{done ? <Check aria-hidden="true" /> : null}
		</button>
	);
}

/* ---------- the mock ---------- */

export function TodoFlowMock() {
	const [tasks, setTasks] = useState(INITIAL_TASKS);
	const [view, setView] = useState<ViewId>("week");
	const [selectedId, setSelectedId] = useState("t6");
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const [quickAdd, setQuickAdd] = useState("");
	const [comment, setComment] = useState("");

	const visible = useMemo(() => {
		return tasks.filter((t) => {
			if (view === "today") return t.bucket === "today";
			if (view === "tomorrow") return t.bucket === "tomorrow";
			if (view === "week") return true;
			if (view === "assigned") return t.assignee === "Asha Verma";
			if (view === "inbox") return t.group === "Inbox";
			return true;
		});
	}, [tasks, view]);

	const counts = useMemo(
		() => ({
			all: tasks.length,
			today: tasks.filter((t) => t.bucket === "today" && !t.done).length,
			tomorrow: tasks.filter((t) => t.bucket === "tomorrow" && !t.done).length,
			week: tasks.filter((t) => !t.done).length,
			assigned: tasks.filter((t) => t.assignee === "Asha Verma" && !t.done)
				.length,
			inbox: tasks.filter((t) => t.group === "Inbox" && !t.done).length,
		}),
		[tasks],
	);

	const selected = tasks.find((t) => t.id === selectedId) ?? null;

	function toggleTask(id: string) {
		setTasks((ts) =>
			ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
		);
	}

	function toggleSubtask(taskId: string, subId: string) {
		setTasks((ts) =>
			ts.map((t) =>
				t.id === taskId && t.subtasks
					? {
							...t,
							subtasks: t.subtasks.map((s) =>
								s.id === subId ? { ...s, done: !s.done } : s,
							),
						}
					: t,
			),
		);
	}

	function addTask() {
		const title = quickAdd.trim();
		if (!title) return;
		setTasks((ts) => [
			...ts,
			{
				id: `t${Date.now()}`,
				title,
				group: "Inbox",
				bucket: "tomorrow",
				priority: 0,
				assignee: "Asha Verma",
			},
		]);
		setQuickAdd("");
	}

	function addComment() {
		const text = comment.trim();
		if (!text || !selected) return;
		setTasks((ts) =>
			ts.map((t) =>
				t.id === selected.id
					? {
							...t,
							comments: [
								...(t.comments ?? []),
								{ author: "Asha Verma", time: "now", text },
							],
						}
					: t,
			),
		);
		setComment("");
	}

	const groups = ["Design team", "Inbox"].filter((g) =>
		visible.some((t) => t.group === g && !t.done),
	);
	const doneTasks = visible.filter((t) => t.done);

	return (
		<div className="mock-td">
			{/* ------- left: views + lists + week strip ------- */}
			<nav className="mock-td__nav">
				<div className="mock-td__me">
					<Avatar name="Asha Verma" size="sm" />
					<span>Asha</span>
					<span className="mock-td__meactions">
						<button type="button" className="mock-td__mebtn" aria-label="Inbox">
							<Mail aria-hidden="true" />
						</button>
						<button
							type="button"
							className="mock-td__mebtn"
							aria-label="Search"
						>
							<Search aria-hidden="true" />
						</button>
					</span>
				</div>
				<div className="mock-td__views">
					{VIEWS.map((v) => (
						<button
							key={v.id}
							className={
								view === v.id ? "mock-td__view is-active" : "mock-td__view"
							}
							aria-pressed={view === v.id}
							onClick={() => setView(v.id)}
						>
							{v.icon}
							<span className="mock-td__viewlabel">{v.label}</span>
							<span className="mock-td__viewcount">{counts[v.id]}</span>
						</button>
					))}
				</div>
				<div className="mock-td__lists">
					<span className="tw-cue">Lists</span>
					<button className="mock-td__list">
						<ListChecks aria-hidden="true" /> Design team
						<span className="mock-td__viewcount">5</span>
					</button>
					<button className="mock-td__list">
						<ListChecks aria-hidden="true" /> Product team
						<span className="mock-td__viewcount">3</span>
					</button>
					<button className="mock-td__list">
						<Plus aria-hidden="true" /> Add List
					</button>
				</div>
				<div className="mock-td__week" aria-label="This week">
					{WEEK.map((d) => (
						<span
							key={d.n}
							className={d.today ? "mock-td__day is-today" : "mock-td__day"}
						>
							<em>{d.d}</em>
							{d.n}
						</span>
					))}
				</div>
				<div className="mock-td__foot">
					<button type="button" className="mock-td__footrow">
						<Settings aria-hidden="true" /> Settings
					</button>
					<button type="button" className="mock-td__footrow">
						<CircleHelp aria-hidden="true" /> Help &amp; shortcuts
					</button>
				</div>
			</nav>

			{/* ------- center: grouped tasks ------- */}
			<main className="mock-td__center">
				<header className="mock-td__head">
					<h2>{VIEWS.find((v) => v.id === view)?.label}</h2>
					<span className="mock-td__headtools">
						<IconButton
							icon={<ArrowUpDown />}
							label="Sort"
							variant="ghost"
							size="sm"
						/>
						<IconButton
							icon={<MoreHorizontal />}
							label="More"
							variant="ghost"
							size="sm"
						/>
					</span>
				</header>

				<div className="mock-td__quickadd">
					<Input
						placeholder={`Add task to "Inbox" on "Tomorrow"`}
						value={quickAdd}
						onChange={(e) => setQuickAdd(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") addTask();
						}}
						aria-label="Quick add task"
					/>
				</div>

				<div className="mock-td__scroll">
					{groups.map((g) => {
						const rows = visible.filter((t) => t.group === g && !t.done);
						const isCollapsed = !!collapsed[g];
						return (
							<section key={g} className="mock-td__group">
								<button
									className="mock-td__grouphead"
									aria-expanded={!isCollapsed}
									onClick={() => setCollapsed((c) => ({ ...c, [g]: !c[g] }))}
								>
									{isCollapsed ? (
										<ChevronRight aria-hidden="true" />
									) : (
										<ChevronDown aria-hidden="true" />
									)}
									{g}
									<span className="mock-td__groupcount">{rows.length}</span>
								</button>
								{isCollapsed
									? null
									: rows.map((t) => (
											<div
												key={t.id}
												className={
													selectedId === t.id
														? "mock-td__task is-selected"
														: "mock-td__task"
												}
												onClick={() => setSelectedId(t.id)}
											>
												<PriorityBox
													priority={t.priority}
													done={!!t.done}
													onToggle={() => toggleTask(t.id)}
													label={t.title}
												/>
												<span className="mock-td__tasktitle">{t.title}</span>
												<span className="mock-td__taskmeta">
													{t.time ?? BUCKET_LABEL[t.bucket]}
												</span>
												<Avatar name={t.assignee} size="sm" />
											</div>
										))}
							</section>
						);
					})}

					{doneTasks.length ? (
						<section className="mock-td__group">
							<button
								className="mock-td__grouphead"
								aria-expanded={!collapsed.__done}
								onClick={() =>
									setCollapsed((c) => ({ ...c, __done: !c.__done }))
								}
							>
								{collapsed.__done ? (
									<ChevronRight aria-hidden="true" />
								) : (
									<ChevronDown aria-hidden="true" />
								)}
								Completed
								<span className="mock-td__groupcount">{doneTasks.length}</span>
							</button>
							{collapsed.__done
								? null
								: doneTasks.map((t) => (
										<div key={t.id} className="mock-td__task is-done">
											<PriorityBox
												priority={t.priority}
												done
												onToggle={() => toggleTask(t.id)}
												label={t.title}
											/>
											<span className="mock-td__tasktitle">{t.title}</span>
											<span className="mock-td__taskmeta">
												{t.time ?? BUCKET_LABEL[t.bucket]}
											</span>
										</div>
									))}
						</section>
					) : null}
				</div>
			</main>

			{/* ------- right: task detail ------- */}
			<aside className="mock-td__detail">
				{selected ? (
					<>
						<div className="mock-td__detailtop">
							<Badge size="sm" tone="rose">
								<CalendarDays aria-hidden="true" /> Oct 15,{" "}
								{BUCKET_LABEL[selected.bucket]}
							</Badge>
							<Avatar name={selected.assignee} size="sm" />
						</div>
						<h3 className="mock-td__detailtitle">{selected.title}</h3>

						{selected.subtasks ? (
							<div className="mock-td__subs">
								{selected.subtasks.map((s) => (
									<label key={s.id} className="mock-td__sub">
										<PriorityBox
											priority={0}
											done={s.done}
											onToggle={() => toggleSubtask(selected.id, s.id)}
											label={s.title}
										/>
										<span
											className={
												s.done ? "mock-td__subtext is-done" : "mock-td__subtext"
											}
										>
											{s.title}
										</span>
									</label>
								))}
							</div>
						) : (
							<p className="mock-td__nosubs">No subtasks yet.</p>
						)}

						<div className="mock-td__comments">
							{(selected.comments ?? []).map((c, i) => (
								<div key={i} className="mock-td__comment">
									<Avatar name={c.author} size="sm" />
									<div>
										<span className="mock-td__cmeta">
											<strong>{c.author}</strong> {c.time}
										</span>
										<p>{c.text}</p>
									</div>
								</div>
							))}
						</div>

						<div className="mock-td__composer">
							<Input
								placeholder="Write a comment"
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") addComment();
								}}
								aria-label="Write a comment"
							/>
							<IconButton
								icon={<SendHorizonal />}
								label="Send comment"
								onClick={addComment}
							/>
						</div>

						<div className="mock-td__detailtools">
							<IconButton
								icon={<CalendarDays />}
								label="Schedule"
								variant="ghost"
								size="sm"
							/>
							<IconButton
								icon={<Trash2 />}
								label="Delete task"
								variant="ghost"
								size="sm"
							/>
							<IconButton
								icon={<MoreHorizontal />}
								label="More actions"
								variant="ghost"
								size="sm"
							/>
						</div>
					</>
				) : (
					<p className="mock-td__nosubs">Pick a task to see its detail.</p>
				)}
			</aside>
		</div>
	);
}
