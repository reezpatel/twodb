import { useMemo, useState } from "react";
import { calendarSceneStyles } from "./CalendarScene.style.jsx";
import {
	Avatar,
	Badge,
	Button,
	Calendar,
	DatePicker,
	Dialog,
	IconButton,
	Input,
	MonthCalendar,
	SearchInput,
	Select,
	Tabs,
	TimePicker,
	type CalTone,
	type MonthEvent,
} from "@twodb/ui";
import {
	BarChart3,
	CalendarDays,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Circle,
	ClipboardList,
	Clock,
	FolderOpen,
	Plus,
	Settings,
	Star,
	Users,
} from "lucide-react";

type CalendarView = "month" | "week" | "day" | "list";
type DailyCategory = "clinic" | "patients" | "admin" | "personal";

interface MockEvent extends MonthEvent {
	cal: "team" | "shared" | "public";
}

function ev(
	id: string,
	day: number,
	title: string,
	time: string,
	tone: CalTone,
	cal: MockEvent["cal"] = "team",
): MockEvent {
	return {
		id,
		date: `2026-01-${String(day).padStart(2, "0")}`,
		title,
		time,
		tone,
		cal,
	};
}

const EVENTS: MockEvent[] = [
	ev("standup-5", 5, "Monday standup", "9:00 AM", "neutral"),
	ev("coffee-5", 5, "Coffee with Alina", "11:30 AM", "warning"),
	ev("marketing-5", 5, "Marketing site review", "2:30 PM", "cobalt"),
	ev("1on1-8", 8, "One-on-one w/ Priya", "10:00 AM", "rose", "shared"),
	ev("allhands-8", 8, "All-hands meeting", "4:00 PM", "danger", "public"),
	ev("dinner-8", 8, "Dinner with C…", "6:30 PM", "warning"),
	ev("fri-9", 9, "Friday standup", "9:00 AM", "cobalt"),
	ev("house-9", 9, "House inspection", "10:30 AM", "warning"),
	ev("standup-12", 12, "Monday standup", "9:00 AM", "neutral"),
	ev("content-12", 12, "Content planning", "11:00 AM", "rose"),
	ev("1on1-13", 13, "One-on-one w/ Sam", "10:00 AM", "rose", "shared"),
	ev("catchup-13", 13, "Catch up w/ Alex", "2:30 PM", "warning", "shared"),
	ev("deep-14", 14, "Deep work", "9:00 AM", "cobalt"),
	ev("sync-14", 14, "Design sync", "10:30 AM", "cobalt", "shared"),
	ev("seo-14", 14, "SEO planning", "1:30 PM", "cobalt"),
	ev("lunch-15", 15, "Lunch with C…", "12:00 PM", "warning"),
	ev("fri-16", 16, "Friday standup", "9:00 AM", "cobalt"),
	ev("olivia-16", 16, "Olivia × Riley", "10:00 AM", "rose"),
	ev("demo-16", 16, "Product demo", "1:30 PM", "cobalt", "public"),
	ev("house-17", 17, "House inspection", "11:00 AM", "warning"),
	ev("ava-18", 18, "Ava's engagement", "1:00 PM", "rose", "public"),
	ev("standup-19", 19, "Monday standup", "9:00 AM", "neutral"),
	ev("lunch-19", 19, "Team lunch", "12:15 PM", "rose"),
	ev("planning-21", 21, "Product planning", "9:30 AM", "cobalt"),
	ev("amelie-22", 22, "Amélie's first day", "10:00 AM", "rose"),
	ev("allhands-22", 22, "All-hands meeting", "4:00 PM", "danger", "public"),
	ev("fri-23", 23, "Friday standup", "9:00 AM", "cobalt"),
	ev("coffee-23", 23, "Coffee w/ Amélie", "9:30 AM", "warning"),
	ev("feedback-23", 23, "Design feedback", "2:30 PM", "cobalt", "shared"),
	ev("marathon-24", 24, "Half marathon", "7:00 AM", "warning", "public"),
	ev("standup-26", 26, "Monday standup", "9:00 AM", "neutral"),
	ev("deep-26", 26, "Deep work", "9:15 AM", "cobalt"),
	ev("quarterly-27", 27, "Quarterly review", "11:30 AM", "warning", "shared"),
	ev("lunch-27", 27, "Lunch with Zahir", "1:00 PM", "warning"),
	ev("dinner-27", 27, "Dinner with C…", "7:00 PM", "warning"),
	ev("deep-28", 28, "Deep work", "9:00 AM", "cobalt"),
	ev("sync-28", 28, "Design sync", "2:30 PM", "cobalt", "shared"),
	ev("amelie-29", 29, "Amélie coffee", "10:00 AM", "rose", "shared"),
	ev("fri-30", 30, "Friday standup", "9:00 AM", "cobalt"),
	ev("accountant-30", 30, "Accountant", "1:45 PM", "warning"),
	ev("marketing-30", 30, "Marketing site review", "2:30 PM", "cobalt"),
	ev("lunch-31", 31, "Lunch with Alina", "12:45 PM", "warning"),
];

const WEEK_EVENTS = [
	{
		id: "week-standup",
		title: "Monday standup",
		day: 0,
		start: 9,
		end: 10,
		tone: "neutral",
		people: ["Ava Thompson", "Ethan Carter", "Sophia Lee"],
	},
	{
		id: "week-coffee",
		title: "Coffee with Alina",
		day: 0,
		start: 11.5,
		end: 12.5,
		tone: "warning",
		people: ["Alina Ross"],
	},
	{
		id: "week-marketing",
		title: "Marketing site review",
		day: 0,
		start: 14.5,
		end: 15.5,
		tone: "cobalt",
		people: ["Maya Shah", "Noah Reed"],
	},
	{
		id: "week-priya",
		title: "One-on-one w/ Priya",
		day: 3,
		start: 10,
		end: 11,
		tone: "rose",
		people: ["Priya Nair"],
	},
	{
		id: "week-allhands",
		title: "All-hands meeting",
		day: 3,
		start: 16,
		end: 17,
		tone: "danger",
		people: ["Ava Thompson", "Ethan Carter", "Sophia Lee"],
	},
	{
		id: "week-dinner",
		title: "Dinner with C…",
		day: 3,
		start: 18.5,
		end: 19.5,
		tone: "warning",
		people: [],
	},
	{
		id: "week-friday",
		title: "Friday standup",
		day: 4,
		start: 9,
		end: 10,
		tone: "cobalt",
		people: ["Ava Thompson", "Liam Chen"],
	},
	{
		id: "week-house",
		title: "House inspection",
		day: 4,
		start: 10.5,
		end: 11.5,
		tone: "warning",
		people: [],
	},
] satisfies {
	id: string;
	title: string;
	day: number;
	start: number;
	end: number;
	tone: CalTone;
	people: string[];
}[];

const WEEK_HOURS = [8, 10, 12, 14, 16, 18];
const WEEK_START_HOUR = 8;
const WEEK_HOUR_HEIGHT = 72;
const DAILY_HOUR_HEIGHT = 56;
const DAILY_START_HOUR = 8;
const DAILY_END_HOUR = 20;
const DAILY_NOW_HOUR = 14;

const DAILY_CATEGORIES = [
	{ id: "clinic", label: "Clinic" },
	{ id: "patients", label: "Patients" },
	{ id: "admin", label: "Admin" },
	{ id: "personal", label: "Personal" },
] satisfies { id: DailyCategory; label: string }[];

interface DailyEvent {
	title: string;
	note: string;
	start: number;
	end: number;
	cat: DailyCategory;
	star?: boolean;
	col?: number;
	cols?: number;
}

const DAILY_DAYS: { label: string; date: Date; events: DailyEvent[] }[] = [
	{
		label: "Monday",
		date: new Date(2026, 0, 12),
		events: [
			{
				title: "Ward 4 rounds",
				note: "Discharge check for Ravi Kumar",
				start: 8,
				end: 9,
				cat: "patients",
			},
			{
				title: "Morning standup",
				note: "Front desk + nursing",
				start: 9,
				end: 10,
				cat: "clinic",
			},
			{
				title: "Consultations",
				note: "Six appointments, one flagged panel",
				start: 10,
				end: 13,
				cat: "patients",
				star: true,
			},
			{ title: "Lunch", note: "", start: 13, end: 14, cat: "personal" },
			{
				title: "Invoice reminders",
				note: "Review wording before they send",
				start: 14,
				end: 15,
				cat: "admin",
			},
			{
				title: "Team meeting",
				note: "Weekly review prep",
				start: 15,
				end: 16,
				cat: "clinic",
			},
		],
	},
	{
		label: "Tuesday",
		date: new Date(2026, 0, 13),
		events: [
			{ title: "Morning standup", note: "", start: 9, end: 9.5, cat: "clinic" },
			{
				title: "Vaccination camp prep",
				note: "Cold-chain check with Meera",
				start: 10,
				end: 12,
				cat: "patients",
				star: true,
			},
			{
				title: "Supplier call",
				note: "Gauze & gloves order",
				start: 12,
				end: 12.5,
				cat: "admin",
			},
			{
				title: "Check-up block",
				note: "Four follow-ups",
				start: 14,
				end: 16,
				cat: "patients",
				col: 0,
				cols: 2,
			},
			{
				title: "Call with the lab",
				note: "Overnight reports protocol",
				start: 15,
				end: 16,
				cat: "clinic",
				col: 1,
				cols: 2,
			},
			{
				title: "Weekly review",
				note: "KPIs + stock",
				start: 16,
				end: 18,
				cat: "clinic",
			},
		],
	},
	{
		label: "Wednesday",
		date: new Date(2026, 0, 14),
		events: [
			{ title: "Ward 4 rounds", note: "", start: 8, end: 9, cat: "patients" },
			{
				title: "Staff 1:1 — Dev",
				note: "Invoice workflow",
				start: 11,
				end: 12,
				cat: "clinic",
			},
			{
				title: "Consent paperwork",
				note: "Sana Sheikh intake",
				start: 13,
				end: 14,
				cat: "admin",
			},
			{
				title: "Evening consultations",
				note: "Walk-ins until close",
				start: 17,
				end: 19,
				cat: "patients",
				star: true,
			},
		],
	},
];

const DAILY_NAV = [
	{ icon: CalendarDays, label: "Calendar", active: true },
	{ icon: ClipboardList, label: "Tasks" },
	{ icon: Users, label: "Patients" },
	{ icon: FolderOpen, label: "Folders" },
	{ icon: BarChart3, label: "Reports" },
];
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
});
const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "short" });

function weekStartFor(date: Date) {
	const start = new Date(date);
	const offset = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - offset);
	return start;
}

function formatHour(hour: number) {
	const whole = Math.floor(hour);
	const minutes = hour % 1 ? "30" : "00";
	const suffix = whole < 12 ? "AM" : "PM";
	const hour12 = whole % 12 === 0 ? 12 : whole % 12;
	return `${hour12}:${minutes} ${suffix}`;
}

function WeekView({ anchor }: { anchor: Date }) {
	const weekStart = weekStartFor(anchor);
	const days = Array.from(
		{ length: 7 },
		(_, index) =>
			new Date(
				weekStart.getFullYear(),
				weekStart.getMonth(),
				weekStart.getDate() + index,
			),
	);

	return (
		<section className="mock-cal__week" aria-label="Weekly calendar view">
			<style jsx>{calendarSceneStyles}</style>
			<div className="mock-cal__week-head">
				<span className="mock-cal__week-tz">UTC +5:30</span>
				{days.map((day) => (
					<div
						key={day.toISOString()}
						className={day.getDate() === 10 ? "is-today" : ""}
					>
						<strong>{day.getDate()}</strong>
						<span>{WEEKDAY_LABEL.format(day)}</span>
					</div>
				))}
			</div>
			<div className="mock-cal__week-grid">
				<div className="mock-cal__week-hours">
					{WEEK_HOURS.map((hour) => (
						<span key={hour}>{formatHour(hour)}</span>
					))}
				</div>
				<div className="mock-cal__week-lanes">
					{days.map((day, dayIndex) => (
						<div key={day.toISOString()} className="mock-cal__week-lane">
							{WEEK_EVENTS.filter((event) => event.day === dayIndex).map(
								(event) => (
									<article
										key={event.id}
										className={`mock-cal__week-event mock-cal__week-event--${event.tone}`}
										style={{
											top:
												(event.start - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT + 8,
											height: (event.end - event.start) * WEEK_HOUR_HEIGHT - 10,
										}}
									>
										<strong>{event.title}</strong>
										<span className="mock-cal__week-time">
											<Clock aria-hidden="true" /> {formatHour(event.start)} –{" "}
											{formatHour(event.end)}
										</span>
										{event.people.length > 0 ? (
											<span className="mock-cal__week-people">
												{event.people.slice(0, 3).map((person) => (
													<Avatar key={person} name={person} size="sm" />
												))}
											</span>
										) : null}
									</article>
								),
							)}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function DailyView() {
	const [dayIndex, setDayIndex] = useState(0);
	const [enabled, setEnabled] = useState<Record<DailyCategory, boolean>>({
		clinic: true,
		patients: true,
		admin: true,
		personal: true,
	});
	const [done, setDone] = useState<Set<string>>(() => {
		const initial = new Set<string>();
		DAILY_DAYS.forEach((day, currentDayIndex) =>
			day.events.forEach((event, eventIndex) => {
				if (event.end <= DAILY_NOW_HOUR) {
					initial.add(`${currentDayIndex}-${eventIndex}`);
				}
			}),
		);
		return initial;
	});

	const day = DAILY_DAYS[dayIndex];
	const visible = useMemo(
		() => day.events.filter((event) => enabled[event.cat]),
		[day.events, enabled],
	);

	function toggleDone(id: string) {
		setDone((current) => {
			const next = new Set(current);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	return (
		<div className="mock-cal__daily">
			<style jsx>{calendarSceneStyles}</style>
			<aside className="mock-cal__daily-rail">
				<div className="mock-cal__daily-profile">
					<Avatar name="Asha Verma" size="lg" />
					<strong>Asha Verma</strong>
					<Badge tone="rose" size="sm">
						Clinic admin
					</Badge>
				</div>
				<nav className="mock-cal__daily-nav" aria-label="Daily calendar menu">
					<span className="mock-cal__daily-label">Menu</span>
					{DAILY_NAV.map((item) => (
						<span
							key={item.label}
							className={
								item.active
									? "mock-cal__daily-navitem is-active"
									: "mock-cal__daily-navitem"
							}
						>
							<item.icon aria-hidden="true" />
							{item.label}
						</span>
					))}
				</nav>
				<div className="mock-cal__daily-cats">
					<span className="mock-cal__daily-label">Categories</span>
					<div className="mock-cal__daily-chips">
						{DAILY_CATEGORIES.map((category) => (
							<button
								key={category.id}
								className={
									enabled[category.id]
										? `mock-cal__daily-chip mock-cal__daily-chip--${category.id}`
										: `mock-cal__daily-chip mock-cal__daily-chip--${category.id} is-off`
								}
								onClick={() =>
									setEnabled((current) => ({
										...current,
										[category.id]: !current[category.id],
									}))
								}
								aria-pressed={enabled[category.id]}
							>
								{category.label}
							</button>
						))}
					</div>
				</div>
				<span className="mock-cal__daily-settings">
					<Settings aria-hidden="true" /> Settings
				</span>
			</aside>
			<main className="mock-cal__daily-day">
				<div className="mock-cal__daily-timeline">
					<div className="mock-cal__daily-hours">
						{Array.from(
							{ length: DAILY_END_HOUR - DAILY_START_HOUR },
							(_, hourIndex) => (
								<span key={hourIndex}>
									{formatHour(DAILY_START_HOUR + hourIndex)}
								</span>
							),
						)}
					</div>
					<div className="mock-cal__daily-lane">
						{Array.from(
							{ length: DAILY_END_HOUR - DAILY_START_HOUR },
							(_, hourIndex) => (
								<i key={hourIndex} />
							),
						)}
						<span
							className="mock-cal__daily-now"
							style={{
								top: (DAILY_NOW_HOUR - DAILY_START_HOUR) * DAILY_HOUR_HEIGHT,
							}}
						>
							<em>{formatHour(DAILY_NOW_HOUR)}</em>
						</span>
						{visible.map((event) => {
							const cols = event.cols ?? 1;
							const col = event.col ?? 0;
							const id = `${dayIndex}-${day.events.indexOf(event)}`;
							return (
								<div
									key={id}
									className={`mock-cal__daily-event mock-cal__daily-event--${event.cat}`}
									style={{
										top:
											(event.start - DAILY_START_HOUR) * DAILY_HOUR_HEIGHT + 3,
										height: (event.end - event.start) * DAILY_HOUR_HEIGHT - 7,
										left: `calc(${(col / cols) * 100}% + 4px)`,
										width: `calc(${100 / cols}% - 10px)`,
									}}
								>
									<strong>{event.title}</strong>
									{event.note ? (
										<span className="mock-cal__daily-note">{event.note}</span>
									) : null}
									<span className="mock-cal__daily-meta">
										{formatHour(event.start)} – {formatHour(event.end)} · Dr.
										Asha
									</span>
									{event.star ? (
										<Star aria-hidden="true" className="mock-cal__daily-star" />
									) : null}
									{done.has(id) ? (
										<span className="mock-cal__daily-done">Done</span>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
			</main>
			<aside className="mock-cal__daily-side">
				<header className="mock-cal__daily-sidehead">
					<IconButton
						icon={<ChevronLeft />}
						label="Previous day"
						variant="ghost"
						size="sm"
						onClick={() =>
							setDayIndex(
								(index) => (index + DAILY_DAYS.length - 1) % DAILY_DAYS.length,
							)
						}
					/>
					<h3>
						{day.label} · <span>{day.date.getDate()} January</span>
					</h3>
					<IconButton
						icon={<ChevronRight />}
						label="Next day"
						variant="ghost"
						size="sm"
						onClick={() =>
							setDayIndex((index) => (index + 1) % DAILY_DAYS.length)
						}
					/>
				</header>
				<div className="mock-cal__daily-mini">
					<Calendar
						mode="single"
						selected={day.date}
						onSelect={(date) => {
							if (!date) return;
							const nextIndex = DAILY_DAYS.findIndex(
								(current) =>
									current.date.toDateString() === date.toDateString(),
							);
							if (nextIndex >= 0) {
								setDayIndex(nextIndex);
							}
						}}
						month={day.date}
						onMonthChange={() => {}}
					/>
				</div>
				<div className="mock-cal__daily-agenda">
					{day.events.map((event, eventIndex) => {
						const id = `${dayIndex}-${eventIndex}`;
						const isDone = done.has(id);
						const off = !enabled[event.cat];
						return (
							<button
								key={id}
								className={
									"mock-cal__daily-agitem" +
									(isDone ? " is-done" : "") +
									(off ? " is-off" : "")
								}
								onClick={() => toggleDone(id)}
								disabled={off}
							>
								<span className="mock-cal__daily-agcheck">
									{isDone ? (
										<CheckCircle2 aria-hidden="true" />
									) : (
										<Circle aria-hidden="true" />
									)}
								</span>
								<span className="mock-cal__daily-agtime">
									{formatHour(event.start)}
								</span>
								<span className="mock-cal__daily-agtitle">{event.title}</span>
							</button>
						);
					})}
				</div>
				<Button variant="secondary" size="sm">
					+ Add event
				</Button>
			</aside>
		</div>
	);
}

export function CalendarScene() {
	const [month, setMonth] = useState(new Date(2026, 0, 1));
	const [tab, setTab] = useState("all");
	const [query, setQuery] = useState("");
	const [view, setView] = useState<CalendarView>("month");
	const [events, setEvents] = useState<MockEvent[]>(EVENTS);
	const [addOpen, setAddOpen] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newDate, setNewDate] = useState<Date | undefined>();
	const [newTime, setNewTime] = useState<Date | undefined>();
	const [newTone, setNewTone] = useState<CalTone>("cobalt");

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		return events.filter((e) => {
			if (tab === "shared" && e.cal !== "shared") return false;
			if (tab === "public" && e.cal !== "public") return false;
			if (q && !e.title.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [events, tab, query]);

	function shiftPeriod(dir: number) {
		setMonth((m) =>
			view === "month"
				? new Date(m.getFullYear(), m.getMonth() + dir, 1)
				: new Date(
						m.getFullYear(),
						m.getMonth(),
						m.getDate() + dir * (view === "week" ? 7 : 1),
					),
		);
	}

	function openAdd(day?: Date) {
		setNewDate(day ?? new Date(2026, 0, 10));
		setNewTime(undefined);
		setNewTitle("");
		setAddOpen(true);
	}

	function addEvent() {
		if (!newTitle.trim() || !newDate) return;
		const time = newTime
			? new Intl.DateTimeFormat("en-US", {
					hour: "numeric",
					minute: "2-digit",
				}).format(newTime)
			: undefined;
		const iso = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
		setEvents((cur) => [
			...cur,
			{
				id: `new-${Date.now()}`,
				date: iso,
				title: newTitle.trim(),
				time,
				tone: newTone,
				cal: "team",
			},
		]);
		setAddOpen(false);
	}

	const monthEvents = visible.filter(
		(e) =>
			Number(e.date.slice(5, 7)) === month.getMonth() + 1 &&
			Number(e.date.slice(0, 4)) === month.getFullYear(),
	);

	const listDays = useMemo(() => {
		const map = new Map<string, MockEvent[]>();
		for (const e of monthEvents) {
			const list = map.get(e.date) ?? [];
			list.push(e);
			map.set(e.date, list);
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [monthEvents]);

	return (
		<div className="mock-cal">
			<style jsx>{calendarSceneStyles}</style>
			<header className="mock-cal__head">
				<h2>Calendar</h2>
				<div className="mock-cal__search">
					<SearchInput
						placeholder="Search events…"
						aria-label="Search events"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
			</header>

			<Tabs
				aria-label="Calendars"
				value={tab}
				onValueChange={setTab}
				items={[
					{ id: "all", label: "All events" },
					{ id: "shared", label: "Shared" },
					{ id: "public", label: "Public" },
					{ id: "archived", label: "Archived" },
				]}
			/>

			{tab === "archived" ? (
				<div className="mock-cal__empty">
					<p>Nothing archived. Events you archive will rest here.</p>
				</div>
			) : (
				<div className="mock-cal__card">
					<div className="mock-cal__toolbar">
						<div className="mock-cal__monthchip">
							<span className="mock-cal__monthchip-mon">
								{SHORT_MONTH.format(month)}
							</span>
							<b className="tw-tnum">10</b>
						</div>
						<div className="mock-cal__monthlabel">
							<strong>{MONTH_LABEL.format(month)}</strong>
							<span className="tw-tnum">
								{MONTH_LABEL.format(month).split(" ")[0]} 1 –{" "}
								{new Date(
									month.getFullYear(),
									month.getMonth() + 1,
									0,
								).getDate()}
								, {month.getFullYear()}
							</span>
						</div>
						<div className="mock-cal__tools">
							<IconButton
								label={
									view === "week"
										? "Previous week"
										: view === "day"
											? "Previous day"
											: "Previous month"
								}
								icon={<ChevronLeft />}
								variant="secondary"
								onClick={() => shiftPeriod(-1)}
							/>
							<Button
								size="sm"
								variant="secondary"
								onClick={() => setMonth(new Date())}
							>
								Today
							</Button>
							<IconButton
								label={
									view === "week"
										? "Next week"
										: view === "day"
											? "Next day"
											: "Next month"
								}
								icon={<ChevronRight />}
								variant="secondary"
								onClick={() => shiftPeriod(1)}
							/>
							<div style={{ width: 130 }}>
								<Select
									aria-label="View"
									value={view}
									onValueChange={(value) => setView(value as CalendarView)}
									options={
										[
											{ value: "month", label: "Month view" },
											{ value: "week", label: "Week view" },
											{ value: "day", label: "Day view" },
											{ value: "list", label: "List view" },
										] as { value: CalendarView; label: string }[]
									}
								/>
							</div>
							<Button size="sm" onClick={() => openAdd()}>
								<Plus size={14} aria-hidden="true" />
								Add event
							</Button>
						</div>
					</div>

					{view === "month" ? (
						<MonthCalendar
							month={month}
							events={visible}
							today={new Date(2026, 0, 10)}
							onSelectDay={(d) => openAdd(d)}
						/>
					) : view === "week" ? (
						<WeekView anchor={month} />
					) : view === "day" ? (
						<DailyView />
					) : (
						<div className="mock-cal__list">
							{listDays.length === 0 ? (
								<p className="mock-cal__empty">No events this month.</p>
							) : (
								listDays.map(([date, evs]) => (
									<div key={date} className="mock-cal__listday">
										<span className="mock-cal__listdate tw-tnum">
											{new Intl.DateTimeFormat("en-US", {
												weekday: "short",
												month: "short",
												day: "numeric",
											}).format(new Date(date + "T12:00:00"))}
										</span>
										<div className="mock-cal__listevents">
											{evs.map((e) => (
												<span
													key={e.id}
													className={`tw-mcal__ev tw-mcal__ev--${e.tone ?? "cobalt"}`}
												>
													<span className="tw-mcal__ev-title">{e.title}</span>
													{e.time ? (
														<span className="tw-mcal__ev-time tw-tnum">
															{e.time}
														</span>
													) : null}
												</span>
											))}
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>
			)}

			<Dialog
				open={addOpen}
				onClose={() => setAddOpen(false)}
				title="Add event"
				footer={
					<>
						<Button variant="ghost" onClick={() => setAddOpen(false)}>
							Cancel
						</Button>
						<Button onClick={addEvent} disabled={!newTitle.trim() || !newDate}>
							Add event
						</Button>
					</>
				}
			>
				<div className="mock-cal__form">
					<Input
						label="Title"
						placeholder="Dentist appointment"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
					/>
					<DatePicker label="Date" value={newDate} onValueChange={setNewDate} />
					<TimePicker
						label="Time"
						value={newTime}
						onValueChange={setNewTime}
						placeholder="No time set"
					/>
					<Select
						label="Color"
						value={newTone}
						onValueChange={(v) => setNewTone(v as CalTone)}
						options={[
							{ value: "cobalt", label: "Cobalt" },
							{ value: "rose", label: "Rose" },
							{ value: "warning", label: "Amber" },
							{ value: "neutral", label: "Neutral" },
							{ value: "danger", label: "Urgent" },
						]}
					/>
				</div>
			</Dialog>
		</div>
	);
}
