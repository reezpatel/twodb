/* NotesOverview mock — knowledge base management: stat cards, tabbed
   document grid/list with sort + search, and a complete detail sidebar.
   Reference anatomy, Cyclorama grammar (hairlines, flat cobalt, IBM Plex Sans cues). */

import { type CSSProperties, useMemo, useState } from "react";
import {
	Badge,
	Button,
	IconButton,
	Menu,
	MenuDivider,
	MenuItem,
} from "@twodb/ui";
import {
	Activity,
	ArrowUpDown,
	BookOpen,
	Check,
	ChevronRight,
	Eye,
	FileText,
	Folder,
	Globe,
	Inbox,
	LayoutGrid,
	Link2,
	List,
	MoreVertical,
	Pencil,
	Plus,
	RefreshCw,
	Search,
	Settings,
	Trash2,
	TrendingDown,
	TrendingUp,
	Upload,
	X,
} from "lucide-react";
import "./NotesOverview.css";

/* --- data --- */

type DocSource = "notion" | "pdf" | "link";
type DocStatus =
	| { kind: "chunks"; n: number }
	| { kind: "pending" }
	| { kind: "reindex" };

interface DocDetail {
	category: string;
	type: string;
	size: string;
	model: string;
	coverage: string;
	pct: number;
	retrieved: string;
	sim: string;
	lastHit: string;
	tags: string[];
	chunkId: string;
	chunkTime: string;
	chunkText: string;
}

interface Doc {
	id: string;
	title: string;
	desc: string;
	source: DocSource;
	ago: string;
	mins: number;
	status: DocStatus;
	archived?: boolean;
	detail: DocDetail;
}

function detail(over: Partial<DocDetail> & { chunkText: string }): DocDetail {
	return {
		category: "General",
		type: "PDF",
		size: "64 KB",
		model: "text-embed-3",
		coverage: "2 hours ago",
		pct: 92,
		retrieved: "128 times",
		sim: "0.84",
		lastHit: "6 min ago",
		tags: ["Policy"],
		chunkId: "chunk #2",
		chunkTime: "0.88s",
		...over,
	};
}

const DOCS: Doc[] = [
	{
		id: "returns",
		title: "Return Policy v4",
		desc: "Covers the updated 30-day return window, including eligibility criteria, condition rules, and refund timelines.",
		source: "pdf",
		ago: "1m ago",
		mins: 1,
		status: { kind: "chunks", n: 14 },
		detail: detail({
			category: "Returns",
			size: "58 KB",
			pct: 100,
			retrieved: "342 times",
			sim: "0.91",
			lastHit: "just now",
			tags: ["Returns", "Refunds", "Policy"],
			chunkId: "chunk #1",
			chunkTime: "0.81s",
			chunkText:
				"Items must be returned within 30 days of delivery in original packaging with all accessories included…",
		}),
	},
	{
		id: "shipping-faq",
		title: "Shipping FAQ",
		desc: "Find answers to common questions about shipping timelines, costs, tracking, and delivery exceptions.",
		source: "notion",
		ago: "48m ago",
		mins: 48,
		status: { kind: "chunks", n: 22 },
		detail: detail({
			category: "Shipping",
			size: "84 KB",
			pct: 95,
			retrieved: "214 times",
			sim: "0.87",
			lastHit: "4 min ago",
			tags: ["Returns", "Refunds", "Policy", "Digital", "International"],
			chunkId: "chunk #3",
			chunkTime: "0.94s",
			chunkText:
				"Items must be returned within 30 days of delivery in original packaging with all accessories included…",
		}),
	},
	{
		id: "refund-sop",
		title: "Refund SOP",
		desc: "Step-by-step process for handling refunds, from request submission to approval and payout.",
		source: "pdf",
		ago: "1h ago",
		mins: 60,
		status: { kind: "pending" },
		detail: detail({
			category: "Payments",
			size: "41 KB",
			pct: 12,
			retrieved: "—",
			sim: "—",
			lastHit: "never",
			tags: ["Refunds", "SOP"],
			chunkId: "chunk #—",
			chunkTime: "—",
			chunkText:
				"Pending first index — chunks will appear here once vectorisation completes.",
		}),
	},
	{
		id: "setup",
		title: "Product Setup Guide",
		desc: "Internal guide for setting up products, including required details, configuration, and QA checks.",
		source: "link",
		ago: "1h ago",
		mins: 74,
		status: { kind: "chunks", n: 17 },
		detail: detail({
			category: "Internal",
			type: "Web page",
			size: "96 KB",
			pct: 88,
			retrieved: "96 times",
			sim: "0.82",
			lastHit: "31 min ago",
			tags: ["Internal", "Setup"],
			chunkText:
				"Every product needs a SKU, tax class, and at least one image before it can be published to the storefront…",
		}),
	},
	{
		id: "b2b",
		title: "B2B Account Policy",
		desc: "Outlines terms for enterprise accounts, including bulk ordering, pricing structures, and invoicing.",
		source: "notion",
		ago: "1h ago",
		mins: 88,
		status: { kind: "chunks", n: 49 },
		detail: detail({
			category: "Enterprise",
			size: "132 KB",
			pct: 97,
			retrieved: "58 times",
			sim: "0.79",
			lastHit: "2 h ago",
			tags: ["B2B", "Pricing", "Policy"],
			chunkId: "chunk #7",
			chunkTime: "1.02s",
			chunkText:
				"Enterprise accounts unlock volume pricing tiers at 25, 100, and 500 units per order line…",
		}),
	},
	{
		id: "warranty",
		title: "Warranty Terms",
		desc: "Details warranty coverage, claim procedures, duration, and exclusions across product lines.",
		source: "pdf",
		ago: "2h ago",
		mins: 122,
		status: { kind: "chunks", n: 11 },
		detail: detail({
			category: "Legal",
			size: "47 KB",
			pct: 100,
			retrieved: "187 times",
			sim: "0.86",
			lastHit: "12 min ago",
			tags: ["Warranty", "Legal"],
			chunkText:
				"Standard coverage runs 24 months from the delivery date; consumables and wear parts are excluded…",
		}),
	},
	{
		id: "tracking",
		title: "Order Tracking Guide",
		desc: "Learn how to track orders, understand each delivery status, and handle common tracking issues.",
		source: "link",
		ago: "2h ago",
		mins: 131,
		status: { kind: "chunks", n: 41 },
		detail: detail({
			category: "Shipping",
			type: "Web page",
			size: "110 KB",
			pct: 93,
			retrieved: "403 times",
			sim: "0.9",
			lastHit: "1 min ago",
			tags: ["Shipping", "Tracking"],
			chunkId: "chunk #5",
			chunkText:
				"A label created status means the carrier has the manifest but not the parcel yet — allow 24 h…",
		}),
	},
	{
		id: "promos",
		title: "Promotions & Discounts",
		desc: "Overview of active promotions, discount rules, eligibility, and how referral programs stack.",
		source: "notion",
		ago: "3h ago",
		mins: 190,
		status: { kind: "chunks", n: 38 },
		detail: detail({
			category: "Marketing",
			size: "88 KB",
			pct: 90,
			retrieved: "74 times",
			sim: "0.81",
			lastHit: "44 min ago",
			tags: ["Discounts", "Marketing"],
			chunkText:
				"Referral credits stack with seasonal promotions but never with wholesale pricing tiers…",
		}),
	},
	{
		id: "privacy",
		title: "Privacy Policy",
		desc: "Explains how user data is collected, used, and protected in compliance with GDPR and CCPA.",
		source: "pdf",
		ago: "6h ago",
		mins: 360,
		status: { kind: "reindex" },
		detail: detail({
			category: "Legal",
			size: "72 KB",
			pct: 61,
			retrieved: "151 times",
			sim: "0.85",
			lastHit: "18 min ago",
			tags: ["Privacy", "Legal", "Compliance"],
			chunkId: "chunk #4",
			chunkTime: "0.9s",
			chunkText:
				"Customers may request a full export or deletion of stored personal data at any time via…",
		}),
	},
	{
		id: "hours",
		title: "Contact & Support Hours",
		desc: "Provides support availability, working hours across time zones, and escalation paths.",
		source: "link",
		ago: "9h ago",
		mins: 540,
		status: { kind: "chunks", n: 19 },
		detail: detail({
			category: "Support",
			type: "Web page",
			size: "39 KB",
			pct: 100,
			retrieved: "264 times",
			sim: "0.88",
			lastHit: "9 min ago",
			tags: ["Support", "Hours"],
			chunkText:
				"Live chat runs 08:00–22:00 CET weekdays; priority escalation is available for enterprise…",
		}),
	},
	{
		id: "intl",
		title: "International Shipping",
		desc: "Covers international delivery options, customs duties, restricted regions, and carriers.",
		source: "notion",
		ago: "1d ago",
		mins: 1500,
		status: { kind: "chunks", n: 32 },
		detail: detail({
			category: "Shipping",
			size: "101 KB",
			pct: 94,
			retrieved: "119 times",
			sim: "0.83",
			lastHit: "1 h ago",
			tags: ["International", "Shipping", "Customs"],
			chunkId: "chunk #6",
			chunkTime: "0.97s",
			chunkText:
				"Duties for orders over €150 are collected at checkout for CA, UK, and NO destinations…",
		}),
	},
];

/* only visible under “All Documents” */
const ARCHIVED: Doc[] = [
	{
		id: "holiday",
		title: "Holiday Schedule 2025",
		desc: "Warehouse and carrier cut-off dates for the 2025 holiday season, per region.",
		source: "pdf",
		ago: "3d ago",
		mins: 4300,
		status: { kind: "chunks", n: 8 },
		archived: true,
		detail: detail({
			category: "Operations",
			size: "22 KB",
			pct: 100,
			retrieved: "41 times",
			sim: "0.77",
			lastHit: "2 d ago",
			tags: ["Operations"],
			chunkText:
				"Last guaranteed pickup before Dec 24 is Dec 20 14:00 for EU destinations…",
		}),
	},
	{
		id: "legacy-returns",
		title: "Legacy Return Policy v3",
		desc: "Superseded return terms kept for orders placed before the v4 policy took effect.",
		source: "pdf",
		ago: "5d ago",
		mins: 7200,
		status: { kind: "chunks", n: 22 },
		archived: true,
		detail: detail({
			category: "Returns",
			size: "55 KB",
			pct: 100,
			retrieved: "19 times",
			sim: "0.74",
			lastHit: "4 d ago",
			tags: ["Returns", "Legacy"],
			chunkText:
				"The previous 14-day window applies to all orders confirmed before March 1…",
		}),
	},
	{
		id: "onboarding",
		title: "Onboarding Handbook",
		desc: "New-hire guide for the support team: tools, macros, tone of voice, and first-week goals.",
		source: "notion",
		ago: "1w ago",
		mins: 11000,
		status: { kind: "chunks", n: 64 },
		archived: true,
		detail: detail({
			category: "Internal",
			size: "210 KB",
			pct: 96,
			retrieved: "33 times",
			sim: "0.8",
			lastHit: "3 d ago",
			tags: ["Internal", "Onboarding"],
			chunkId: "chunk #9",
			chunkText:
				"Shadow two live chats on day one, then answer with a buddy reviewing before send…",
		}),
	},
	{
		id: "api-notice",
		title: "API Migration Notice",
		desc: "Deprecation timeline for the v1 tracking endpoints and the migration path to v2 webhooks.",
		source: "link",
		ago: "2w ago",
		mins: 21000,
		status: { kind: "chunks", n: 9 },
		archived: true,
		detail: detail({
			category: "Engineering",
			type: "Web page",
			size: "34 KB",
			pct: 100,
			retrieved: "12 times",
			sim: "0.72",
			lastHit: "1 w ago",
			tags: ["API", "Deprecation"],
			chunkText:
				"v1 endpoints stop responding on Oct 1; migrate webhook receivers before Sep 15…",
		}),
	},
];

const STATS = [
	{
		label: "Total Documents",
		value: "94.201",
		delta: "+3.841",
		up: true,
		caption: "Expanded knowledge, broader coverage.",
		bars: [0.4, 0.55, 0.45, 0.7, 1],
	},
	{
		label: "Avarage Retrieval",
		value: "0.9s",
		delta: "+02s",
		up: true,
		caption: "Faster access, smoother responses.",
		bars: [0.5, 0.42, 0.6, 0.55, 0.85],
	},
	{
		label: "Hit Rate",
		value: "87%",
		delta: "-4%",
		up: false,
		caption: "Lower accuracy, needs refinement.",
		bars: [0.7, 0.85, 0.6, 0.75, 0.5],
	},
];

const RAIL = [
	{ id: "dash", icon: <LayoutGrid size={18} />, label: "Overview" },
	{ id: "activity", icon: <Activity size={18} />, label: "Activity" },
	{ id: "inbox", icon: <Inbox size={18} />, label: "Inbox" },
	{ id: "kb", icon: <BookOpen size={18} />, label: "Knowledge base" },
	{ id: "links", icon: <Link2 size={18} />, label: "Sources" },
];

type SortKey = "updated" | "name" | "chunks";
const SORTS: { id: SortKey; label: string }[] = [
	{ id: "updated", label: "Recently updated" },
	{ id: "name", label: "Name A–Z" },
	{ id: "chunks", label: "Most chunks" },
];

/* --- small pieces --- */

function SourceTile({ source }: { source: DocSource }) {
	if (source === "notion")
		return <span className="mock-no__tile mock-no__tile--notion">N</span>;
	if (source === "pdf")
		return (
			<span className="mock-no__tile mock-no__tile--pdf">
				<FileText size={16} />
			</span>
		);
	return (
		<span className="mock-no__tile mock-no__tile--link">
			<Link2 size={16} />
		</span>
	);
}

function StatusChip({ status }: { status: DocStatus }) {
	if (status.kind === "pending") return <Badge tone="warning">Pending</Badge>;
	if (status.kind === "reindex") return <Badge tone="rose">Re-indexing…</Badge>;
	return <span className="mock-no__chip">{status.n} chunks</span>;
}

function StatCard({ stat }: { stat: (typeof STATS)[number] }) {
	return (
		<section className="mock-no__stat">
			<span className="mock-no__statlabel">{stat.label}</span>
			<div className="mock-no__statmid">
				<div className="mock-no__statvalue">
					<strong className="tw-tnum">{stat.value}</strong>
					<span className={`mock-no__delta ${stat.up ? "is-up" : "is-down"}`}>
						{stat.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
						{stat.delta}
					</span>
				</div>
				<div className="mock-no__bars" aria-hidden="true">
					{stat.bars.map((h, i) => (
						<span
							key={i}
							style={{ height: `${Math.round(h * 34)}px` }}
							className={
								i === stat.bars.length - 1
									? stat.up
										? "is-accent"
										: "is-danger"
									: ""
							}
						/>
					))}
				</div>
			</div>
			<span className="mock-no__statcap">{stat.caption}</span>
		</section>
	);
}

/* --- detail sidebar --- */

function InfoRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mock-no__row">
			<span>{label}</span>
			<strong>{children}</strong>
		</div>
	);
}

function DetailPanel({
	doc,
	reindexing,
	progress,
	onReindex,
	onClose,
}: {
	doc: Doc;
	reindexing: boolean;
	progress: number;
	onReindex: () => void;
	onClose: () => void;
}) {
	const d = doc.detail;
	return (
		<aside className="mock-no__panel">
			<header className="mock-no__panelhead">
				<h3>{doc.title}</h3>
				<IconButton
					label="Close panel"
					icon={<X />}
					size="sm"
					variant="ghost"
					onClick={onClose}
				/>
			</header>

			<div className="mock-no__panelbody">
				<section>
					<h4 className="mock-no__cue">Document info</h4>
					<InfoRow label="Source">
						<span className="mock-no__sourceval">
							<SourceTile source={doc.source} />
							{doc.source === "notion"
								? "Notions"
								: doc.source === "pdf"
									? "Upload"
									: "Web link"}
						</span>
					</InfoRow>
					<InfoRow label="Category">{d.category}</InfoRow>
					<InfoRow label="Type">{d.type}</InfoRow>
					<InfoRow label="Updated">
						{doc.ago
							.replace("m ago", " min ago")
							.replace("h ago", " hours ago")
							.replace("d ago", " days ago")}
					</InfoRow>
					<InfoRow label="Size">{d.size}</InfoRow>
				</section>

				<section>
					<h4 className="mock-no__cue">Vectorisation</h4>
					<InfoRow label="Status">
						{reindexing ? (
							<span className="mock-no__warn">Indexing…</span>
						) : doc.status.kind === "pending" ? (
							<span className="mock-no__warn">Pending</span>
						) : (
							<span className="mock-no__ok">
								<Check size={13} /> Indexed
							</span>
						)}
					</InfoRow>
					<InfoRow label="Chunks">
						{doc.status.kind === "chunks"
							? `${doc.status.n}/${doc.status.n}`
							: "0/0"}
					</InfoRow>
					<InfoRow label="Model">{d.model}</InfoRow>
					<InfoRow label="Coverage">{d.coverage}</InfoRow>
					<InfoRow label="Size">
						{reindexing ? `${Math.round(progress)}%` : `${d.pct}%`}
					</InfoRow>
					<div className="mock-no__track">
						<span
							className="mock-no__fill"
							style={
								{
									"--fill": (reindexing ? progress : d.pct) / 100,
								} as CSSProperties
							}
						/>
					</div>
				</section>

				<section>
					<h4 className="mock-no__cue">Usage stats</h4>
					<InfoRow label="Retrieved">{d.retrieved}</InfoRow>
					<InfoRow label="Avg similarity">{d.sim}</InfoRow>
					<InfoRow label="Last hit">{d.lastHit}</InfoRow>
				</section>

				<section>
					<h4 className="mock-no__cue">Tags</h4>
					<div className="mock-no__tags">
						{d.tags.map((t) => (
							<span key={t} className="mock-no__tag">
								{t}
							</span>
						))}
					</div>
				</section>

				<section>
					<h4 className="mock-no__cue">Top chunks</h4>
					<div className="mock-no__chunkhead">
						<strong>{d.chunkId}</strong>
						<span className="tw-tnum">{d.chunkTime}</span>
					</div>
					<blockquote className="mock-no__quote">{d.chunkText}</blockquote>
				</section>
			</div>

			<footer className="mock-no__panelfoot">
				<Button
					variant="primary"
					onClick={onReindex}
					disabled={reindexing}
					style={{ width: "100%", justifyContent: "center" }}
				>
					<RefreshCw
						size={15}
						className={reindexing ? "mock-no__spin" : undefined}
					/>
					{reindexing ? "Indexing…" : "Re-index Document"}
				</Button>
			</footer>
		</aside>
	);
}

/* --- main --- */

let addedSeq = 0;

export function NotesOverviewMock() {
	const [docs, setDocs] = useState<Doc[]>([...DOCS, ...ARCHIVED]);
	const [tab, setTab] = useState<"recent" | "all">("recent");
	const [sort, setSort] = useState<SortKey>("updated");
	const [view, setView] = useState<"grid" | "list">("grid");
	const [query, setQuery] = useState("");
	const [selectedId, setSelectedId] = useState("shipping-faq");
	const [panelOpen, setPanelOpen] = useState(true);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);

	const visible = useMemo(() => {
		const pool = tab === "recent" ? docs.filter((d) => !d.archived) : docs;
		const q = query.trim().toLowerCase();
		const filtered = q
			? pool.filter((d) =>
					[d.title, d.desc, d.detail.category, ...d.detail.tags]
						.join(" ")
						.toLowerCase()
						.includes(q),
				)
			: pool;
		const byChunks = (d: Doc) => (d.status.kind === "chunks" ? d.status.n : 0);
		return [...filtered].sort((a, b) =>
			sort === "name"
				? a.title.localeCompare(b.title)
				: sort === "chunks"
					? byChunks(b) - byChunks(a)
					: a.mins - b.mins,
		);
	}, [docs, tab, sort, query]);

	const selected = docs.find((d) => d.id === selectedId) ?? null;

	function pick(id: string) {
		setSelectedId(id);
		setPanelOpen(true);
	}

	function removeDoc(id: string) {
		setDocs((cur) => {
			const next = cur.filter((d) => d.id !== id);
			if (id === selectedId) setSelectedId(next[0]?.id ?? "");
			return next;
		});
	}

	function addSource(source: DocSource) {
		addedSeq += 1;
		const names: Record<DocSource, string> = {
			notion: "New Notion page",
			pdf: "Uploaded PDF",
			link: "Linked web page",
		};
		const doc: Doc = {
			id: `added-${addedSeq}`,
			title: names[source],
			desc: "Waiting to be indexed — content appears after the first crawl completes.",
			source,
			ago: "just now",
			mins: 0,
			status: { kind: "pending" },
			detail: detail({
				category: "Uncategorised",
				type: source === "link" ? "Web page" : "PDF",
				size: "—",
				pct: 0,
				retrieved: "—",
				sim: "—",
				lastHit: "never",
				tags: ["New"],
				chunkId: "chunk #—",
				chunkTime: "—",
				chunkText:
					"Pending first index — chunks will appear here once vectorisation completes.",
			}),
		};
		setDocs((cur) => [doc, ...cur]);
		setSelectedId(doc.id);
		setPanelOpen(true);
	}

	function reindex(id: string) {
		if (busyId) return;
		setBusyId(id);
		setProgress(0);
		setDocs((cur) =>
			cur.map((d) => (d.id === id ? { ...d, status: { kind: "reindex" } } : d)),
		);
		requestAnimationFrame(() => requestAnimationFrame(() => setProgress(96)));
		setTimeout(() => {
			setDocs((cur) =>
				cur.map((d) =>
					d.id === id
						? {
								...d,
								status: {
									kind: "chunks",
									n: d.status.kind === "chunks" ? d.status.n : 22,
								},
							}
						: d,
				),
			);
			setBusyId(null);
		}, 2600);
	}

	return (
		<div className="mock-no">
			{/* slim app rail */}
			<nav className="mock-no__rail" aria-label="Workspace">
				<span className="mock-no__logo" />
				{RAIL.map((r) => (
					<button
						key={r.id}
						type="button"
						title={r.label}
						aria-label={r.label}
						className={`mock-no__railitem ${r.id === "kb" ? "mock-no__railitem--active" : ""}`}
					>
						{r.icon}
					</button>
				))}
				<span className="mock-no__railspacer" />
				<button
					type="button"
					title="Settings"
					aria-label="Settings"
					className="mock-no__railitem"
				>
					<Settings size={18} />
				</button>
			</nav>

			<div className="mock-no__main">
				{/* header */}
				<header className="mock-no__topbar">
					<nav className="mock-no__crumbs" aria-label="Breadcrumb">
						<Folder size={15} />
						<span>Workspace</span>
						<ChevronRight size={13} />
						<span>Customer support</span>
						<ChevronRight size={13} />
						<strong>Knowledge base management</strong>
					</nav>
					<div className="mock-no__searchbox">
						<Search size={14} />
						<input
							placeholder="Search…"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							aria-label="Search documents"
						/>
						<kbd>⌘F</kbd>
					</div>
					<Menu
						placement="bottom-end"
						trigger={
							<Button variant="primary">
								<Plus size={15} /> Add Source
							</Button>
						}
					>
						<MenuItem
							icon={
								<span className="mock-no__tile mock-no__tile--notion mock-no__tile--xs">
									N
								</span>
							}
							onClick={() => addSource("notion")}
						>
							Notion page
						</MenuItem>
						<MenuItem
							icon={<Upload size={15} />}
							onClick={() => addSource("pdf")}
						>
							Upload PDF
						</MenuItem>
						<MenuItem
							icon={<Globe size={15} />}
							onClick={() => addSource("link")}
						>
							Web link
						</MenuItem>
					</Menu>
				</header>

				{/* scrollable body + sidebar */}
				<div className="mock-no__body">
					<div className="mock-no__content">
						{/* stat cards */}
						<div className="mock-no__stats">
							{STATS.map((s) => (
								<StatCard key={s.label} stat={s} />
							))}
						</div>

						{/* toolbar */}
						<div className="mock-no__toolbar">
							<div
								className="mock-no__seg"
								role="tablist"
								aria-label="Document sets"
							>
								<button
									type="button"
									role="tab"
									aria-selected={tab === "recent"}
									className={tab === "recent" ? "is-active" : ""}
									onClick={() => setTab("recent")}
								>
									Recently Updated
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={tab === "all"}
									className={tab === "all" ? "is-active" : ""}
									onClick={() => setTab("all")}
								>
									All Documents
								</button>
							</div>
							<div className="mock-no__tools">
								<Menu
									placement="bottom-end"
									trigger={
										<Button variant="secondary">
											<ArrowUpDown size={14} /> Sort By
										</Button>
									}
								>
									{SORTS.map((s) => (
										<MenuItem
											key={s.id}
											icon={
												sort === s.id ? (
													<Check size={14} />
												) : (
													<span style={{ width: 14 }} />
												)
											}
											onClick={() => setSort(s.id)}
										>
											{s.label}
										</MenuItem>
									))}
								</Menu>
								<div
									className="mock-no__seg mock-no__seg--icons"
									role="group"
									aria-label="View"
								>
									<button
										type="button"
										aria-label="Grid view"
										className={view === "grid" ? "is-active" : ""}
										onClick={() => setView("grid")}
									>
										<LayoutGrid size={15} />
									</button>
									<button
										type="button"
										aria-label="List view"
										className={view === "list" ? "is-active" : ""}
										onClick={() => setView("list")}
									>
										<List size={15} />
									</button>
								</div>
							</div>
						</div>

						{/* documents */}
						{visible.length === 0 ? (
							<div className="mock-no__empty">
								<Search size={22} />
								<p>No documents match “{query}”.</p>
							</div>
						) : view === "grid" ? (
							<div className="mock-no__grid">
								{visible.map((doc) => (
									<article
										key={doc.id}
										className={`mock-no__card ${doc.id === selectedId && panelOpen ? "is-selected" : ""}`}
										onClick={() => pick(doc.id)}
									>
										<div className="mock-no__cardhead">
											<SourceTile source={doc.source} />
											<DocMenu
												doc={doc}
												onReindex={() => reindex(doc.id)}
												onRemove={() => removeDoc(doc.id)}
											/>
										</div>
										<strong>{doc.title}</strong>
										<p>{doc.desc}</p>
										<div className="mock-no__cardfoot">
											<span>{doc.ago}</span>
											{busyId === doc.id ? (
												<Badge tone="rose">Re-indexing…</Badge>
											) : (
												<StatusChip status={doc.status} />
											)}
										</div>
									</article>
								))}
							</div>
						) : (
							<div className="mock-no__list">
								{visible.map((doc) => (
									<div
										key={doc.id}
										className={`mock-no__li ${doc.id === selectedId && panelOpen ? "is-selected" : ""}`}
										onClick={() => pick(doc.id)}
									>
										<SourceTile source={doc.source} />
										<span className="mock-no__litext">
											<strong>{doc.title}</strong>
											<em>{doc.desc}</em>
										</span>
										<span className="mock-no__liago">{doc.ago}</span>
										{busyId === doc.id ? (
											<Badge tone="rose">Re-indexing…</Badge>
										) : (
											<StatusChip status={doc.status} />
										)}
										<DocMenu
											doc={doc}
											onReindex={() => reindex(doc.id)}
											onRemove={() => removeDoc(doc.id)}
										/>
									</div>
								))}
							</div>
						)}
					</div>

					{/* detail sidebar */}
					{panelOpen && selected && (
						<DetailPanel
							doc={selected}
							reindexing={busyId === selected.id}
							progress={progress}
							onReindex={() => reindex(selected.id)}
							onClose={() => setPanelOpen(false)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

function DocMenu({
	doc,
	onReindex,
	onRemove,
}: {
	doc: Doc;
	onReindex: () => void;
	onRemove: () => void;
}) {
	return (
		<span onClick={(e) => e.stopPropagation()}>
			<Menu
				placement="bottom-end"
				trigger={
					<IconButton
						label={`${doc.title} actions`}
						icon={<MoreVertical size={16} />}
						size="sm"
						variant="ghost"
					/>
				}
			>
				<MenuItem icon={<Eye size={15} />}>Open</MenuItem>
				<MenuItem icon={<Pencil size={15} />}>Rename</MenuItem>
				<MenuItem icon={<RefreshCw size={15} />} onClick={onReindex}>
					Re-index
				</MenuItem>
				<MenuDivider />
				<MenuItem icon={<Trash2 size={15} />} danger onClick={onRemove}>
					Remove
				</MenuItem>
			</Menu>
		</span>
	);
}
