import { useMemo, useState } from "react";
import {
	Avatar,
	Button,
	Calendar,
	IconButton,
	Menu,
	MenuItem,
} from "@twodb/ui";
import {
	Bell,
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	MapPin,
	Plus,
	Search,
} from "lucide-react";
import "./AgendaCalendar.css";

/* ── grid constants ───────────────────────────────────────────
   7:00–20:00, one row per hour. The now-line sits at 11:15.   */

const HOUR_H = 48;
const DAY_START = 7;
const DAY_END = 20;
const NOW = 11.25; /* 11:15 */

type CatId = "work" | "personal" | "family" | "health";

const CATS: { id: CatId; label: string; color: string; tint: string }[] = [
	{
		id: "work",
		label: "Work",
		color: "#3a55ff",
		tint: "rgb(58 85 255 / 0.16)",
	},
	{
		id: "personal",
		label: "Personal",
		color: "#c34bff",
		tint: "rgb(195 75 255 / 0.16)",
	},
	{
		id: "family",
		label: "Family",
		color: "#f59e0b",
		tint: "rgb(245 158 11 / 0.18)",
	},
	{
		id: "health",
		label: "Health",
		color: "#16a34a",
		tint: "rgb(22 163 74 / 0.16)",
	},
];

function cat(id: CatId) {
	return CATS.find((c) => c.id === id)!;
}

interface Evt {
	title: string;
	sub?: string;
	start: number;
	end: number;
	cat: CatId;
	attendees?: string[];
}

interface Day {
	dow: string;
	date: number;
	iso: string;
	weekend?: boolean;
	events: Evt[];
}

/* Dec 9–15, 2024. Today = Friday the 13th.                     */
const WEEK: Day[] = [
	{
		dow: "Mon",
		date: 9,
		iso: "2024-12-09",
		events: [
			{ title: "Yoga", start: 7.5, end: 8.5, cat: "health" },
			{
				title: "Sprint kickoff",
				start: 10,
				end: 11,
				cat: "work",
				attendees: ["Maya Chen", "Leo Park", "Iris Vance"],
			},
		],
	},
	{
		dow: "Tue",
		date: 10,
		iso: "2024-12-10",
		events: [
			{ title: "Dentist", start: 9, end: 10, cat: "health" },
			{
				title: "Client call",
				sub: "Acme Corp",
				start: 14,
				end: 15,
				cat: "work",
				attendees: ["Maya Chen", "Sam Rivera"],
			},
		],
	},
	{
		dow: "Wed",
		date: 11,
		iso: "2024-12-11",
		events: [
			{
				title: "Team standup",
				start: 9,
				end: 9.5,
				cat: "work",
				attendees: ["Maya Chen", "Leo Park", "Iris Vance", "Sam Rivera"],
			},
			{
				title: "Dinner with Mark",
				start: 19,
				end: 21,
				cat: "family",
				attendees: ["Maya Chen", "Mark Lee"],
			},
		],
	},
	{
		dow: "Thu",
		date: 12,
		iso: "2024-12-12",
		events: [
			{
				title: "Design sync",
				start: 9.5,
				end: 10.5,
				cat: "personal",
				attendees: ["Maya Chen", "Iris Vance"],
			},
			{ title: "Gym", start: 17, end: 18.5, cat: "health" },
		],
	},
	{
		dow: "Fri",
		date: 13,
		iso: "2024-12-13",
		events: [
			{
				title: "Product review",
				sub: "Room 4A",
				start: 10,
				end: 11.5,
				cat: "work",
				attendees: ["Maya Chen", "Leo Park", "Iris Vance"],
			},
			{
				title: "Lunch with Sarah",
				start: 12.5,
				end: 13.5,
				cat: "family",
				attendees: ["Maya Chen", "Sarah Quinn"],
			},
			{ title: "Weekly planning", start: 15, end: 16, cat: "work" },
		],
	},
	{
		dow: "Sat",
		date: 14,
		iso: "2024-12-14",
		weekend: true,
		events: [{ title: "Farmer's market", start: 9, end: 11, cat: "family" }],
	},
	{
		dow: "Sun",
		date: 15,
		iso: "2024-12-15",
		weekend: true,
		events: [{ title: "Read / relax", start: 14, end: 16, cat: "personal" }],
	},
];

const TODAY_ISO = "2024-12-13";
const TODAY_INDEX = WEEK.findIndex((d) => d.iso === TODAY_ISO);

const VIEWS = [
	{ id: "day", label: "Day", span: 1 },
	{ id: "4days", label: "4 Days", span: 4 },
	{ id: "week", label: "Week", span: 7 },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

const ACCOUNTS = ["Personal", "Work", "Family"];

function fmt(h: number): string {
	const hh = Math.floor(h);
	const mm = Math.round((h - hh) * 60);
	return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function isoOf(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
		d.getDate(),
	).padStart(2, "0")}`;
}

export function AgendaCalendarMock() {
	const [anchor, setAnchor] = useState(TODAY_INDEX);
	const [view, setView] = useState<ViewId>("4days");
	const [on, setOn] = useState<Record<CatId, boolean>>({
		work: true,
		personal: true,
		family: true,
		health: true,
	});
	const [account, setAccount] = useState("Personal");
	const [miniMonth, setMiniMonth] = useState(new Date(2024, 11, 1));

	const viewDef = VIEWS.find((v) => v.id === view)!;

	const days = useMemo<Day[]>(() => {
		if (view === "day") return [WEEK[anchor]];
		if (view === "week") return WEEK;
		/* 4 days: keep today visible — anchor-1 .. anchor+2, clamped */
		const start = Math.max(0, Math.min(anchor - 1, WEEK.length - 4));
		return WEEK.slice(start, start + 4);
	}, [anchor, view]);

	const cols = `58px repeat(${days.length}, minmax(0, 1fr))`;
	const hours = Array.from(
		{ length: DAY_END - DAY_START },
		(_, i) => DAY_START + i,
	);
	const nowTop = (NOW - DAY_START) * HOUR_H;

	const visible = (d: Day) => d.events.filter((e) => on[e.cat]);

	/* the right-hand agenda: today's still-open or upcoming events */
	const today = WEEK[TODAY_INDEX];
	const upcoming = today.events
		.filter((e) => on[e.cat] && e.end > NOW)
		.sort((a, b) => a.start - b.start);

	const monthLabel = "December 2024";

	const shift = (dir: -1 | 1) => {
		if (view === "week") return;
		setAnchor((a) => Math.max(0, Math.min(WEEK.length - 1, a + dir)));
	};

	return (
		<div className="mock-ac">
			{/* ── left: account, mini month, calendars ── */}
			<aside className="mock-ac__side">
				<Menu
					placement="bottom-start"
					trigger={
						<button className="mock-ac__account" type="button">
							<Avatar name="Maya Chen" size="sm" />
							<span className="mock-ac__acctname">{account}</span>
							<ChevronDown aria-hidden="true" />
						</button>
					}
				>
					{ACCOUNTS.map((a) => (
						<MenuItem key={a} onClick={() => setAccount(a)}>
							{a}
						</MenuItem>
					))}
				</Menu>

				<div className="mock-ac__mini">
					<Calendar
						mode="single"
						selected={new Date(2024, 11, 13)}
						month={miniMonth}
						onMonthChange={setMiniMonth}
						onSelect={(d) => {
							if (!d) return;
							const i = WEEK.findIndex((x) => x.iso === isoOf(d));
							if (i >= 0) setAnchor(i);
						}}
					/>
				</div>

				<div className="mock-ac__cals">
					<span className="mock-ac__cue">My calendars</span>
					{CATS.map((c) => (
						<button
							className={"mock-ac__cal" + (on[c.id] ? "" : " is-off")}
							type="button"
							key={c.id}
							onClick={() => setOn((m) => ({ ...m, [c.id]: !m[c.id] }))}
							aria-pressed={on[c.id]}
						>
							<span className="mock-ac__dot" style={{ background: c.color }} />
							{c.label}
						</button>
					))}
				</div>
			</aside>

			{/* ── main: header + multi-day grid ── */}
			<section className="mock-ac__main">
				<header className="mock-ac__head">
					<div className="mock-ac__title">
						<h2>{monthLabel}</h2>
						<span className="mock-ac__headbtns">
							<IconButton
								icon={<ChevronLeft />}
								label="Previous"
								variant="secondary"
								size="sm"
								onClick={() => shift(-1)}
							/>
							<IconButton
								icon={<ChevronRight />}
								label="Next"
								variant="secondary"
								size="sm"
								onClick={() => shift(1)}
							/>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setAnchor(TODAY_INDEX)}
							>
								Today
							</Button>
						</span>
						<Menu
							placement="bottom-start"
							trigger={
								<button className="mock-ac__view" type="button">
									{viewDef.label}
									<ChevronDown aria-hidden="true" />
								</button>
							}
						>
							{VIEWS.map((v) => (
								<MenuItem key={v.id} onClick={() => setView(v.id)}>
									{v.label}
								</MenuItem>
							))}
						</Menu>
					</div>
				</header>

				{/* day-of-week row, aligned to the grid columns */}
				<div className="mock-ac__dayhead" style={{ gridTemplateColumns: cols }}>
					<span aria-hidden="true" />
					{days.map((d) => {
						const isToday = d.iso === TODAY_ISO;
						return (
							<div
								className={
									"mock-ac__daylabel" +
									(d.weekend ? " is-weekend" : "") +
									(isToday ? " is-today" : "")
								}
								key={d.iso}
							>
								<span className="mock-ac__dow">{d.dow}</span>
								<span className="mock-ac__dnum" aria-hidden="true">
									{d.date}
								</span>
							</div>
						);
					})}
				</div>

				<div className="mock-ac__scroll">
					<div className="mock-ac__grid" style={{ gridTemplateColumns: cols }}>
						{/* time gutter */}
						<div className="mock-ac__gutter">
							{hours.map((h) => (
								<span key={h} style={{ height: HOUR_H }}>
									{fmt(h)}
								</span>
							))}
							<span
								className="mock-ac__nowdot"
								style={{ top: nowTop }}
								aria-hidden="true"
							/>
						</div>

						{/* day columns */}
						{days.map((d) => {
							const isToday = d.iso === TODAY_ISO;
							return (
								<div
									className={
										"mock-ac__col" +
										(isToday ? " is-today" : "") +
										(d.weekend ? " is-weekend" : "")
									}
									key={d.iso}
								>
									{hours.map((h) => (
										<i key={h} style={{ height: HOUR_H }} />
									))}
									<span
										className="mock-ac__nowline"
										style={{ top: nowTop }}
										aria-hidden="true"
									/>
									{visible(d).map((e, i) => {
										const c = cat(e.cat);
										return (
											<div
												className="mock-ac__event"
												key={i}
												style={{
													top: (e.start - DAY_START) * HOUR_H + 2,
													height: (e.end - e.start) * HOUR_H - 4,
													background: c.tint,
													borderLeftColor: c.color,
												}}
											>
												<div className="mock-ac__evbody">
													<strong>{e.title}</strong>
													{e.sub ? (
														<span className="mock-ac__evsub">{e.sub}</span>
													) : null}
													<span className="mock-ac__evtime">
														{fmt(e.start)} – {fmt(e.end)}
													</span>
												</div>
												{e.attendees?.length ? (
													<span className="mock-ac__stack" aria-hidden="true">
														{e.attendees.slice(0, 3).map((name) => (
															<Avatar key={name} name={name} size="sm" />
														))}
														{e.attendees.length > 3 ? (
															<span className="mock-ac__more">
																+{e.attendees.length - 3}
															</span>
														) : null}
													</span>
												) : null}
											</div>
										);
									})}
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* ── right: upcoming agenda ── */}
			<aside className="mock-ac__up">
				<header className="mock-ac__uphead">
					<span className="mock-ac__uptools">
						<IconButton
							icon={<Search />}
							label="Search events"
							variant="ghost"
							size="sm"
						/>
						<IconButton
							icon={<Bell />}
							label="Notifications"
							variant="ghost"
							size="sm"
						/>
					</span>
					<Button size="sm">
						<Plus aria-hidden="true" /> New event
					</Button>
				</header>

				<div className="mock-ac__upbody">
					<div className="mock-ac__uplabel">
						<CalendarDays aria-hidden="true" />
						Upcoming
					</div>
					<p className="mock-ac__upday">Today, Dec 13</p>

					<div className="mock-ac__cards">
						{upcoming.map((e, i) => {
							const c = cat(e.cat);
							return (
								<div className="mock-ac__card" key={i}>
									<span
										className="mock-ac__cardbar"
										style={{ background: c.color }}
										aria-hidden="true"
									/>
									<div className="mock-ac__cardbody">
										<strong>{e.title}</strong>
										<span className="mock-ac__cardtime">
											{fmt(e.start)} – {fmt(e.end)}
										</span>
										{e.sub ? (
											<span className="mock-ac__cardloc">
												<MapPin aria-hidden="true" />
												{e.sub}
											</span>
										) : null}
										{e.attendees?.length ? (
											<span className="mock-ac__stack">
												{e.attendees.slice(0, 4).map((name) => (
													<Avatar key={name} name={name} size="sm" />
												))}
											</span>
										) : null}
									</div>
								</div>
							);
						})}
						{!upcoming.length ? (
							<p className="mock-ac__upempty">Nothing on the rest of today.</p>
						) : null}
					</div>
				</div>
			</aside>
		</div>
	);
}
