/* TolariaNotes mock — a networked notes workspace: macOS chrome, sidebar
   with favorites / types / folders, an inbox list with tag chips and
   created-vs-updated stamps, a serif long-form editor with live marks,
   a properties panel with relations, and a git-flavored status bar.
   Reference anatomy, Cyclorama grammar (hairlines, flat cobalt, IBM Plex Sans cues). */

import { useMemo, useState, type ReactNode } from "react";
import {
	Archive,
	ArrowDownNarrowWide,
	ArrowUpWideNarrow,
	Asterisk,
	Bell,
	BookOpen,
	Box,
	Calendar,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
	CloudCheck,
	Code,
	Columns2,
	ExternalLink,
	FileText,
	FlaskConical,
	Folder,
	Gem,
	GitCommitHorizontal,
	GitPullRequest,
	GripVertical,
	Hash,
	History,
	Inbox,
	Layers,
	Leaf,
	Link2,
	List,
	ListChecks,
	MapPin,
	MoreHorizontal,
	PanelLeft,
	PanelRight,
	Plus,
	Search,
	Smile,
	Sparkles,
	SquarePen,
	Star,
	StickyNote,
	Sun,
	Tag,
	Users,
	X,
} from "lucide-react";
import "./tolaria-notes";

/* --- data --- */

type Box = "inbox" | "all" | "archive";
type ChipTone = "red" | "purple" | "blue" | "green";

interface TagChip {
	label: string;
	tone: ChipTone;
	link?: boolean;
}

interface Doc {
	type: string;
	typeIcon: ReactNode;
	slug: string;
	status: string;
	date: string;
	notionId: string;
	url: string;
	belongsTo: { label: string; tone: ChipTone } | null;
	hasNotes: string[];
	body: ReactNode;
}

interface Note {
	id: string;
	box: Exclude<Box, "all">;
	title: string;
	marker?: "orange" | "glyph" | "image";
	preview: string;
	tags: TagChip[];
	ago: string;
	mins: number;
	created: string;
	external: boolean;
	doc: Doc;
}

const HAS_NOTES = [
	"The Way Forward for AI and Produ…",
	"The AI Experimentation Gap",
	"Only 9% of teams use AI for produ…",
	"The Planning Problem",
	"The Five Product Dev Problems",
];

const ESSAY_BODY = (
	<>
		<p>
			Once or twice a year we run a deep research survey on our newsletter to
			better understand trends in software development. We do this to collect
			broad, quantitative data, that complements the <em>qualitative</em>{" "}
			opinions we already get from podcast interviews, from our private
			community, and from my own 1:1 conversations.
		</p>
		<p>
			Last year we explored AI adoption, while this year we decided to expand
			the scope and investigate what the whole{" "}
			<strong>product development process</strong> looks like for teams in 2026.
		</p>
		<p>
			We chose this topic because I believe we need to look <em>beyond</em>{" "}
			coding. Coding is now cheaper and faster than ever, which, in many teams,
			is moving the bottlenecks elsewhere.
		</p>
		<p>
			Is that really the case? And, if so, what are the bottlenecks now? This is
			what we tried to uncover this year. In January I advocated that the best
			way to find friction in your dev process was to simply ask your engineers,
			by doing what I called a{" "}
			<span className="mock-tn__link">Listening Tour</span>. This survey is our
			own listening tour on ~350 teams, and we are here to report findings.
		</p>
		<p>
			This research is also done in partnership with Atono, that sponsored this
			work and also helped us with their expertise, insights from their customer
			base, and overall domain knowledge.
		</p>
		<p>So here is the agenda for today:</p>
		<ul>
			<li>
				<span className="mock-tn__emoji">🏈</span> <strong>Demographics</strong>{" "}
				— a quick note on the data.
			</li>
			<li>
				<span className="mock-tn__emoji">📋</span>{" "}
				<strong>The Planning Problem</strong> — why 59% of teams discover
				missing work mid-cycle, every cycle.
			</li>
			<li>
				<span className="mock-tn__emoji">🖊️</span>{" "}
				<strong>AI in the Workflow</strong> — what teams are using AI for (and
				the one use case almost nobody has tried).
			</li>
			<li>
				<span className="mock-tn__emoji">🧪</span>{" "}
				<strong>The Experimentation Gap</strong> — why some teams are
				compounding returns while others stall at the pilot.
			</li>
		</ul>
	</>
);

const ESSAY_DOC: Doc = {
	type: "Essay",
	typeIcon: <BookOpen size={13} />,
	slug: "the-state-of-product-development",
	status: "Evergreened",
	date: "Mar 11, 2026",
	notionId: "2eebddf02-815c-80e2-9…",
	url: "—",
	belongsTo: { label: "Publish Essays", tone: "purple" },
	hasNotes: HAS_NOTES,
	body: ESSAY_BODY,
};

function doc(over: Partial<Doc> & { body: ReactNode }): Doc {
	return {
		type: "Note",
		typeIcon: <StickyNote size={13} />,
		slug: "untitled",
		status: "Draft",
		date: "May 6, 2026",
		notionId: "—",
		url: "—",
		belongsTo: null,
		hasNotes: [],
		...over,
	};
}

const NOTES: Note[] = [
	{
		id: "v0506",
		box: "inbox",
		title: "v2026-05-06",
		marker: "orange",
		preview:
			"New Tolaria release! 🎇 This brings more control and better UX on a variety of…",
		tags: [{ label: "Tolaria MVP", tone: "red" }],
		ago: "just now",
		mins: 0,
		created: "Created 4h ago",
		external: true,
		doc: doc({
			type: "Release",
			typeIcon: <FileText size={13} />,
			slug: "v2026-05-06",
			status: "Published",
			date: "May 6, 2026",
			belongsTo: { label: "Tolaria MVP", tone: "red" },
			body: (
				<>
					<p>
						New Tolaria release! 🎇 This brings more control and better UX on a
						variety of surfaces: the properties panel, the list column, and the
						status bar all got attention.
					</p>
					<p>
						The headline change is <strong>per-type chrome</strong> — essays,
						releases, and resources each get their own header tint, and the
						relation chips now render inline.
					</p>
					<ul>
						<li>
							<strong>Faster sync</strong> — the queue drains in under a second.
						</li>
						<li>
							<strong>Calmer status bar</strong> — one line, nothing blinking.
						</li>
					</ul>
				</>
			),
		}),
	},
	{
		id: "orchestrate",
		box: "inbox",
		title: "How to Orchestrate AI Workflows",
		preview:
			"Hey there! Last week's article about my workflows for Tolaria went incredibly well,…",
		tags: [{ label: "Publish Essays", tone: "purple" }],
		ago: "4h ago",
		mins: 240,
		created: "Created 6h ago",
		external: true,
		doc: doc({
			type: "Essay",
			typeIcon: <BookOpen size={13} />,
			slug: "how-to-orchestrate-ai-workflows",
			status: "Draft",
			date: "May 6, 2026",
			belongsTo: { label: "Publish Essays", tone: "purple" },
			hasNotes: ["The AI Experimentation Gap"],
			body: (
				<>
					<p>
						Hey there! Last week's article about my workflows for Tolaria went
						incredibly well, so here is the full orchestration write-up: how the
						agents hand off, where the queues live, and what I still do by hand.
					</p>
					<p>
						The short version: <strong>one orchestrator, many workers</strong>.
						The orchestrator owns the plan; the workers own the tools; and every
						hand-off is a note, so the whole run stays auditable.
					</p>
				</>
			),
		}),
	},
	{
		id: "cosmo",
		box: "inbox",
		title: "Augment Cosmo",
		marker: "glyph",
		preview:
			"Augment announces Cosmos, now in public preview, as an operating system for agenti…",
		tags: [
			{ label: "www.augmentcode.com", tone: "blue", link: true },
			{ label: "AI / ML", tone: "green" },
		],
		ago: "7h ago",
		mins: 420,
		created: "Created 9h ago",
		external: true,
		doc: doc({
			type: "Resource",
			typeIcon: <Box size={13} />,
			slug: "augment-cosmo",
			status: "Archived",
			date: "May 6, 2026",
			url: "www.augmentcode.com",
			belongsTo: { label: "Resources", tone: "green" },
			body: (
				<>
					<p>
						Augment announces Cosmos, now in public preview, as an operating
						system for agentic development. First impressions and where it
						overlaps with my own setup.
					</p>
					<p>
						Interesting angle: the <em>context engine</em> indexes the whole
						repo continuously instead of retrieving per prompt.
					</p>
				</>
			),
		}),
	},
	{
		id: "anderson",
		box: "inbox",
		title: "Anderson Icon Classic Shorty Tr…",
		marker: "image",
		preview:
			"Jerry's Lefty Guitars listing for a new left-handed Anderson Icon Classic Shorty…",
		tags: [
			{ label: "www.jerrysleftyguitars.com", tone: "blue", link: true },
			{ label: "Gear", tone: "green" },
		],
		ago: "8h ago",
		mins: 480,
		created: "Created 9h ago",
		external: true,
		doc: doc({
			type: "Resource",
			typeIcon: <Box size={13} />,
			slug: "anderson-icon-classic-shorty",
			status: "Archived",
			date: "May 6, 2026",
			url: "www.jerrysleftyguitars.com",
			belongsTo: { label: "Gear", tone: "green" },
			body: (
				<>
					<p>
						Jerry's Lefty Guitars listing for a new left-handed Anderson Icon
						Classic Shorty. Spec sheet, price tracking, and photos.
					</p>
					<p>
						Trans red finish, maple board, <strong>medium jumbo</strong> frets.
						Watch the price — it moved twice this month.
					</p>
				</>
			),
		}),
	},
	{
		id: "v0502",
		box: "inbox",
		title: "v2026-05-02",
		preview:
			"Another Tolaria release in the bag! This one is focused on performance, bug fixes, and…",
		tags: [{ label: "Tolaria MVP", tone: "red" }],
		ago: "10h ago",
		mins: 600,
		created: "Created 4d ago",
		external: true,
		doc: doc({
			type: "Release",
			typeIcon: <FileText size={13} />,
			slug: "v2026-05-02",
			status: "Published",
			date: "May 2, 2026",
			belongsTo: { label: "Tolaria MVP", tone: "red" },
			body: (
				<>
					<p>
						Another Tolaria release in the bag! This one is focused on
						performance, bug fixes, and a quieter status bar.
					</p>
					<p>
						Cold start is down <strong>38%</strong>, and the editor no longer
						re-renders the gutter on every keystroke.
					</p>
				</>
			),
		}),
	},
	{
		id: "obsidian",
		box: "inbox",
		title: "Tolaria ↔ Obsidian migration propo…",
		preview:
			"Obsidian vaults are already close to Tolaria's ideal substrate: local Markdown files, YAM…",
		tags: [{ label: "Tolaria MVP", tone: "red" }],
		ago: "11h ago",
		mins: 660,
		created: "Created Apr 27",
		external: true,
		doc: doc({
			type: "Note",
			typeIcon: <StickyNote size={13} />,
			slug: "tolaria-obsidian-migration",
			status: "Draft",
			date: "Apr 27, 2026",
			belongsTo: { label: "Tolaria MVP", tone: "red" },
			body: (
				<>
					<p>
						Obsidian vaults are already close to Tolaria's ideal substrate:
						local Markdown files, YAML frontmatter, and a folder per space.
					</p>
					<p>
						The migration is mostly a <em>property mapping</em> — type, status,
						and relations move into frontmatter keys verbatim.
					</p>
				</>
			),
		}),
	},
	{
		id: "reading",
		box: "archive",
		title: "Reading list — March",
		preview: "Everything worth keeping from March: papers, essays, and two…",
		tags: [{ label: "Resources", tone: "green" }],
		ago: "Mar 31",
		mins: 52000,
		created: "Created Mar 4",
		external: false,
		doc: doc({
			slug: "reading-list-march",
			status: "Evergreened",
			date: "Mar 31, 2026",
			body: (
				<p>
					Everything worth keeping from March: papers, essays, and two talks.
					Annotated with why each one mattered at the time.
				</p>
			),
		}),
	},
	{
		id: "v0428",
		box: "archive",
		title: "v2026-04-28",
		preview: "Hotfix release: sync cursor loss on sleep/wake and a crash in…",
		tags: [{ label: "Tolaria MVP", tone: "red" }],
		ago: "Apr 28",
		mins: 56000,
		created: "Created Apr 28",
		external: false,
		doc: doc({
			type: "Release",
			typeIcon: <FileText size={13} />,
			slug: "v2026-04-28",
			status: "Published",
			date: "Apr 28, 2026",
			body: (
				<p>
					Hotfix release: sync cursor loss on sleep/wake and a crash in the
					relation picker. No new surface area.
				</p>
			),
		}),
	},
];

const SIDEBAR_MAIN: {
	id: Box;
	label: string;
	icon: ReactNode;
	meta: ReactNode;
}[] = [
	{ id: "inbox", label: "Inbox", icon: <Inbox size={16} />, meta: "badge:6" },
	{
		id: "all",
		label: "All Notes",
		icon: <StickyNote size={16} />,
		meta: "8807",
	},
	{ id: "archive", label: "Archive", icon: <Archive size={16} />, meta: "276" },
];

const FAVORITES = [
	{
		id: "journal",
		label: "Personal Journal",
		icon: <Sun size={16} />,
		hue: "amber",
	},
	{ id: "tolaria", label: "Tolaria MVP", icon: null, hue: "red" },
];

const TYPES = [
	{
		id: "years",
		label: "Years",
		icon: <Calendar size={15} />,
		hue: "red",
		n: 1,
	},
	{
		id: "quarters",
		label: "Quarters",
		icon: <Clock size={15} />,
		hue: "red",
		n: 1,
	},
	{
		id: "projects",
		label: "Projects",
		icon: <Layers size={15} />,
		hue: "orange",
		n: 6,
	},
	{
		id: "resp",
		label: "Responsibilities",
		icon: <ListChecks size={15} />,
		hue: "ink",
		n: 18,
	},
	{
		id: "procedures",
		label: "Procedures",
		icon: <List size={15} />,
		hue: "ink",
		n: 51,
	},
	{
		id: "topics",
		label: "Topics",
		icon: <Tag size={15} />,
		hue: "blue",
		n: 83,
	},
	{
		id: "evergreen",
		label: "Evergreen Notes",
		icon: <Leaf size={15} />,
		hue: "green",
		n: 916,
	},
	{
		id: "essays",
		label: "Essays",
		icon: <BookOpen size={15} />,
		hue: "green",
		n: 448,
	},
	{
		id: "resources",
		label: "Resources",
		icon: <Box size={15} />,
		hue: "green",
		n: 838,
	},
	{
		id: "releases",
		label: "Release Notes",
		icon: <FileText size={15} />,
		hue: "blue",
		n: 7,
	},
	{
		id: "events",
		label: "Events",
		icon: <CalendarDays size={15} />,
		hue: "amber",
		n: 4243,
	},
	{
		id: "people",
		label: "People",
		icon: <Users size={15} />,
		hue: "red",
		n: 434,
	},
	{ id: "areas", label: "Areas", icon: <MapPin size={15} />, hue: "ink", n: 9 },
	{ id: "types", label: "Types", icon: <Gem size={15} />, hue: "blue", n: 25 },
];

/* --- small pieces --- */

function Chip({ chip }: { chip: TagChip }) {
	return (
		<span className={`mock-tn__chip mock-tn__chip--${chip.tone}`}>
			{chip.link ? <Link2 size={10} /> : <Tag size={10} />}
			{chip.label}
		</span>
	);
}

function NoteMarker({ marker }: { marker?: Note["marker"] }) {
	if (marker === "orange")
		return <span className="mock-tn__mark mock-tn__mark--orange" />;
	if (marker === "glyph")
		return <span className="mock-tn__mark mock-tn__mark--glyph">⌘</span>;
	if (marker === "image")
		return <span className="mock-tn__mark mock-tn__mark--image" />;
	return null;
}

function SectionLabel({
	label,
	meta,
	onAdd,
}: {
	label: string;
	meta?: ReactNode;
	onAdd?: boolean;
}) {
	return (
		<div className="mock-tn__section">
			<span className="mock-tn__sectionlabel">{label}</span>
			<span className="mock-tn__sectionmeta">{meta}</span>
			{onAdd && (
				<button
					type="button"
					className="mock-tn__sectionadd"
					aria-label={`Add to ${label}`}
				>
					<Plus size={13} />
				</button>
			)}
		</div>
	);
}

/* --- main --- */

let addedSeq = 0;

export function TolariaNotesMock() {
	const [notes, setNotes] = useState<Note[]>(NOTES);
	const [box, setBox] = useState<Box>("inbox");
	const [sideSel, setSideSel] = useState("inbox");
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [sortDesc, setSortDesc] = useState(true);
	const [openId, setOpenId] = useState<string | null>(null);
	const [starred, setStarred] = useState(false);
	const [panelOpen, setPanelOpen] = useState(true);
	const [extraRels, setExtraRels] = useState(0);

	const openDoc: Doc = useMemo(() => {
		const n = notes.find((x) => x.id === openId);
		return n ? n.doc : ESSAY_DOC;
	}, [notes, openId]);

	const openTitle = openId
		? (notes.find((x) => x.id === openId)?.title ?? "")
		: "The State of Product Development";

	const visible = useMemo(() => {
		const pool = box === "all" ? notes : notes.filter((n) => n.box === box);
		const q = query.trim().toLowerCase();
		const filtered = q
			? pool.filter((n) =>
					[n.title, n.preview, ...n.tags.map((t) => t.label)]
						.join(" ")
						.toLowerCase()
						.includes(q),
				)
			: pool;
		return [...filtered].sort((a, b) =>
			sortDesc ? a.mins - b.mins : b.mins - a.mins,
		);
	}, [notes, box, query, sortDesc]);

	function pickSidebar(id: string) {
		setSideSel(id);
		if (id === "inbox" || id === "all" || id === "archive") setBox(id);
	}

	function openNote(id: string) {
		setOpenId(id);
		setStarred(false);
	}

	function addNote() {
		addedSeq += 1;
		const note: Note = {
			id: `added-${addedSeq}`,
			box: "inbox",
			title: "Untitled note",
			preview:
				"Start writing — this note lives in the inbox until you file it…",
			tags: [],
			ago: "just now",
			mins: -1,
			created: "Created just now",
			external: false,
			doc: doc({
				slug: "untitled",
				status: "Draft",
				date: "May 6, 2026",
				body: (
					<p>
						Start writing — this note lives in the inbox until you file it under
						a type or a folder.
					</p>
				),
			}),
		};
		setNotes((cur) => [note, ...cur]);
		setBox("inbox");
		setSideSel("inbox");
		setOpenId(note.id);
	}

	return (
		<div className={`mock-tn ${panelOpen ? "" : "mock-tn--nopanel"}`}>
			{/* window chrome — sidebar segment */}
			<div className="mock-tn__chrome mock-tn__chrome--side">
				<span className="mock-tn__lights" aria-hidden="true">
					<i className="mock-tn__light mock-tn__light--red" />
					<i className="mock-tn__light mock-tn__light--amber" />
					<i className="mock-tn__light mock-tn__light--green" />
				</span>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="Toggle sidebar"
				>
					<PanelLeft size={15} />
				</button>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="Back"
					disabled
				>
					<ChevronLeft size={15} />
				</button>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="Forward"
					disabled
				>
					<ChevronRight size={15} />
				</button>
			</div>

			{/* window chrome — list segment */}
			<div className="mock-tn__chrome mock-tn__chrome--list">
				<strong className="mock-tn__listtitle">
					{box === "inbox" ? "Inbox" : box === "all" ? "All Notes" : "Archive"}
				</strong>
				<span className="mock-tn__chromespacer" />
				<button
					type="button"
					className="mock-tn__sort"
					onClick={() => setSortDesc((v) => !v)}
					title="Sort by modified"
				>
					{sortDesc ? (
						<ArrowDownNarrowWide size={13} />
					) : (
						<ArrowUpWideNarrow size={13} />
					)}
					Modified
				</button>
				<button
					type="button"
					className={`mock-tn__barbtn ${searchOpen ? "is-on" : ""}`}
					aria-label="Search notes"
					onClick={() => {
						setSearchOpen((v) => !v);
						if (searchOpen) setQuery("");
					}}
				>
					<Search size={14} />
				</button>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="View options"
				>
					<Columns2 size={14} />
				</button>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="New note"
					onClick={addNote}
				>
					<Plus size={15} />
				</button>
			</div>

			{/* window chrome — editor segment */}
			<div className="mock-tn__chrome mock-tn__chrome--editor">
				<span className="mock-tn__doctype">
					<span className="mock-tn__doctypeicon">{openDoc.typeIcon}</span>
					{openDoc.type}
				</span>
				<span className="mock-tn__slug">{openDoc.slug}</span>
				<span className="mock-tn__chromespacer" />
				<button
					type="button"
					className={`mock-tn__barbtn ${starred ? "is-starred" : ""}`}
					aria-label="Favorite"
					onClick={() => setStarred((v) => !v)}
				>
					<Star size={14} fill={starred ? "currentColor" : "none"} />
				</button>
				<span className="mock-tn__statusdot" title={openDoc.status} />
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="Split view"
				>
					<Columns2 size={14} />
				</button>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="View source"
				>
					<Code size={14} />
				</button>
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="AI actions"
				>
					<Sparkles size={14} />
				</button>
				<button type="button" className="mock-tn__barbtn" aria-label="Outline">
					<List size={14} />
				</button>
				{!panelOpen && (
					<button
						type="button"
						className="mock-tn__barbtn"
						aria-label="Show properties"
						onClick={() => setPanelOpen(true)}
					>
						<PanelRight size={14} />
					</button>
				)}
				<button
					type="button"
					className="mock-tn__barbtn"
					aria-label="More actions"
				>
					<MoreHorizontal size={14} />
				</button>
			</div>

			{/* window chrome — properties segment */}
			{panelOpen && (
				<div className="mock-tn__chrome mock-tn__chrome--props">
					<PanelLeft size={14} />
					<strong>Properties</strong>
					<span className="mock-tn__chromespacer" />
					<button
						type="button"
						className="mock-tn__barbtn"
						aria-label="Close properties"
						onClick={() => setPanelOpen(false)}
					>
						<X size={14} />
					</button>
				</div>
			)}

			{/* sidebar */}
			<nav className="mock-tn__sidebar" aria-label="Notes navigation">
				<div className="mock-tn__sidegroup">
					{SIDEBAR_MAIN.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`mock-tn__sideitem ${sideSel === item.id ? "is-active" : ""}`}
							onClick={() => pickSidebar(item.id)}
						>
							{item.icon}
							<span className="mock-tn__sidelabel">{item.label}</span>
							{item.meta === "badge:6" ? (
								<span className="mock-tn__countbadge">6</span>
							) : (
								<span className="mock-tn__sidecount tw-tnum">{item.meta}</span>
							)}
						</button>
					))}
				</div>

				<SectionLabel
					label="Favorites"
					meta={<span className="tw-tnum">2</span>}
				/>
				<div className="mock-tn__sidegroup">
					{FAVORITES.map((f) => (
						<button
							key={f.id}
							type="button"
							className={`mock-tn__sideitem ${sideSel === f.id ? "is-active" : ""}`}
							onClick={() => pickSidebar(f.id)}
						>
							<span className={`mock-tn__favicon mock-tn__hue--${f.hue}`}>
								{f.icon ?? <span className="mock-tn__favdot" />}
							</span>
							<span className="mock-tn__sidelabel">{f.label}</span>
						</button>
					))}
				</div>

				<SectionLabel label="Views" onAdd />
				<SectionLabel
					label="Types"
					meta={
						<span className="mock-tn__sectiontools">
							<List size={12} />
							<LayoutGridIcon />
						</span>
					}
					onAdd
				/>
				<div className="mock-tn__sidegroup mock-tn__sidegroup--types">
					{TYPES.map((t) => (
						<button
							key={t.id}
							type="button"
							className={`mock-tn__sideitem mock-tn__sideitem--type ${sideSel === t.id ? "is-active" : ""}`}
							onClick={() => pickSidebar(t.id)}
						>
							<span className={`mock-tn__typeicon mock-tn__hue--${t.hue}`}>
								{t.icon}
							</span>
							<span className="mock-tn__sidelabel">{t.label}</span>
							<span className="mock-tn__sidecount tw-tnum">{t.n}</span>
						</button>
					))}
				</div>

				<SectionLabel label="Folders" onAdd />
				<div className="mock-tn__sidegroup">
					<button
						type="button"
						className={`mock-tn__sideitem ${sideSel === "laputa" ? "is-active" : ""}`}
						onClick={() => pickSidebar("laputa")}
					>
						<Folder size={15} />
						<span className="mock-tn__sidelabel">laputa</span>
					</button>
					<button
						type="button"
						className={`mock-tn__sideitem mock-tn__sideitem--child ${sideSel === "assets" ? "is-active" : ""}`}
						onClick={() => pickSidebar("assets")}
					>
						<Folder size={14} />
						<span className="mock-tn__sidelabel">assets</span>
					</button>
					<button
						type="button"
						className={`mock-tn__sideitem mock-tn__sideitem--child ${sideSel === "attachments" ? "is-active" : ""}`}
						onClick={() => pickSidebar("attachments")}
					>
						<Folder size={14} />
						<span className="mock-tn__sidelabel">attachments</span>
					</button>
				</div>
			</nav>

			{/* note list */}
			<div className="mock-tn__list">
				{searchOpen && (
					<div className="mock-tn__searchrow">
						<Search size={13} />
						<input
							autoFocus
							placeholder="Search inbox…"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							aria-label="Filter notes"
						/>
						{query && (
							<button
								type="button"
								aria-label="Clear search"
								onClick={() => setQuery("")}
							>
								<X size={12} />
							</button>
						)}
					</div>
				)}
				{visible.length === 0 ? (
					<div className="mock-tn__empty">
						<Inbox size={20} />
						<p>{query ? `No notes match “${query}”.` : "Nothing here yet."}</p>
					</div>
				) : (
					visible.map((n) => (
						<article
							key={n.id}
							className={`mock-tn__note ${openId === n.id ? "is-open" : ""}`}
							onClick={() => openNote(n.id)}
						>
							<div className="mock-tn__notehead">
								<strong>
									<NoteMarker marker={n.marker} />
									{n.title}
								</strong>
								{n.external && (
									<SquarePen size={13} className="mock-tn__noteedit" />
								)}
							</div>
							<p>{n.preview}</p>
							{n.tags.length > 0 && (
								<div className="mock-tn__notechips">
									{n.tags.map((t) => (
										<Chip key={t.label} chip={t} />
									))}
								</div>
							)}
							<div className="mock-tn__notefoot">
								<span>{n.ago}</span>
								<span>{n.created}</span>
							</div>
						</article>
					))
				)}
			</div>

			{/* editor */}
			<main className="mock-tn__editor">
				<div className="mock-tn__doc">
					<h1 className="mock-tn__doctitle">{openTitle}</h1>
					<div className="mock-tn__blocks">
						<span className="mock-tn__gutter" aria-hidden="true">
							<Plus size={14} />
							<GripVertical size={14} />
						</span>
						{openDoc.body}
					</div>
				</div>
			</main>

			{/* properties panel */}
			{panelOpen && (
				<aside className="mock-tn__props" aria-label="Note properties">
					<div className="mock-tn__propscroll">
						<div className="mock-tn__proprows">
							<PropRow icon={<Tag size={13} />} label="Type">
								<span className="mock-tn__valuechip">
									<span className="mock-tn__doctypeicon">
										{openDoc.typeIcon}
									</span>
									{openDoc.type}
									<ChevronDown size={11} />
								</span>
							</PropRow>
							<PropRow icon={<CircleDotIcon />} label="Status">
								<span className="mock-tn__statusval">
									<i /> {openDoc.status}
								</span>
							</PropRow>
							<PropRow icon={<Calendar size={13} />} label="Date">
								{openDoc.date}
							</PropRow>
							<PropRow icon={<Hash size={13} />} label="Notion id">
								<span className="mock-tn__mono">{openDoc.notionId}</span>
							</PropRow>
							<PropRow icon={<Link2 size={13} />} label="URL">
								{openDoc.url}
							</PropRow>
							<PropRow icon={<Smile size={13} />} label="Icon">
								—
							</PropRow>
							<button type="button" className="mock-tn__ghostrow">
								<Plus size={13} /> Add property
							</button>
						</div>

						<RelationSection label="Belongs to">
							{openDoc.belongsTo && (
								<span
									className={`mock-tn__relchip mock-tn__chip--${openDoc.belongsTo.tone}`}
								>
									<Tag size={11} />
									{openDoc.belongsTo.label}
									<ExternalLink size={11} className="mock-tn__relopen" />
								</span>
							)}
						</RelationSection>

						<RelationSection label="Has Notes">
							{openDoc.hasNotes.map((h) => (
								<span key={h} className="mock-tn__relchip mock-tn__chip--green">
									<StickyNote size={11} />
									{h}
									<ExternalLink size={11} className="mock-tn__relopen" />
								</span>
							))}
						</RelationSection>

						<RelationSection label="Belongs to" />
						<RelationSection label="Related to" />
						<RelationSection label="Has" />
						{Array.from({ length: extraRels }, (_, i) => (
							<RelationSection key={`new-${i}`} label="New relation" />
						))}

						<button
							type="button"
							className="mock-tn__addrel"
							onClick={() => setExtraRels((n) => n + 1)}
						>
							<Plus size={13} /> Add relationship
						</button>

						<RelationSection label="Children" />
					</div>
				</aside>
			)}

			{/* status bar */}
			<footer className="mock-tn__statusbar">
				<span className="mock-tn__stitem">
					<Folder size={12} /> laputa
				</span>
				<span className="mock-tn__stitem">
					<FlaskConical size={12} /> Alpha 2026.5.7.5
				</span>
				<span className="mock-tn__stitem mock-tn__stitem--changes">
					<i /> 3 Changes
				</span>
				<button type="button" className="mock-tn__stitem mock-tn__stbtn">
					<GitCommitHorizontal size={13} /> Commit
				</button>
				<span className="mock-tn__stitem mock-tn__stitem--synced">
					<CloudCheck size={13} /> Synced 2m ago
				</span>
				<button
					type="button"
					className="mock-tn__stitem mock-tn__stbtn mock-tn__stitem--dim"
				>
					<History size={12} /> History
				</button>
				<span className="mock-tn__chromespacer" />
				<span className="mock-tn__stitem mock-tn__stitem--claude">
					<Asterisk size={13} /> Claude
				</span>
				<button type="button" className="mock-tn__stitem mock-tn__stbtn">
					<GitPullRequest size={12} /> Contribute
				</button>
				<button
					type="button"
					className="mock-tn__stbtnicon"
					aria-label="Notifications"
				>
					<Bell size={12} />
				</button>
				<button
					type="button"
					className="mock-tn__stbtnicon"
					aria-label="Sync status"
				>
					<Check size={12} />
				</button>
			</footer>
		</div>
	);
}

/* --- properties helpers --- */

function PropRow({
	icon,
	label,
	children,
}: {
	icon: ReactNode;
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="mock-tn__proprow">
			<span className="mock-tn__proplabel">
				{icon}
				{label}
			</span>
			<span className="mock-tn__propval">{children}</span>
		</div>
	);
}

function RelationSection({
	label,
	children,
}: {
	label: string;
	children?: ReactNode;
}) {
	return (
		<section className="mock-tn__rel">
			<h4 className="mock-tn__rellabel">{label}</h4>
			{children}
			<button type="button" className="mock-tn__dashed">
				Add
			</button>
		</section>
	);
}

/* tiny inline icons not worth a lucide lookup */
function LayoutGridIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="3" y="3" width="7" height="7" rx="1" />
			<rect x="14" y="3" width="7" height="7" rx="1" />
			<rect x="3" y="14" width="7" height="7" rx="1" />
			<rect x="14" y="14" width="7" height="7" rx="1" />
		</svg>
	);
}

function CircleDotIcon() {
	return <span className="mock-tn__propdot" />;
}
