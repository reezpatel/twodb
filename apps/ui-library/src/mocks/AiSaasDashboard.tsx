/* AI SaaS Dashboard mock — a macOS browser window on a gradient desktop,
   inspired by the supplied reference: workspace sidebar (nav, collections,
   runs, usage card, settings footer with a working dark-mode switch),
   a "Hello David" home with Upcoming Meetings / Tasks / Documents cards,
   and an AI prompt bar with model picker and attach tools. Cyclorama
   grammar: hairlines, quiet inks, night for the lit actions; the window
   flips phases through the design system's own day/night tokens. */

import { useState } from "react";
import { Button, IconButton, Progress, Switch } from "@twodb/ui";
import {
	Asterisk,
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleCheck,
	Folder,
	Globe,
	Headphones,
	Home,
	Image,
	Lock,
	LogOut,
	Moon,
	Paperclip,
	Plus,
	RotateCw,
	Settings,
	Sparkles,
	ArrowUp,
	Video,
} from "lucide-react";
import "./AiSaasDashboard.css";

/* ---------- data ---------- */

const NAV = [
	{ id: "home", label: "Home", icon: Home },
	{ id: "calendar", label: "Calendar", icon: CalendarDays },
	{ id: "meetings", label: "Meetings", icon: Video },
	{ id: "tasks", label: "Tasks", icon: CircleCheck },
	{ id: "files", label: "Files", icon: Folder },
];

const COLLECTIONS = ["Beyond UI", "Figma"];
const RUNS = ["Extract Action Items"];

const MEETINGS = [
	{
		day: "TODAY",
		time: "10:00",
		title: "Product Design Review",
		sub: "Today, 10:00am",
	},
	{
		day: "24 JUN",
		time: "2:00",
		title: "Sprint 5 Planning",
		sub: "Today, 2:00pm",
	},
	{
		day: "24 JUN",
		time: "3:00",
		title: "UX Brainstorming",
		sub: "Today, 3:00pm",
	},
	{
		day: "25 JUN",
		time: "1:00",
		title: "Product Design Review",
		sub: "Today, 1:00pm",
	},
];

const TASKS = [
	{ title: "Competitor Analysis", desc: "Summarize market insights." },
	{ title: "Meeting Summary", desc: "Extract key action points." },
	{ title: "Feedback Analysis", desc: "Identify customer sentiment." },
	{ title: "Sales Trends Report", desc: "Highlight recent sales data." },
	{ title: "Draft Blog Post", desc: "Generate SEO-focused content." },
];

type DocKind = "drive" | "excel" | "word";

const DOCS: { kind: DocKind; name: string }[] = [
	{ kind: "drive", name: "2025_Estimation Overview" },
	{ kind: "excel", name: "Future Projection Model" },
	{ kind: "excel", name: "2025 Budget Analysis" },
	{ kind: "word", name: "2025 Financial Summary" },
	{ kind: "word", name: "2025 Investment Plan" },
	{ kind: "drive", name: "2025 Cost Assessment" },
	{ kind: "drive", name: "2025 Resource Allocation" },
];

/* ---------- brand file icons ---------- */

function DriveIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M9.09 4 2.73 15h5.82L14.91 4z" fill="#188038" />
			<path d="M9.09 4h5.82l6.36 11H15.45z" fill="#f9ab00" />
			<path d="M8.55 15h12.72l-2.91 5H5.64z" fill="#1967d2" />
		</svg>
	);
}

function ExcelIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<rect x="3" y="3" width="18" height="18" rx="4" fill="#107c41" />
			<text
				x="12"
				y="16.5"
				textAnchor="middle"
				fontSize="11"
				fontWeight="800"
				fill="#fff"
			>
				X
			</text>
		</svg>
	);
}

function WordIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<rect x="3" y="3" width="18" height="18" rx="4" fill="#185abd" />
			<text
				x="12"
				y="16.5"
				textAnchor="middle"
				fontSize="11"
				fontWeight="800"
				fill="#fff"
			>
				W
			</text>
		</svg>
	);
}

const DOC_ICONS: Record<DocKind, () => React.ReactNode> = {
	drive: DriveIcon,
	excel: ExcelIcon,
	word: WordIcon,
};

/* ---------- main ---------- */

export function AiSaasDashboardMock() {
	const [nav, setNav] = useState("home");
	const [dark, setDark] = useState(false);
	const [prompt, setPrompt] = useState("");

	return (
		<div className="mock-ad">
			<div className="mock-ad__window" data-phase={dark ? "night" : "day"}>
				{/* browser chrome */}
				<div className="mock-ad__chrome">
					<span className="mock-ad__lights" aria-hidden="true">
						<i className="mock-ad__light mock-ad__light--red" />
						<i className="mock-ad__light mock-ad__light--yellow" />
						<i className="mock-ad__light mock-ad__light--green" />
					</span>
					<span className="mock-ad__navbtns">
						<ChevronLeft size={16} aria-hidden="true" />
						<ChevronRight size={16} aria-hidden="true" className="is-dim" />
					</span>
					<span className="mock-ad__url">
						<Lock size={11} aria-hidden="true" />
						beyondui.design
						<RotateCw
							size={11}
							aria-hidden="true"
							className="mock-ad__reload"
						/>
					</span>
				</div>

				<div className="mock-ad__app">
					{/* sidebar */}
					<aside className="mock-ad__side">
						<div className="mock-ad__workspace">
							<span className="mock-ad__logo" aria-hidden="true">
								<Asterisk size={16} />
							</span>
							<strong>Beyond Workspace</strong>
							<IconButton
								label="New workspace item"
								icon={<Plus size={15} />}
								size="sm"
							/>
						</div>

						<nav className="mock-ad__nav" aria-label="Workspace">
							{NAV.map((item) => (
								<button
									key={item.id}
									type="button"
									className={
										nav === item.id
											? "mock-ad__navitem mock-ad__navitem--active"
											: "mock-ad__navitem"
									}
									onClick={() => setNav(item.id)}
								>
									<item.icon size={16} aria-hidden="true" />
									{item.label}
								</button>
							))}
						</nav>

						<div className="mock-ad__section">
							<div className="mock-ad__section-head">
								<h3>Collections</h3>
								<IconButton
									label="New collection"
									icon={<Plus size={14} />}
									size="sm"
								/>
							</div>
							{COLLECTIONS.map((c) => (
								<button key={c} type="button" className="mock-ad__link">
									{c}
								</button>
							))}
						</div>

						<div className="mock-ad__section">
							<div className="mock-ad__section-head">
								<h3>Runs</h3>
							</div>
							{RUNS.map((r) => (
								<button key={r} type="button" className="mock-ad__link">
									{r}
								</button>
							))}
						</div>

						<div className="mock-ad__side-foot">
							<div className="mock-ad__usage">
								<strong>Meetings this month</strong>
								<Progress value={3} max={7} aria-label="3 of 7 meetings used" />
								<span className="mock-ad__usage-sub">3 of 7 Available</span>
								<Button size="sm" className="mock-ad__update">
									Update
								</Button>
							</div>

							<nav className="mock-ad__nav" aria-label="App">
								<button type="button" className="mock-ad__navitem">
									<Settings size={16} aria-hidden="true" />
									Settings
								</button>
								<button type="button" className="mock-ad__navitem">
									<Headphones size={16} aria-hidden="true" />
									Support
								</button>
								<span className="mock-ad__navitem mock-ad__navitem--static">
									<Moon size={16} aria-hidden="true" />
									Dark Mode
									<Switch
										className="mock-ad__darksw"
										checked={dark}
										onChange={(e) => setDark(e.target.checked)}
										aria-label="Dark Mode"
									/>
								</span>
								<button type="button" className="mock-ad__navitem">
									<LogOut size={16} aria-hidden="true" />
									Logout
								</button>
							</nav>
						</div>
					</aside>

					{/* main */}
					<main className="mock-ad__main">
						<h1 className="mock-ad__page">Home</h1>

						<header className="mock-ad__hero">
							<h2>Hello David</h2>
							<p>
								Ready to see what&rsquo;s next on your agenda? Let&rsquo;s dive
								in
							</p>
						</header>

						<div className="mock-ad__grid">
							{/* upcoming meetings */}
							<section className="mock-ad__card" aria-label="Upcoming Meetings">
								<div className="mock-ad__card-head">
									<h3>Upcoming Meetings</h3>
									<button type="button" className="mock-ad__textbtn">
										Summarize
									</button>
								</div>
								{MEETINGS.map((m, i) => (
									<div className="mock-ad__meeting" key={i}>
										<span className="mock-ad__date">
											<em>{m.day}</em>
											<strong>{m.time}</strong>
										</span>
										<span className="mock-ad__meeting-meta">
											<strong>{m.title}</strong>
											<em>{m.sub}</em>
										</span>
										<Switch aria-label={`Summarize ${m.title}`} />
									</div>
								))}
							</section>

							{/* tasks */}
							<section className="mock-ad__card" aria-label="Tasks">
								<div className="mock-ad__card-head">
									<h3>Tasks</h3>
								</div>
								{TASKS.map((t) => (
									<div className="mock-ad__task" key={t.title}>
										<strong>{t.title}</strong>
										<em>{t.desc}</em>
									</div>
								))}
							</section>

							{/* documents */}
							<section className="mock-ad__card" aria-label="Documents">
								<div className="mock-ad__card-head">
									<h3>Documents</h3>
								</div>
								{DOCS.map((d) => (
									<div className="mock-ad__doc" key={d.name}>
										{DOC_ICONS[d.kind]()}
										<span>{d.name}</span>
									</div>
								))}
							</section>
						</div>

						{/* AI prompt bar */}
						<div className="mock-ad__composer">
							<input
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								placeholder="Ask AI anything"
								aria-label="Ask AI anything"
							/>
							<div className="mock-ad__composer-row">
								<button type="button" className="mock-ad__model">
									<Sparkles size={13} aria-hidden="true" />
									GPT-5
									<ChevronDown size={13} aria-hidden="true" />
								</button>
								<span className="mock-ad__composer-div" aria-hidden="true" />
								<IconButton
									label="Attach a file"
									icon={<Paperclip size={15} />}
									size="sm"
								/>
								<IconButton
									label="Search the web"
									icon={<Globe size={15} />}
									size="sm"
								/>
								<IconButton
									label="Add an image"
									icon={<Image size={15} />}
									size="sm"
								/>
								<button
									type="button"
									className="mock-ad__send"
									aria-label="Send"
									onClick={() => setPrompt("")}
								>
									<ArrowUp size={15} aria-hidden="true" />
								</button>
							</div>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
