/* Mock content for the app shell — placeholder data until the notes plugin
   drives these regions for real. */

import {
	Archive,
	BookOpen,
	Box as BoxIcon,
	Calendar,
	CalendarDays,
	Clock,
	FileText,
	Gem,
	Inbox,
	Layers,
	Leaf,
	List,
	ListChecks,
	MapPin,
	StickyNote,
	Sun,
	Tag,
	Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Box, Doc, Note } from "./types";

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
			<span className="shell__link">Listening Tour</span>. This survey is our
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
				<span className="shell__emoji">🏈</span> <strong>Demographics</strong> —
				a quick note on the data.
			</li>
			<li>
				<span className="shell__emoji">📋</span>{" "}
				<strong>The Planning Problem</strong> — why 59% of teams discover
				missing work mid-cycle, every cycle.
			</li>
			<li>
				<span className="shell__emoji">🖊️</span>{" "}
				<strong>AI in the Workflow</strong> — what teams are using AI for (and
				the one use case almost nobody has tried).
			</li>
			<li>
				<span className="shell__emoji">🧪</span>{" "}
				<strong>The Experimentation Gap</strong> — why some teams are
				compounding returns while others stall at the pilot.
			</li>
		</ul>
	</>
);

export const ESSAY_DOC: Doc = {
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

export function doc(over: Partial<Doc> & { body: ReactNode }): Doc {
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

export const NOTES: Note[] = [
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
		doc: doc({
			type: "Resource",
			typeIcon: <BoxIcon size={13} />,
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
		doc: doc({
			type: "Resource",
			typeIcon: <BoxIcon size={13} />,
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
		doc: doc({
			type: "Release",
			typeIcon: <FileText size={13} />,
			slug: "v2026-04-28",
			status: "Published",
			date: "Apr 28, 2026",
			belongsTo: { label: "Tolaria MVP", tone: "red" },
			body: (
				<p>
					Hotfix release: sync cursor loss on sleep/wake and a crash in the
					relation picker. No new surface area.
				</p>
			),
		}),
	},
];

export const SIDEBAR_MAIN: {
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

export const FAVORITES: { id: string; label: string; icon: ReactNode; color: string }[] = [
	{
		id: "journal",
		label: "Personal Journal",
		icon: <Sun size={16} />,
		color: "#d9930d",
	},
	{ id: "tolaria", label: "Tolaria MVP", icon: null, color: "#c2334d" },
];

export const TYPES: { id: string; label: string; icon: ReactNode; color: string; n: number }[] = [
	{
		id: "years",
		label: "Years",
		icon: <Calendar size={15} />,
		color: "#c2334d",
		n: 1,
	},
	{
		id: "quarters",
		label: "Quarters",
		icon: <Clock size={15} />,
		color: "#c2334d",
		n: 1,
	},
	{
		id: "projects",
		label: "Projects",
		icon: <Layers size={15} />,
		color: "#e8890c",
		n: 6,
	},
	{
		id: "resp",
		label: "Responsibilities",
		icon: <ListChecks size={15} />,
		color: "#626274",
		n: 18,
	},
	{
		id: "procedures",
		label: "Procedures",
		icon: <List size={15} />,
		color: "#626274",
		n: 51,
	},
	{
		id: "topics",
		label: "Topics",
		icon: <Tag size={15} />,
		color: "#3563d9",
		n: 83,
	},
	{
		id: "evergreen",
		label: "Evergreen Notes",
		icon: <Leaf size={15} />,
		color: "#1e7d46",
		n: 916,
	},
	{
		id: "essays",
		label: "Essays",
		icon: <BookOpen size={15} />,
		color: "#1e7d46",
		n: 448,
	},
	{
		id: "resources",
		label: "Resources",
		icon: <BoxIcon size={15} />,
		color: "#1e7d46",
		n: 838,
	},
	{
		id: "releases",
		label: "Release Notes",
		icon: <FileText size={15} />,
		color: "#3563d9",
		n: 7,
	},
	{
		id: "events",
		label: "Events",
		icon: <CalendarDays size={15} />,
		color: "#d9930d",
		n: 4243,
	},
	{
		id: "people",
		label: "People",
		icon: <Users size={15} />,
		color: "#c2334d",
		n: 434,
	},
	{ id: "areas", label: "Areas", icon: <MapPin size={15} />, color: "#626274", n: 9 },
	{ id: "types", label: "Types", icon: <Gem size={15} />, color: "#3563d9", n: 25 },
];
