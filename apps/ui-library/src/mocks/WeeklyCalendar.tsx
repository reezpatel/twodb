import { Avatar, Badge, Button } from "@twodb/ui";
import {
	Bot,
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Command,
	MapPin,
	Plus,
	Search,
	Settings2,
	Sparkles,
	Users,
} from "lucide-react";
import "./WeeklyCalendar.css";

const WEEK_DAYS = [
	{ short: "Mon", date: "18", load: "5" },
	{ short: "Tue", date: "19", load: "6", today: true },
	{ short: "Wed", date: "20", load: "4" },
	{ short: "Thu", date: "21", load: "7" },
	{ short: "Fri", date: "22", load: "3" },
	{ short: "Sat", date: "23", load: "1", quiet: true },
	{ short: "Sun", date: "24", load: "0", quiet: true },
];

const CALENDARS = [
	{ name: "Work", count: 18, tone: "work", checked: true },
	{ name: "Personal", count: 8, tone: "personal", checked: true },
	{ name: "Team holds", count: 6, tone: "team", checked: true },
	{ name: "AI prepared", count: 4, tone: "ai", checked: true },
];

const EVENTS = [
	{
		title: "Patient follow-up block",
		meta: "08:30 - 09:30 · Clinic",
		col: 1,
		start: 2,
		span: 2,
		tone: "work",
		people: ["Riya", "Noor"],
	},
	{
		title: "Supplier pricing call",
		meta: "10:00 - 11:00 · Phone",
		col: 1,
		start: 5,
		span: 2,
		tone: "team",
		people: ["Sam"],
	},
	{
		title: "AI prep: insurance notes",
		meta: "08:00 - 08:30 · Draft ready",
		col: 2,
		start: 1,
		span: 1,
		tone: "ai",
		people: [],
	},
	{
		title: "Operations standup",
		meta: "09:00 - 09:45 · Room 2",
		col: 2,
		start: 3,
		span: 2,
		tone: "work",
		people: ["Ava", "Mia", "Leo"],
	},
	{
		title: "Lunch with Nisha",
		meta: "12:30 - 01:30 · Cafe Luna",
		col: 2,
		start: 10,
		span: 2,
		tone: "personal",
		people: ["Nisha"],
	},
	{
		title: "Inventory reorder",
		meta: "11:00 - 12:00 · Back office",
		col: 3,
		start: 7,
		span: 2,
		tone: "team",
		people: ["Omar", "Kim"],
	},
	{
		title: "Client contract review",
		meta: "02:00 - 03:30 · Shared notes",
		col: 3,
		start: 13,
		span: 3,
		tone: "work",
		people: ["Ren", "Ira"],
	},
	{
		title: "Revenue close",
		meta: "09:30 - 11:00 · Finance",
		col: 4,
		start: 4,
		span: 3,
		tone: "work",
		people: ["Tara", "Ben"],
	},
	{
		title: "School pickup",
		meta: "03:30 - 04:00 · Personal",
		col: 4,
		start: 16,
		span: 1,
		tone: "personal",
		people: [],
	},
	{
		title: "Weekly review",
		meta: "10:00 - 11:30 · Team",
		col: 5,
		start: 5,
		span: 3,
		tone: "ai",
		people: ["Ava", "Noor", "Sam"],
	},
	{
		title: "Quiet planning",
		meta: "04:00 - 05:00 · No meetings",
		col: 5,
		start: 17,
		span: 2,
		tone: "team",
		people: [],
	},
	{
		title: "Market visit",
		meta: "10:30 - 11:30 · Errand",
		col: 6,
		start: 6,
		span: 2,
		tone: "personal",
		people: [],
	},
];

const UPCOMING = [
	{ time: "09:00", title: "Operations standup", hint: "3 notes linked" },
	{ time: "12:30", title: "Lunch with Nisha", hint: "travel: 12 min" },
	{ time: "14:00", title: "Contract review", hint: "AI summary ready" },
];

function EventCard({ event }: { event: (typeof EVENTS)[number] }) {
	const [time, detail] = event.meta.split(" · ");

	return (
		<article
			className={`mock-weekcal__event mock-weekcal__event--${event.tone} mock-weekcal__event--col-${event.col} mock-weekcal__event--start-${event.start} mock-weekcal__event--span-${event.span}`}
		>
			<strong>{event.title}</strong>
			<span className="mock-weekcal__event-time">
				<Clock3 aria-hidden="true" /> {time}
			</span>
			{detail ? <em>{detail}</em> : null}
			{event.people.length ? (
				<div className="mock-weekcal__people">
					{event.people.slice(0, 3).map((name) => (
						<Avatar key={name} name={name} size="sm" />
					))}
				</div>
			) : null}
		</article>
	);
}

export function WeeklyCalendarMock() {
	return (
		<div className="mock-weekcal" aria-label="Weekly calendar showcase">
			<aside className="mock-weekcal__sidebar">
				<header className="mock-weekcal__brand">
					<span>
						<CalendarDays aria-hidden="true" />
					</span>
					<div>
						<strong>twodb Calendar</strong>
						<em>Personal + team time</em>
					</div>
				</header>

				<Button className="mock-weekcal__new">
					<Plus aria-hidden="true" /> New event
				</Button>

				<section className="mock-weekcal__week-card" aria-label="Current week">
					<div className="mock-weekcal__section-head">
						<span>This week</span>
						<div>
							<button type="button" aria-label="Previous week">
								<ChevronLeft />
							</button>
							<button type="button" aria-label="Next week">
								<ChevronRight />
							</button>
						</div>
					</div>
					<div className="mock-weekcal__date-strip">
						{WEEK_DAYS.map((day) => (
							<button
								key={day.date}
								type="button"
								className={[
									day.today ? "is-today" : "",
									day.quiet ? "is-quiet" : "",
								]
									.filter(Boolean)
									.join(" ")}
							>
								<span>{day.short}</span>
								<strong>{day.date}</strong>
							</button>
						))}
					</div>
				</section>

				<section className="mock-weekcal__calendars" aria-label="Calendars">
					<div className="mock-weekcal__section-head">
						<span>Calendars</span>
					</div>
					{CALENDARS.map((calendar) => (
						<label
							key={calendar.name}
							className={`mock-weekcal__calendar-row mock-weekcal__calendar-row--${calendar.tone}`}
						>
							<i>{calendar.checked ? <Check aria-hidden="true" /> : null}</i>
							<span>{calendar.name}</span>
							<em className="tw-tnum">{calendar.count}</em>
						</label>
					))}
				</section>

				<section className="mock-weekcal__assistant">
					<Sparkles aria-hidden="true" />
					<strong>4 events are prepped</strong>
					<p>
						Meeting notes, linked records, and travel context are ready before
						the day starts.
					</p>
				</section>
			</aside>

			<main className="mock-weekcal__main">
				<header className="mock-weekcal__topbar">
					<div>
						<h2>Week planner</h2>
						<p>March 18 - 24, 2024 · UTC +1</p>
					</div>
					<div className="mock-weekcal__top-actions">
						<button type="button" aria-label="Search">
							<Search aria-hidden="true" />
						</button>
						<div
							className="mock-weekcal__view-tabs"
							role="tablist"
							aria-label="Calendar view"
						>
							<button type="button">Day</button>
							<button type="button" className="is-active">
								Week
							</button>
							<button type="button">Month</button>
						</div>
						<Button size="sm" variant="secondary">
							<Settings2 aria-hidden="true" /> Filters
						</Button>
					</div>
				</header>

				<section className="mock-weekcal__summary" aria-label="Week summary">
					<div>
						<Badge tone="go" size="sm">
							45 events
						</Badge>
						<strong>Balanced week</strong>
						<span>Friday afternoon protected for planning.</span>
					</div>
					<div>
						<Clock3 aria-hidden="true" />
						<strong>18h focused</strong>
						<span>6h meetings moved out of deep-work blocks.</span>
					</div>
					<div>
						<Bot aria-hidden="true" />
						<strong>AI prep</strong>
						<span>4 agendas and 2 follow-ups drafted.</span>
					</div>
				</section>

				<section
					className="mock-weekcal__timeline"
					aria-label="Calendar week grid"
				>
					<div className="mock-weekcal__timeline-head">
						<div className="mock-weekcal__tz">UTC +1</div>
						{WEEK_DAYS.map((day) => (
							<div key={day.date} className={day.today ? "is-today" : ""}>
								<span>{day.short}</span>
								<strong>{day.date}</strong>
								<em>{day.load} events</em>
							</div>
						))}
					</div>
					<div className="mock-weekcal__timeline-body">
						<div className="mock-weekcal__times">
							<span>08:00</span>
							<span>10:00</span>
							<span>12:00</span>
							<span>14:00</span>
							<span>16:00</span>
							<span>18:00</span>
						</div>
						<div className="mock-weekcal__lanes">
							{WEEK_DAYS.map((day) => (
								<div key={day.date} className="mock-weekcal__lane" />
							))}
							<div className="mock-weekcal__now">
								<span>09:20</span>
							</div>
							{EVENTS.map((event) => (
								<EventCard key={`${event.title}-${event.col}`} event={event} />
							))}
						</div>
					</div>
				</section>
			</main>

			<aside className="mock-weekcal__detail">
				<div className="mock-weekcal__detail-head">
					<Badge tone="rose" size="sm">
						AI ready
					</Badge>
					<button type="button" aria-label="Command menu">
						<Command aria-hidden="true" />
					</button>
				</div>
				<section className="mock-weekcal__focus-card">
					<h3>Today, Tuesday</h3>
					<p>
						Three commitments need attention. twodb has attached notes and
						suggested prep windows.
					</p>
					<div className="mock-weekcal__focus-meta">
						<Clock3 aria-hidden="true" />
						<span>Next up at 09:00</span>
					</div>
				</section>
				<section className="mock-weekcal__agenda">
					<div className="mock-weekcal__section-head">
						<span>Agenda</span>
					</div>
					{UPCOMING.map((item) => (
						<div key={item.time} className="mock-weekcal__agenda-row">
							<time className="tw-tnum">{item.time}</time>
							<div>
								<strong>{item.title}</strong>
								<span>{item.hint}</span>
							</div>
						</div>
					))}
				</section>
				<section className="mock-weekcal__place">
					<MapPin aria-hidden="true" />
					<div>
						<strong>Next travel</strong>
						<span>Leave at 12:12 for Cafe Luna.</span>
					</div>
				</section>
				<section className="mock-weekcal__team">
					<Users aria-hidden="true" />
					<div>
						<strong>Team availability</strong>
						<span>5 people free after 15:30.</span>
					</div>
				</section>
			</aside>
		</div>
	);
}
