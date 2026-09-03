import { useRef, useState } from "react";
import {
	Button,
	Dialog,
	IconButton,
	Input,
	Menu,
	MenuDivider,
	MenuItem,
	NavRail,
	Select,
	Tabs,
} from "@twodb/ui";
import {
	Activity,
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	Flame,
	Leaf,
	MoreHorizontal,
	Plus,
	Sprout,
	Trash2,
	User,
	X,
} from "lucide-react";
import "./habit-tracker.css";

/* ---------- Types ---------- */

type DayState = "done" | "kintsugi";
type View = "week" | "month" | "year";

interface Habit {
	id: string;
	name: string;
	freq: string;
	/** days-per-week target, for the weekly progress bar */
	target: number;
	/** curated-palette hex — the habit's light */
	color: string;
	days: Record<string, DayState>;
}

/* ---------- Date helpers ---------- */

const WEEKS = 21;
const DOW_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function keyOf(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

/** Monday of the week containing d. */
function mondayOf(d: Date): Date {
	const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
	return x;
}

function shortDate(d: Date): string {
	return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/* ---------- Deterministic history ---------- */

function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/**
 * ~5 months of plausible history: each past day is done with probability
 * pDone; a share of the misses are repaired — kintsugi, gold in the cracks.
 * The most recent `streakDays` are forced done so streaks read real.
 */
function buildHistory(
	seed: number,
	pDone: number,
	streakDays: number,
	doneToday: boolean,
): Record<string, DayState> {
	const rand = rng(seed);
	const days: Record<string, DayState> = {};
	const today = new Date();
	for (let back = 160; back >= 1; back--) {
		const d = addDays(today, -back);
		if (back <= streakDays) {
			days[keyOf(d)] = "done";
			continue;
		}
		if (rand() < pDone) days[keyOf(d)] = "done";
		else if (rand() < 0.28) days[keyOf(d)] = "kintsugi";
	}
	if (doneToday) days[keyOf(today)] = "done";
	return days;
}

/** Consecutive kept days ending today (today may still be pending). */
function streakOf(habit: Habit): number {
	let n = 0;
	let d = new Date();
	if (!habit.days[keyOf(d)]) d = addDays(d, -1);
	while (habit.days[keyOf(d)]) {
		n++;
		d = addDays(d, -1);
	}
	return n;
}

/* ---------- Data ---------- */

const INITIAL_HABITS: Habit[] = [
	{
		id: "read",
		name: "Read 10 pages",
		freq: "1× / day",
		target: 7,
		color: "#6D80FF",
		days: buildHistory(11, 0.85, 25, true),
	},
	{
		id: "gym",
		name: "Gym",
		freq: "3× / week",
		target: 3,
		color: "#E07A3F",
		days: buildHistory(23, 0.45, 4, true),
	},
	{
		id: "water",
		name: "Drink Water",
		freq: "5× / day",
		target: 7,
		color: "#0F9D8F",
		days: buildHistory(37, 0.55, 12, false),
	},
	{
		id: "meditate",
		name: "Meditate",
		freq: "1× / day",
		target: 7,
		color: "#FF7BAE",
		days: buildHistory(53, 0.7, 8, false),
	},
];

const FREQ_OPTIONS = [
	{ value: "daily1", label: "1× / day", target: 7, p: 0.8 },
	{ value: "daily2", label: "2× / day", target: 7, p: 0.75 },
	{ value: "week3", label: "3× / week", target: 3, p: 0.45 },
	{ value: "week5", label: "5× / week", target: 5, p: 0.65 },
];

const HABIT_COLORS = [
	"#6D80FF",
	"#7B5CFF",
	"#FF7BAE",
	"#E07A3F",
	"#0F9D8F",
	"#3F9D5A",
];

/* ---------- Small pieces ---------- */

function StreakPill({ habit }: { habit: Habit }) {
	return (
		<span
			className="mock-habit__streak"
			style={{
				background: `color-mix(in srgb, ${habit.color} 16%, transparent)`,
				color: habit.color,
			}}
			title={`${streakOf(habit)} day streak`}
		>
			<Flame aria-hidden="true" />
			{streakOf(habit)}
		</span>
	);
}

/** Round check button — the habit's light when done, gold when kintsugi. */
function CheckButton({
	state,
	color,
	size = "md",
	disabled,
	label,
	onClick,
}: {
	state: DayState | undefined;
	color: string;
	size?: "md" | "lg";
	disabled?: boolean;
	label: string;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			className={`mock-habit__check mock-habit__check--${size}`}
			data-state={state ?? "empty"}
			style={{ "--habit": color } as React.CSSProperties}
			disabled={disabled}
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			<Check aria-hidden="true" />
		</button>
	);
}

/** One dot in a contribution grid. */
function Dot({
	date,
	state,
	color,
	todayKey,
	onToggle,
}: {
	date: Date;
	state: DayState | undefined;
	color: string;
	todayKey: string;
	onToggle: () => void;
}) {
	const key = keyOf(date);
	const future = key > todayKey;
	const label = `${shortDate(date)} — ${state ?? (future ? "upcoming" : "missed")}`;
	return (
		<button
			type="button"
			className={`mock-habit__dot${key === todayKey ? " is-today" : ""}`}
			data-state={future ? "future" : (state ?? "empty")}
			style={{ "--habit": color } as React.CSSProperties}
			disabled={future}
			aria-label={label}
			title={label}
			onClick={onToggle}
		/>
	);
}

/* ---------- Main Component ---------- */

export function HabitTrackerMock() {
	const [habits, setHabits] = useState(INITIAL_HABITS);
	const [rail, setRail] = useState("build");
	const [view, setView] = useState<View>("year");
	const [monthCursor, setMonthCursor] = useState(
		() => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
	);
	const [adding, setAdding] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [draftFreq, setDraftFreq] = useState("daily1");
	const [draftColor, setDraftColor] = useState(HABIT_COLORS[0]);
	const nextId = useRef(1);

	const today = new Date();
	const todayKey = keyOf(today);
	const doneToday = habits.filter((h) => h.days[todayKey]).length;

	/* --- mutations --- */

	/** empty → done → kintsugi → empty */
	function cycleDay(habitId: string, key: string) {
		setHabits((prev) =>
			prev.map((h) => {
				if (h.id !== habitId) return h;
				const cur = h.days[key];
				const next: DayState | undefined =
					cur === undefined ? "done" : cur === "done" ? "kintsugi" : undefined;
				const days = { ...h.days };
				if (next) days[key] = next;
				else delete days[key];
				return { ...h, days };
			}),
		);
	}

	function setToday(habitId: string, state: DayState | undefined) {
		setHabits((prev) =>
			prev.map((h) => {
				if (h.id !== habitId) return h;
				const days = { ...h.days };
				if (state) days[todayKey] = state;
				else delete days[todayKey];
				return { ...h, days };
			}),
		);
	}

	function removeHabit(habitId: string) {
		setHabits((prev) => prev.filter((h) => h.id !== habitId));
	}

	function addHabit() {
		const f =
			FREQ_OPTIONS.find((o) => o.value === draftFreq) ?? FREQ_OPTIONS[0];
		const name = draftName.trim();
		if (!name) return;
		const id = `h${nextId.current++}`;
		setHabits((prev) => [
			...prev,
			{
				id,
				name,
				freq: f.label,
				target: f.target,
				color: draftColor,
				days: buildHistory(nextId.current * 7919, f.p, 6, false),
			},
		]);
		setDraftName("");
		setAdding(false);
	}

	/* --- view: weekly --- */

	function renderWeek() {
		const weekStart = mondayOf(today);
		const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
		return (
			<div className="mock-habit__week">
				<div className="mock-habit__week-grid">
					<div className="mock-habit__week-corner" />
					{weekDays.map((d, i) => (
						<div
							key={keyOf(d)}
							className={`mock-habit__week-day${keyOf(d) === todayKey ? " is-today" : ""}`}
						>
							<span className="mock-habit__week-dow">{DOW_LETTERS[i]}</span>
							<span className="mock-habit__week-num">{d.getDate()}</span>
						</div>
					))}

					{habits.map((h) => {
						const kept = weekDays.filter((d) => h.days[keyOf(d)]).length;
						const pct = Math.min(100, Math.round((kept / h.target) * 100));
						return [
							<div key={`${h.id}-name`} className="mock-habit__week-name">
								<div className="mock-habit__week-id">
									<span
										className="mock-habit__chip"
										style={{ background: h.color }}
										aria-hidden="true"
									/>
									<div className="mock-habit__week-idtext">
										<strong>{h.name}</strong>
										<em>{h.freq}</em>
									</div>
								</div>
								<div className="mock-habit__week-progress">
									<span className="mock-habit__week-bar">
										<i style={{ width: `${pct}%`, background: h.color }} />
									</span>
									<span className="mock-habit__week-count">
										{kept}/{h.target} this week
									</span>
								</div>
							</div>,
							...weekDays.map((d) => {
								const key = keyOf(d);
								const future = key > todayKey;
								return (
									<div key={key} className="mock-habit__week-cell">
										<CheckButton
											state={h.days[key]}
											color={h.color}
											disabled={future}
											label={`${h.name}, ${shortDate(d)}`}
											onClick={() => cycleDay(h.id, key)}
										/>
									</div>
								);
							}),
						];
					})}
				</div>
			</div>
		);
	}

	/* --- view: monthly --- */

	function renderMonth() {
		const y = monthCursor.getFullYear();
		const m = monthCursor.getMonth();
		const daysInMonth = new Date(y, m + 1, 0).getDate();
		const days = Array.from(
			{ length: daysInMonth },
			(_, i) => new Date(y, m, i + 1),
		);
		const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();

		return (
			<div className="mock-habit__month">
				<div className="mock-habit__month-nav">
					<IconButton
						label="Previous month"
						icon={<ChevronLeft />}
						size="sm"
						onClick={() => setMonthCursor(new Date(y, m - 1, 1))}
					/>
					<span className="mock-habit__month-title">
						{monthCursor.toLocaleDateString("en-US", {
							month: "long",
							year: "numeric",
						})}
					</span>
					<IconButton
						label="Next month"
						icon={<ChevronRight />}
						size="sm"
						disabled={isCurrentMonth}
						onClick={() => setMonthCursor(new Date(y, m + 1, 1))}
					/>
				</div>

				<div className="mock-habit__month-scroll">
					<div
						className="mock-habit__month-grid"
						style={{
							gridTemplateColumns: `minmax(180px, 220px) repeat(${daysInMonth}, 30px)`,
						}}
					>
						<div className="mock-habit__month-corner" />
						{days.map((d) => (
							<div
								key={keyOf(d)}
								className={`mock-habit__month-day${keyOf(d) === todayKey ? " is-today" : ""}`}
							>
								{d.getDate()}
							</div>
						))}

						{habits.map((h) => [
							<div key={`${h.id}-name`} className="mock-habit__month-name">
								<span
									className="mock-habit__chip"
									style={{ background: h.color }}
									aria-hidden="true"
								/>
								<div className="mock-habit__week-idtext">
									<strong>{h.name}</strong>
									<em>{h.freq}</em>
								</div>
							</div>,
							...days.map((d) => {
								const key = keyOf(d);
								return (
									<div
										key={key}
										className={`mock-habit__month-cell${key === todayKey ? " is-today" : ""}`}
									>
										<Dot
											date={d}
											state={h.days[key]}
											color={h.color}
											todayKey={todayKey}
											onToggle={() => cycleDay(h.id, key)}
										/>
									</div>
								);
							}),
						])}
					</div>
				</div>
			</div>
		);
	}

	/* --- view: yearly --- */

	function renderYear() {
		const yearStart = mondayOf(addDays(today, -(WEEKS - 1) * 7));
		const columns: Date[][] = Array.from({ length: WEEKS }, (_, w) =>
			Array.from({ length: 7 }, (_, r) => addDays(yearStart, w * 7 + r)),
		);
		/* month label when a column's Monday opens a new month */
		const labels = columns.map((col, w) => {
			const prev = w > 0 ? columns[w - 1][0] : null;
			return !prev || col[0].getMonth() !== prev.getMonth()
				? MONTHS_SHORT[col[0].getMonth()]
				: "";
		});

		return (
			<div className="mock-habit__year">
				{habits.map((h) => (
					<article key={h.id} className="mock-habit__card">
						<header className="mock-habit__card-head">
							<CheckButton
								size="lg"
								state={h.days[todayKey]}
								color={h.color}
								label={`${h.name}, today`}
								onClick={() => cycleDay(h.id, todayKey)}
							/>
							<div className="mock-habit__card-id">
								<h3>{h.name}</h3>
								<span className="mock-habit__freq">{h.freq}</span>
							</div>
							<StreakPill habit={h} />
							<Menu
								placement="bottom-end"
								trigger={
									<IconButton
										label={`${h.name} actions`}
										icon={<MoreHorizontal />}
										size="sm"
									/>
								}
							>
								<MenuItem
									icon={<Check />}
									onClick={() => setToday(h.id, "done")}
								>
									Mark today done
								</MenuItem>
								<MenuItem
									icon={<X />}
									onClick={() => setToday(h.id, undefined)}
								>
									Clear today
								</MenuItem>
								<MenuDivider />
								<MenuItem
									icon={<Trash2 />}
									danger
									onClick={() => removeHabit(h.id)}
								>
									Remove habit
								</MenuItem>
							</Menu>
						</header>

						<div className="mock-habit__yeargrid">
							<div className="mock-habit__months" aria-hidden="true">
								{labels.map((label, i) => (
									<span key={i}>{label}</span>
								))}
							</div>
							<div className="mock-habit__yearbody">
								<div className="mock-habit__dow" aria-hidden="true">
									{DOW_LETTERS.map((letter, i) => (
										<span key={i}>{i % 2 === 0 ? letter : ""}</span>
									))}
								</div>
								<div className="mock-habit__dots">
									{columns.flatMap((col) =>
										col.map((d) => {
											const key = keyOf(d);
											return (
												<Dot
													key={key}
													date={d}
													state={h.days[key]}
													color={h.color}
													todayKey={todayKey}
													onToggle={() => cycleDay(h.id, key)}
												/>
											);
										}),
									)}
								</div>
							</div>
						</div>

						<footer className="mock-habit__legend">
							<span>
								<i style={{ background: h.color }} />
								Complete
							</span>
							<span>
								<i className="mock-habit__legend-gold" />
								Kintsugi
							</span>
							<span>
								<i className="mock-habit__legend-empty" />
								Missed
							</span>
						</footer>
					</article>
				))}
			</div>
		);
	}

	/* --- shell --- */

	return (
		<div className="mock-habit">
			<NavRail
				aria-label="Habit navigation"
				value={rail}
				onValueChange={setRail}
				header={
					<span className="mock-habit__brand" aria-hidden="true">
						<Leaf />
					</span>
				}
				items={[
					{ id: "build", icon: <Sprout />, label: "Build" },
					{ id: "trends", icon: <Activity />, label: "Trends" },
					{ id: "calendar", icon: <CalendarDays />, label: "Calendar" },
					{ id: "you", icon: <User />, label: "You" },
				]}
				footer={
					<IconButton
						label="New habit"
						icon={<Plus />}
						variant="secondary"
						onClick={() => setAdding(true)}
					/>
				}
			/>

			<div className="mock-habit__main">
				<header className="mock-habit__head">
					<div className="mock-habit__head-text">
						<h1>
							{today.toLocaleDateString("en-US", { weekday: "long" })},{" "}
							{today.toLocaleDateString("en-US", {
								month: "long",
								day: "numeric",
							})}
						</h1>
						<p>Rise and build.</p>
					</div>
					<div className="mock-habit__head-side">
						<span className="mock-habit__today-summary">
							<Flame aria-hidden="true" />
							{doneToday} of {habits.length} kept today
						</span>
						<Tabs
							aria-label="Tracker view"
							value={view}
							onValueChange={(v) => setView(v as View)}
							items={[
								{ id: "week", label: "Weekly" },
								{ id: "month", label: "Monthly" },
								{ id: "year", label: "Yearly" },
							]}
						/>
						<Button size="sm" onClick={() => setAdding(true)}>
							<Plus aria-hidden="true" />
							New habit
						</Button>
					</div>
				</header>

				<div className="mock-habit__view">
					{view === "week" && renderWeek()}
					{view === "month" && renderMonth()}
					{view === "year" && renderYear()}
				</div>
			</div>

			<Dialog
				open={adding}
				onClose={() => setAdding(false)}
				title="New habit"
				footer={
					<>
						<Button variant="ghost" onClick={() => setAdding(false)}>
							Cancel
						</Button>
						<Button onClick={addHabit} disabled={!draftName.trim()}>
							Add habit
						</Button>
					</>
				}
			>
				<div className="mock-habit__form">
					<Input
						label="Name"
						placeholder="Read 10 pages"
						value={draftName}
						onChange={(e) => setDraftName(e.target.value)}
					/>
					<Select
						label="Frequency"
						value={draftFreq}
						onValueChange={setDraftFreq}
						options={FREQ_OPTIONS.map((f) => ({
							value: f.value,
							label: f.label,
						}))}
					/>
					<div className="mock-habit__form-colors">
						<span className="mock-habit__form-label">Color</span>
						<div
							className="mock-habit__swatches"
							role="radiogroup"
							aria-label="Habit color"
						>
							{HABIT_COLORS.map((c) => (
								<button
									key={c}
									type="button"
									role="radio"
									aria-checked={draftColor === c}
									className={`mock-habit__swatch${draftColor === c ? " is-active" : ""}`}
									style={{ background: c }}
									aria-label={c}
									onClick={() => setDraftColor(c)}
								/>
							))}
						</div>
					</div>
				</div>
			</Dialog>
		</div>
	);
}
