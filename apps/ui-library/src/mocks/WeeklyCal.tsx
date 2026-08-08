import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Calendar, Checkbox, Tabs } from "@twodb/ui";
import {
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
} from "lucide-react";
import "./WeeklyCal.css";

const HOUR_H = 64;
const DAY_START = 8; /* 08:00 */
const DAY_END = 15; /* 15:00 */

const CATS = [
	{
		id: "standup",
		label: "Standups",
		color: "#c2285a",
		tint: "var(--rose-soft-bg)",
	},
	{
		id: "patients",
		label: "Appointments",
		color: "#0f9d8f",
		tint: "rgb(15 157 143 / 0.10)",
	},
	{
		id: "meetings",
		label: "Meetings",
		color: "#3a55ff",
		tint: "var(--accent-soft-bg)",
	},
	{
		id: "breaks",
		label: "Breaks",
		color: "#d9a03f",
		tint: "rgb(217 160 63 / 0.14)",
	},
	{
		id: "admin",
		label: "Admin",
		color: "#7c3aed",
		tint: "rgb(124 58 237 / 0.10)",
	},
];

interface CalEvent {
	title: string;
	day: number /* 0 = Monday */;
	start: number /* decimal hours */;
	end: number;
	cat: string;
	people: string[];
	more?: number;
}

const EVENTS: CalEvent[] = [
	{
		title: "Morning standup",
		day: 0,
		start: 9,
		end: 10,
		cat: "standup",
		people: ["Asha Verma", "Ravi Kumar", "Dev Patel"],
		more: 3,
	},
	{
		title: "Stock intake check",
		day: 0,
		start: 11,
		end: 12,
		cat: "admin",
		people: ["Dev Patel"],
	},
	{
		title: "Weekly review",
		day: 1,
		start: 10,
		end: 12,
		cat: "meetings",
		people: ["Asha Verma", "Meera Iyer", "Ravi Kumar"],
		more: 2,
	},
	{
		title: "Supplier call",
		day: 1,
		start: 12.5,
		end: 13.5,
		cat: "admin",
		people: ["Dev Patel"],
	},
	{
		title: "Check-up block",
		day: 2,
		start: 9,
		end: 10,
		cat: "patients",
		people: ["Meera Iyer"],
		more: 6,
	},
	{
		title: "Invoice reminders review",
		day: 2,
		start: 12,
		end: 13,
		cat: "admin",
		people: ["Asha Verma", "Dev Patel"],
	},
	{
		title: "Team meeting",
		day: 3,
		start: 9.5,
		end: 10.5,
		cat: "meetings",
		people: ["Asha Verma", "Meera Iyer"],
		more: 5,
	},
	{
		title: "Lunch break",
		day: 3,
		start: 12,
		end: 13,
		cat: "breaks",
		people: [],
	},
	{
		title: "Ward 4 rounds",
		day: 4,
		start: 8,
		end: 9,
		cat: "patients",
		people: ["Asha Verma", "Ravi Kumar"],
	},
	{
		title: "Pharma order review",
		day: 4,
		start: 11,
		end: 12,
		cat: "admin",
		people: ["Dev Patel", "Meera Iyer"],
	},
	{
		title: "Vaccination camp",
		day: 5,
		start: 10,
		end: 12,
		cat: "patients",
		people: ["Meera Iyer", "Ravi Kumar"],
		more: 8,
	},
];

const DAY_NAMES = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

function mondayOf(d: Date): Date {
	const m = new Date(d);
	const off = (m.getDay() + 6) % 7;
	m.setDate(m.getDate() - off);
	return m;
}

function fmtHour(h: number): string {
	const hh = Math.floor(h);
	const mm = h % 1 ? "30" : "00";
	const ap = hh < 12 ? "AM" : "PM";
	const h12 = hh % 12 === 0 ? 12 : hh % 12;
	return `${String(h12).padStart(2, "0")}:${mm} ${ap}`;
}

export function WeeklyCalMock() {
	const [anchor, setAnchor] = useState(
		() => new Date(2024, 2, 7),
	); /* Thu 7 Mar 2024 */
	const [enabled, setEnabled] = useState<Record<string, boolean>>(
		Object.fromEntries(CATS.map((c) => [c.id, true])),
	);
	const [view, setView] = useState("week");

	const weekStart = mondayOf(anchor);
	const days = useMemo(
		() =>
			Array.from(
				{ length: 7 },
				(_, i) =>
					new Date(
						weekStart.getFullYear(),
						weekStart.getMonth(),
						weekStart.getDate() + i,
					),
			),
		[weekStart.getTime()],
	);

	const shift = (n: number) =>
		setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + n));

	const visible = EVENTS.filter(
		(e) =>
			enabled[e.cat] && (view !== "day" || e.day === (anchor.getDay() + 6) % 7),
	);
	const cols = view === "day" ? 1 : 7;

	return (
		<div className="mock-wc">
			{/* sidebar */}
			<aside className="mock-wc__side">
				<div className="mock-wc__calsel">
					<CalendarDays aria-hidden="true" />
					<div>
						<strong>All calendars</strong>
						<span>Clinic, personal</span>
					</div>
					<ChevronDown aria-hidden="true" className="mock-wc__chev" />
				</div>

				<div className="mock-wc__mini">
					<Calendar
						mode="single"
						selected={anchor}
						onSelect={(d) => d && setAnchor(d)}
						month={anchor}
						onMonthChange={setAnchor}
					/>
				</div>

				<div className="mock-wc__group">
					<h4>My schedule</h4>
					{CATS.map((c) => (
						<label className="mock-wc__filter" key={c.id}>
							<Checkbox
								checked={enabled[c.id]}
								onChange={(e) =>
									setEnabled((m) => ({ ...m, [c.id]: e.target.checked }))
								}
								aria-label={`Show ${c.label}`}
							/>
							<i style={{ background: c.color }} />
							{c.label}
							<span>{EVENTS.filter((e) => e.cat === c.id).length}</span>
						</label>
					))}
				</div>
			</aside>

			{/* main */}
			<main className="mock-wc__main">
				<header className="mock-wc__head">
					<div>
						<span className="mock-wc__crumb">Calendar / All calendars</span>
						<h2>
							{MONTHS[weekStart.getMonth()]}, {weekStart.getFullYear()}
						</h2>
						<Badge tone="neutral">
							{visible.length} events this {view === "day" ? "day" : "week"}
						</Badge>
					</div>
					<div className="mock-wc__headctl">
						<Tabs
							aria-label="Calendar view"
							items={[
								{ id: "day", label: "Day" },
								{ id: "week", label: "Week" },
								{ id: "month", label: "Month" },
							]}
							value={view}
							onValueChange={setView}
						/>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => shift(view === "day" ? -1 : -7)}
							aria-label="Previous"
						>
							<ChevronLeft aria-hidden="true" />
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setAnchor(new Date(2024, 2, 7))}
						>
							Today
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => shift(view === "day" ? 1 : 7)}
							aria-label="Next"
						>
							<ChevronRight aria-hidden="true" />
						</Button>
					</div>
				</header>

				{view === "month" ? (
					<div className="mock-wc__monthview">
						<Calendar
							mode="single"
							selected={anchor}
							onSelect={(d) => {
								if (d) {
									setAnchor(d);
									setView("week");
								}
							}}
							month={anchor}
							onMonthChange={setAnchor}
						/>
						<p className="mock-wc__monthhint">
							Pick a day to jump into its week.
						</p>
					</div>
				) : (
					<div
						className="mock-wc__grid"
						style={{
							gridTemplateColumns: `52px repeat(${cols}, minmax(0, 1fr))`,
						}}
					>
						{/* day header row */}
						<span className="mock-wc__tz">UTC +5:30</span>
						{(view === "day" ? [anchor] : days).map((d, i) => (
							<div
								className={
									d.toDateString() === anchor.toDateString()
										? "mock-wc__dhead is-today"
										: "mock-wc__dhead"
								}
								key={i}
							>
								<strong>{d.getDate()}</strong>
								<span>{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
							</div>
						))}

						{/* body */}
						<div className="mock-wc__hours">
							{Array.from({ length: DAY_END - DAY_START }, (_, i) => (
								<span key={i} style={{ height: HOUR_H }}>
									{fmtHour(DAY_START + i)}
								</span>
							))}
						</div>
						{Array.from({ length: cols }, (_, c) => (
							<div className="mock-wc__col" key={c}>
								{Array.from({ length: DAY_END - DAY_START }, (_, i) => (
									<i key={i} style={{ height: HOUR_H }} />
								))}
								{visible
									.filter((e) => (view === "day" ? true : e.day === c))
									.map((e, j) => {
										const cat = CATS.find((k) => k.id === e.cat)!;
										return (
											<button
												className="mock-wc__event"
												key={j}
												style={{
													top: (e.start - DAY_START) * HOUR_H + 2,
													height: (e.end - e.start) * HOUR_H - 6,
													background: cat.tint,
													borderLeftColor: cat.color,
												}}
											>
												<strong>{e.title}</strong>
												<span className="mock-wc__etime">
													<Clock aria-hidden="true" /> {fmtHour(e.start)} –{" "}
													{fmtHour(e.end)}
												</span>
												{e.people.length ? (
													<span className="mock-wc__epeople">
														{e.people.map((p) => (
															<Avatar name={p} size="sm" key={p} />
														))}
														{e.more ? <em>+{e.more}</em> : null}
													</span>
												) : null}
											</button>
										);
									})}
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
