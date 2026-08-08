import { Avatar, Button } from "@twodb/ui";
import {
	BarChart3,
	Bell,
	CalendarCheck2,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Home,
	ListChecks,
	MessageSquare,
	Plus,
	Search,
	Settings2,
	Users,
} from "lucide-react";
import "./WeeklyCalendar.css";

const MINI_DAYS = [
	{ label: "29", muted: true },
	{ label: "1" },
	{ label: "2" },
	{ label: "3" },
	{ label: "4" },
	{ label: "5" },
	{ label: "6" },
	{ label: "7", active: true },
	{ label: "8", range: true },
	{ label: "9", range: true },
	{ label: "10", range: true },
	{ label: "11", range: true },
	{ label: "12", range: true },
	{ label: "13", range: true },
	{ label: "14" },
	{ label: "15" },
	{ label: "16" },
	{ label: "17" },
	{ label: "18" },
	{ label: "19" },
	{ label: "20" },
	{ label: "21" },
	{ label: "22" },
	{ label: "23" },
	{ label: "24" },
	{ label: "25" },
	{ label: "26" },
	{ label: "27" },
	{ label: "28" },
	{ label: "29" },
	{ label: "30" },
	{ label: "31" },
	{ label: "1", muted: true },
	{ label: "2", muted: true },
	{ label: "3", muted: true },
];

const SCHEDULES = [
	"Daily Standup",
	"Weekly Review",
	"Team Meeting",
	"Lunch Break",
	"Client Meeting",
	"Other",
];

const CATEGORIES = [
	{ label: "Work", count: 18, tone: "work" },
	{ label: "Personal", count: 12, tone: "personal" },
	{ label: "Teams", count: 9, tone: "teams" },
];

const DAYS = [
	{ date: "7", day: "Monday" },
	{ date: "8", day: "Tuesday" },
	{ date: "9", day: "Wednesday" },
	{ date: "10", day: "Thursday" },
	{ date: "11", day: "Friday" },
];

const EVENTS = [
	{
		title: "Daily standup",
		time: "09 AM - 10 AM",
		col: 1,
		start: 2,
		span: 2,
		tone: "rose",
		people: ["Ava", "Noah", "Mia"],
		more: "+4 Other",
	},
	{
		title: "Agencies Birthday",
		time: "11 AM - 01 PM",
		col: 1,
		start: 6,
		span: 4,
		tone: "blue",
		people: ["Lina"],
	},
	{
		title: "Weekly Review",
		time: "10 AM - 12 PM",
		col: 2,
		start: 4,
		span: 5,
		tone: "rose",
		people: ["June", "Omar", "Iris"],
		more: "+4 Other",
	},
	{
		title: "Meeting with Client",
		time: "12 PM - 01 PM",
		col: 2,
		start: 9,
		span: 2,
		tone: "rose",
		people: ["Ari", "Ben"],
	},
	{
		title: "Check Up to Doctor",
		time: "09 AM - 10 AM",
		col: 3,
		start: 2,
		span: 2,
		tone: "green",
		people: ["Tim"],
	},
	{
		title: "Bazaar",
		time: "10 AM - 12 PM",
		col: 3,
		start: 4,
		span: 3,
		tone: "blue",
		people: ["Mia", "Eli", "Kai"],
		more: "+2 Other",
	},
	{
		title: "Lunch Break",
		time: "12 PM - 01 PM",
		col: 3,
		start: 9,
		span: 2,
		tone: "yellow",
		people: [],
	},
	{
		title: "Team Planning",
		time: "09:30 AM - 11 AM",
		col: 4,
		start: 3,
		span: 3,
		tone: "blue",
		people: ["Tess", "Max"],
		more: "+1 Other",
	},
	{
		title: "Campaign Review",
		time: "11 AM - 12 PM",
		col: 5,
		start: 6,
		span: 2,
		tone: "rose",
		people: ["Liv", "Ren"],
	},
];

function EventCard({ event }: { event: (typeof EVENTS)[number] }) {
	return (
		<article
			className={`mock-weekcal__event mock-weekcal__event--${event.tone} mock-weekcal__event--col-${event.col} mock-weekcal__event--start-${event.start} mock-weekcal__event--span-${event.span}`}
		>
			<strong>{event.title}</strong>
			<span className="mock-weekcal__time">
				<Clock3 aria-hidden="true" /> {event.time}
			</span>
			{event.people.length || event.more ? (
				<div className="mock-weekcal__people">
					<div className="mock-weekcal__stack">
						{event.people.map((name) => (
							<Avatar key={name} name={name} size="sm" />
						))}
					</div>
					{event.more ? <em>{event.more}</em> : null}
				</div>
			) : null}
		</article>
	);
}

export function WeeklyCalendarMock() {
	return (
		<div className="mock-weekcal" aria-label="Weekly calendar mock">
			<aside className="mock-weekcal__rail" aria-label="Calendar navigation">
				<span className="mock-weekcal__brand">
					<Check aria-hidden="true" />
				</span>
				<nav>
					<Home aria-label="Home" />
					<ListChecks aria-label="Tasks" />
					<Users aria-label="Teams" />
					<span className="is-active">
						<CalendarDays aria-label="Calendar" />
					</span>
					<MessageSquare aria-label="Messages" />
					<BarChart3 aria-label="Reports" />
					<Bell aria-label="Alerts" />
				</nav>
				<Avatar name="Riley Chen" size="sm" />
			</aside>

			<aside className="mock-weekcal__side">
				<header className="mock-weekcal__calendar-picker">
					<div className="mock-weekcal__calendar-glyph">
						<CalendarCheck2 aria-hidden="true" />
						<span>31</span>
					</div>
					<div>
						<strong>All Calendar</strong>
						<span>Personal, Teams</span>
					</div>
					<ChevronDown aria-hidden="true" />
				</header>

				<section
					className="mock-weekcal__mini"
					aria-label="March mini calendar"
				>
					<div className="mock-weekcal__mini-head">
						<button type="button" aria-label="Previous month">
							<ChevronLeft />
						</button>
						<strong>March</strong>
						<button type="button" aria-label="Next month">
							<ChevronRight />
						</button>
					</div>
					<div className="mock-weekcal__weekdays">
						<span>Mo</span>
						<span>Tu</span>
						<span>We</span>
						<span>Th</span>
						<span>Fr</span>
						<span>Sa</span>
						<span>Su</span>
					</div>
					<div className="mock-weekcal__mini-grid">
						{MINI_DAYS.map((day, index) => (
							<span
								key={`${day.label}-${index}`}
								className={[
									day.muted ? "is-muted" : "",
									day.range ? "is-range" : "",
									day.active ? "is-active" : "",
								]
									.filter(Boolean)
									.join(" ")}
							>
								{day.label}
							</span>
						))}
					</div>
				</section>

				<section className="mock-weekcal__checks">
					<div className="mock-weekcal__side-title">
						<strong>My Schedule</strong>
						<ChevronDown aria-hidden="true" />
					</div>
					{SCHEDULES.map((item) => (
						<label key={item}>
							<span />
							{item}
						</label>
					))}
				</section>

				<section className="mock-weekcal__categories">
					<div className="mock-weekcal__side-title">
						<strong>Categories</strong>
						<ChevronDown aria-hidden="true" />
					</div>
					{CATEGORIES.map((category) => (
						<div
							key={category.label}
							className={`mock-weekcal__category mock-weekcal__category--${category.tone}`}
						>
							<i />
							<span>{category.label}</span>
							<em className="tw-tnum">{category.count}</em>
						</div>
					))}
				</section>
			</aside>

			<main className="mock-weekcal__main">
				<header className="mock-weekcal__hero">
					<div>
						<div className="mock-weekcal__crumb">
							Calendar <span>/</span> All Calendar
						</div>
						<h2>Calendar</h2>
						<div className="mock-weekcal__month">
							<strong>March, 2024</strong>
							<ChevronDown aria-hidden="true" />
						</div>
						<span className="mock-weekcal__count">
							<CalendarDays aria-hidden="true" /> 45 events
						</span>
					</div>
					<div className="mock-weekcal__actions">
						<button
							type="button"
							className="mock-weekcal__search"
							aria-label="Search calendar"
						>
							<Search aria-hidden="true" />
						</button>
						<div
							className="mock-weekcal__tabs"
							role="tablist"
							aria-label="Calendar view"
						>
							<button type="button">Day</button>
							<button type="button" className="is-active">
								Week
							</button>
							<button type="button">Month</button>
						</div>
						<Button size="sm">
							<Plus aria-hidden="true" /> Event
						</Button>
						<Button size="sm" variant="secondary">
							<Settings2 aria-hidden="true" /> Filter
						</Button>
					</div>
				</header>

				<section className="mock-weekcal__board" aria-label="Week of March 7">
					<div className="mock-weekcal__grid-head">
						<div className="mock-weekcal__tz">UTC +1</div>
						{DAYS.map((day) => (
							<div key={day.date}>
								<strong>{day.date}</strong>
								<span>{day.day}</span>
							</div>
						))}
					</div>
					<div className="mock-weekcal__grid">
						<div className="mock-weekcal__times">
							<span>09 AM</span>
							<span>10 AM</span>
							<span>11 AM</span>
							<span>12 PM</span>
							<span>01 PM</span>
							<span>02 PM</span>
						</div>
						<div className="mock-weekcal__columns">
							{DAYS.map((day) => (
								<div key={day.date} className="mock-weekcal__day-column" />
							))}
							{EVENTS.map((event) => (
								<EventCard key={`${event.title}-${event.col}`} event={event} />
							))}
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
