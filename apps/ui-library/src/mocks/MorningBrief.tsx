import { useState, type ReactNode } from "react";
import { Avatar, Badge, Button, Checkbox } from "@twodb/ui";
import {
	AlertTriangle,
	CalendarClock,
	Clock,
	FileText,
	FlaskConical,
	Plus,
	Receipt,
	Syringe,
} from "lucide-react";

/* ---------- data ---------- */

interface Appointment {
	name: string;
	reason: string;
	time: string;
	prep?: string;
}

const APPOINTMENTS: Appointment[] = [
	{ name: "Ravi Kumar", reason: "Follow-up · discharge review", time: "9:00 am" },
	{
		name: "Meera Iyer",
		reason: "Lab draw — fasting panel",
		time: "9:40 am",
		prep: "Prep soon",
	},
	{ name: "Arjun Nair", reason: "Physio, session 4 of 8", time: "11:15 am" },
	{
		name: "Sana Sheikh",
		reason: "New patient intake",
		time: "12:30 pm",
		prep: "Prep soon",
	},
];

interface BriefTask {
	id: string;
	title: string;
	done?: boolean;
}

const FRONT_DESK_TASKS: BriefTask[] = [
	{ id: "fd1", title: "Confirm Tuesday's visiting hours with Dr. Rao" },
	{ id: "fd2", title: "Print consent forms for the afternoon list" },
	{ id: "fd3", title: "Call the lab about the two pending reports" },
];

const LAB_TASKS: BriefTask[] = [
	{ id: "lb1", title: "Label yesterday's samples before 10 am", done: true },
	{ id: "lb2", title: "Calibrate the analyzer — log sheet in drawer" },
];

/* ---------- small parts ---------- */

function TimePill({ children }: { children: ReactNode }) {
	return (
		<span className="mock-brief__time">
			<Clock aria-hidden="true" />
			{children}
		</span>
	);
}

function Stack({
	cue,
	action,
	children,
	footer,
}: {
	cue: string;
	action?: ReactNode;
	children: ReactNode;
	footer: ReactNode;
}) {
	return (
		<section className="mock-brief__section">
			<div className="mock-brief__cue">
				<span className="tw-cue">{cue}</span>
				{action}
			</div>
			<div className="mock-brief__stack">
				{children}
				<div className="mock-brief__foot">{footer}</div>
			</div>
		</section>
	);
}

function TaskRow({
	task,
	onToggle,
	onSnooze,
}: {
	task: BriefTask;
	onToggle: (id: string, done: boolean) => void;
	onSnooze: (id: string) => void;
}) {
	return (
		<div
			className={
				task.done
					? "mock-brief__row mock-brief__row--task is-done"
					: "mock-brief__row mock-brief__row--task"
			}
		>
			<Checkbox
				checked={!!task.done}
				onChange={(e) => onToggle(task.id, e.target.checked)}
				aria-label={task.title}
			/>
			<span className="mock-brief__title">{task.title}</span>
			{task.done ? null : (
				<span className="mock-brief__actions">
					<Button size="sm" variant="ghost" onClick={() => onSnooze(task.id)}>
						Snooze
					</Button>
					<Button size="sm" onClick={() => onToggle(task.id, true)}>
						Complete
					</Button>
				</span>
			)}
		</div>
	);
}

function TaskGroup({
	label,
	tasks,
	onToggle,
	onSnooze,
}: {
	label: string;
	tasks: BriefTask[];
	onToggle: (id: string, done: boolean) => void;
	onSnooze: (id: string) => void;
}) {
	const open = tasks.filter((t) => !t.done).length;
	return (
		<>
			{tasks.map((t) => (
				<TaskRow key={t.id} task={t} onToggle={onToggle} onSnooze={onSnooze} />
			))}
			<div className="mock-brief__foot">
				<span className="tw-cue">{label}</span>
				<span className="mock-brief__count">{open}</span>
			</div>
		</>
	);
}

/* ---------- the brief ---------- */

export function MorningBriefMock() {
	const [frontDesk, setFrontDesk] = useState(FRONT_DESK_TASKS);
	const [lab, setLab] = useState(LAB_TASKS);

	function toggle(
		setter: typeof setFrontDesk,
		id: string,
		done: boolean,
	) {
		setter((ts) =>
			[...ts]
				.map((t) => (t.id === id ? { ...t, done } : t))
				.sort((a, b) => Number(!!a.done) - Number(!!b.done)),
		);
	}

	function snooze(setter: typeof setFrontDesk, id: string) {
		setter((ts) => {
			const t = ts.find((x) => x.id === id);
			if (!t) return ts;
			return [...ts.filter((x) => x.id !== id), t];
		});
	}

	return (
		<div className="mock-brief">
			<header className="mock-brief__head">
				<div>
					<h2>August 8th, 2026.</h2>
					<p className="mock-brief__meta">
						Drafted 06:30 from overnight data · reviewed by Asha
					</p>
				</div>
				<span className="mock-brief__today">Today</span>
			</header>

			<Stack
				cue="Appointments"
				footer={
					<>
						<span className="tw-cue">Two need preparation</span>
						<span className="mock-brief__count">{APPOINTMENTS.length}</span>
					</>
				}
			>
				{APPOINTMENTS.map((a) => (
					<div className="mock-brief__row" key={a.name}>
						<Avatar name={a.name} size="sm" />
						<span className="mock-brief__body">
							<span className="mock-brief__title">{a.name}</span>
							<span className="mock-brief__sub">{a.reason}</span>
						</span>
						{a.prep ? (
							<Badge size="sm" tone="warning">
								{a.prep}
							</Badge>
						) : null}
						<TimePill>{a.time}</TimePill>
					</div>
				))}
			</Stack>

			<Stack
				cue="Tasks"
				action={
					<Button size="sm" variant="ghost">
						<Plus aria-hidden="true" /> New task
					</Button>
				}
				footer={
					<>
						<span className="tw-cue">Front desk</span>
						<span className="mock-brief__count">
							{frontDesk.filter((t) => !t.done).length}
						</span>
					</>
				}
			>
				<TaskGroup
					label="Front desk"
					tasks={frontDesk}
					onToggle={(id, done) => toggle(setFrontDesk, id, done)}
					onSnooze={(id) => snooze(setFrontDesk, id)}
				/>
				<div className="mock-brief__groupsep" aria-hidden="true" />
				<TaskGroup
					label="Lab"
					tasks={lab}
					onToggle={(id, done) => toggle(setLab, id, done)}
					onSnooze={(id) => snooze(setLab, id)}
				/>
			</Stack>

			<Stack
				cue="Reports back overnight"
				footer={
					<>
						<span className="tw-cue">Attached to the right charts</span>
						<span className="mock-brief__count">3</span>
					</>
				}
			>
				<div className="mock-brief__row">
					<span className="mock-brief__icon">
						<FlaskConical aria-hidden="true" />
					</span>
					<span className="mock-brief__body">
						<span className="mock-brief__title">Lipid panel — Meera Iyer</span>
						<span className="mock-brief__sub">Received 02:14 · within range</span>
					</span>
					<Badge size="sm" tone="go">
						Reviewed
					</Badge>
				</div>
				<div className="mock-brief__row">
					<span className="mock-brief__icon">
						<FileText aria-hidden="true" />
					</span>
					<span className="mock-brief__body">
						<span className="mock-brief__title">X-ray report — Arjun Nair</span>
						<span className="mock-brief__sub">Received 04:40 · one flag</span>
					</span>
					<Badge size="sm" tone="rose">
						Flagged
					</Badge>
				</div>
			</Stack>

			<Stack
				cue="Stock below the reorder line"
				footer={
					<>
						<span className="tw-cue">Suggested order attached</span>
						<span className="mock-brief__count">2</span>
					</>
				}
			>
				<div className="mock-brief__row">
					<span className="mock-brief__icon">
						<Syringe aria-hidden="true" />
					</span>
					<span className="mock-brief__body">
						<span className="mock-brief__title">Gauze rolls, sterile</span>
						<span className="mock-brief__sub">14 left · reorder line 20</span>
					</span>
					<Button size="sm" variant="secondary">
						Order 100
					</Button>
				</div>
				<div className="mock-brief__row">
					<span className="mock-brief__icon">
						<AlertTriangle aria-hidden="true" />
					</span>
					<span className="mock-brief__body">
						<span className="mock-brief__title">Nitrile gloves, medium</span>
						<span className="mock-brief__sub">1 box left · reorder line 4</span>
					</span>
					<Button size="sm" variant="secondary">
						Order 12
					</Button>
				</div>
			</Stack>

			<section className="mock-brief__onething">
				<span className="mock-brief__icon mock-brief__icon--rose">
					<Receipt aria-hidden="true" />
				</span>
				<span className="mock-brief__body">
					<span className="tw-cue">The one thing</span>
					<span className="mock-brief__title">
						Six invoices crossed 30 days this week — reminders are drafted
					</span>
				</span>
				<Button size="sm">Send reminders</Button>
			</section>

			<footer className="mock-brief__signoff">
				<CalendarClock aria-hidden="true" />
				Tomorrow's brief drafts itself at 06:30. Nothing to maintain.
			</footer>
		</div>
	);
}
