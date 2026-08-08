import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Calendar, IconButton } from "@twodb/ui";
import {
	BarChart3,
	CalendarDays,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Circle,
	ClipboardList,
	FolderOpen,
	Settings,
	Star,
	Users,
} from "lucide-react";
import "./DailyCal.css";

const HOUR_H = 56;
const DAY_START = 8;
const DAY_END = 20;
const NOW = 14; /* the now-line sits at 14:00, like the reference */

const CATS = [
	{
		id: "clinic",
		label: "Clinic",
		color: "#3a55ff",
		tint: "var(--accent-soft-bg)",
	},
	{
		id: "patients",
		label: "Patients",
		color: "#0f9d8f",
		tint: "rgb(15 157 143 / 0.10)",
	},
	{
		id: "admin",
		label: "Admin",
		color: "#7c3aed",
		tint: "rgb(124 58 237 / 0.10)",
	},
	{
		id: "personal",
		label: "Personal",
		color: "#d9a03f",
		tint: "rgb(217 160 63 / 0.14)",
	},
];

interface DayEvent {
	title: string;
	note: string;
	start: number;
	end: number;
	cat: string;
	star?: boolean;
	col?: number /* overlapping cards share the lane */;
	cols?: number;
}

const DAYS: { label: string; date: Date; events: DayEvent[] }[] = [
	{
		label: "Monday",
		date: new Date(2024, 2, 11),
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
		date: new Date(2024, 2, 12),
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
		date: new Date(2024, 2, 13),
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

const NAV = [
	{ icon: CalendarDays, label: "Calendar", active: true },
	{ icon: ClipboardList, label: "Tasks" },
	{ icon: Users, label: "Patients" },
	{ icon: FolderOpen, label: "Folders" },
	{ icon: BarChart3, label: "Reports" },
];

function fmt(h: number): string {
	const hh = Math.floor(h);
	const mm = h % 1 ? "30" : "00";
	return `${String(hh).padStart(2, "0")}:${mm}`;
}

export function DailyCalMock() {
	const [dayIdx, setDayIdx] = useState(0);
	const [enabled, setEnabled] = useState<Record<string, boolean>>(
		Object.fromEntries(CATS.map((c) => [c.id, true])),
	);
	const [done, setDone] = useState<Set<string>>(() => {
		/* events ending before the now-line start as done */
		const s = new Set<string>();
		DAYS.forEach((d, di) =>
			d.events.forEach((e, ei) => {
				if (e.end <= NOW) s.add(`${di}-${ei}`);
			}),
		);
		return s;
	});

	const day = DAYS[dayIdx];
	const visible = useMemo(
		() => day.events.filter((e) => enabled[e.cat]),
		[day, enabled],
	);

	const toggleDone = (id: string) =>
		setDone((s) => {
			const n = new Set(s);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});

	return (
		<div className="mock-dc">
			{/* left rail */}
			<aside className="mock-dc__rail">
				<div className="mock-dc__profile">
					<Avatar name="Asha Verma" size="lg" />
					<strong>Asha Verma</strong>
					<Badge tone="rose" size="sm">
						Clinic admin
					</Badge>
				</div>
				<nav className="mock-dc__nav" aria-label="Menu">
					<span className="mock-dc__navlabel">Menu</span>
					{NAV.map((n) => (
						<span
							className={
								n.active ? "mock-dc__navitem is-active" : "mock-dc__navitem"
							}
							key={n.label}
						>
							<n.icon aria-hidden="true" />
							{n.label}
						</span>
					))}
				</nav>
				<div className="mock-dc__cats">
					<span className="mock-dc__navlabel">Categories</span>
					<div className="mock-dc__chips">
						{CATS.map((c) => (
							<button
								className={
									enabled[c.id] ? "mock-dc__chip" : "mock-dc__chip is-off"
								}
								style={{ background: c.color }}
								key={c.id}
								onClick={() => setEnabled((m) => ({ ...m, [c.id]: !m[c.id] }))}
								aria-pressed={enabled[c.id]}
							>
								{c.label}
							</button>
						))}
					</div>
				</div>
				<span className="mock-dc__settings">
					<Settings aria-hidden="true" /> Settings
				</span>
			</aside>

			{/* day timeline */}
			<main className="mock-dc__day">
				<div className="mock-dc__timeline">
					<div className="mock-dc__hours">
						{Array.from({ length: DAY_END - DAY_START }, (_, i) => (
							<span key={i} style={{ height: HOUR_H }}>
								{fmt(DAY_START + i)}
							</span>
						))}
					</div>
					<div className="mock-dc__lane">
						{Array.from({ length: DAY_END - DAY_START }, (_, i) => (
							<i key={i} style={{ height: HOUR_H }} />
						))}
						{/* now-line */}
						<span
							className="mock-dc__now"
							style={{ top: (NOW - DAY_START) * HOUR_H }}
						>
							<em>{fmt(NOW)}</em>
						</span>
						{visible.map((e, i) => {
							const cat = CATS.find((c) => c.id === e.cat)!;
							const cols = e.cols ?? 1;
							const col = e.col ?? 0;
							const id = `${dayIdx}-${day.events.indexOf(e)}`;
							return (
								<div
									className="mock-dc__event"
									key={i}
									style={{
										top: (e.start - DAY_START) * HOUR_H + 3,
										height: (e.end - e.start) * HOUR_H - 7,
										left: `calc(${(col / cols) * 100}% + 4px)`,
										width: `calc(${100 / cols}% - 10px)`,
										background: cat.tint,
										borderLeftColor: cat.color,
									}}
								>
									<strong>{e.title}</strong>
									{e.note ? (
										<span className="mock-dc__enote">{e.note}</span>
									) : null}
									<span className="mock-dc__emeta">
										{fmt(e.start)} – {fmt(e.end)} · Dr. Asha
									</span>
									{e.star ? (
										<Star aria-hidden="true" className="mock-dc__estar" />
									) : null}
									{done.has(id) ? (
										<span className="mock-dc__edone">Done</span>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
			</main>

			{/* right panel */}
			<aside className="mock-dc__side">
				<header className="mock-dc__sidehead">
					<IconButton
						icon={<ChevronLeft />}
						label="Previous day"
						variant="ghost"
						size="sm"
						onClick={() =>
							setDayIdx((i) => (i + DAYS.length - 1) % DAYS.length)
						}
					/>
					<h3>
						{day.label} · <span>{day.date.getDate()} March</span>
					</h3>
					<IconButton
						icon={<ChevronRight />}
						label="Next day"
						variant="ghost"
						size="sm"
						onClick={() => setDayIdx((i) => (i + 1) % DAYS.length)}
					/>
				</header>

				<div className="mock-dc__mini">
					<Calendar
						mode="single"
						selected={day.date}
						onSelect={(d) => {
							if (!d) return;
							const i = DAYS.findIndex(
								(x) => x.date.toDateString() === d.toDateString(),
							);
							if (i >= 0) setDayIdx(i);
						}}
						month={day.date}
						onMonthChange={() => {}}
					/>
				</div>

				<div className="mock-dc__agenda">
					{day.events.map((e, ei) => {
						const id = `${dayIdx}-${ei}`;
						const isDone = done.has(id);
						const off = !enabled[e.cat];
						return (
							<button
								className={
									"mock-dc__agitem" +
									(isDone ? " is-done" : "") +
									(off ? " is-off" : "")
								}
								key={ei}
								onClick={() => toggleDone(id)}
								disabled={off}
							>
								<span className="mock-dc__agcheck">
									{isDone ? (
										<CheckCircle2 aria-hidden="true" />
									) : (
										<Circle aria-hidden="true" />
									)}
								</span>
								<span className="mock-dc__agtime">{fmt(e.start)}</span>
								<span className="mock-dc__agtitle">{e.title}</span>
							</button>
						);
					})}
					{!day.events.length ? (
						<p className="mock-dc__agempty">Nothing scheduled.</p>
					) : null}
				</div>
				<Button variant="secondary" size="sm">
					+ Add event
				</Button>
			</aside>
		</div>
	);
}
