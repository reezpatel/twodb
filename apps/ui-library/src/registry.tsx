import { useState, type ReactNode } from "react";
import {
	AccountMenu,
	Avatar,
	Badge,
	Button,
	Card,
	Checkbox,
	Dialog,
	Divider,
	FileTree,
	IconButton,
	Input,
	Menu,
	MenuDivider,
	MenuItem,
	MarkdownEditor,
	NavPanel,
	NavRail,
	NavSection,
	Radio,
	SearchInput,
	Select,
	Skeleton,
	Switch,
	Tabs,
	Textarea,
	Tooltip,
} from "@twodb/ui";
import {
	Bell,
	Bookmark,
	CalendarDays,
	Copy,
	Heart,
	Home,
	LogOut,
	MapPin,
	MessageCircle,
	MoreHorizontal,
	Pencil,
	Plus,
	Repeat2,
	Search,
	Settings,
	ShoppingBag,
	SlidersHorizontal,
	Star,
	StickyNote,
	Trash2,
	User,
	Zap,
} from "lucide-react";
import {
	DayTimeline,
	DataGantt,
	DataTable,
	Table,
	TBody,
	TD,
	TH,
	THead,
	TR,
	type DataColumn,
	type DataGanttItem,
} from "@twodb/ui";
import {
	Calendar,
	DatePicker,
	DateRangePicker,
	DateTimePicker,
	TimePicker,
} from "@twodb/ui";
import {
	AudioMessage,
	ChatComposer,
	ChatHeader,
	ChatList,
	ChatMessage,
	ChatPanel,
	DocumentMessage,
	GalleryMessage,
	ImageMessage,
	MessageGroup,
	TextMessage,
	VideoMessage,
} from "@twodb/ui";
import type { DateRange } from "@twodb/ui";
import { ColorPicker, CURATED_COLORS } from "@twodb/ui";
import { ComposeEmailMock } from "./mocks/ComposeEmail";
import { DetectedAccountsMock } from "./mocks/DetectedAccounts";
import { IntegrationsMock } from "./mocks/Integrations";
import { ProdexDashboardMock } from "./mocks/ProdexDashboard";
import { SalesMateProMock } from "./mocks/SalesMatePro";
import { WeeklyCalendarMock } from "./mocks/WeeklyCalendar";
import { ShareSettingsMock } from "./mocks/ShareSettings";
import { SettingsMock } from "./mocks/Settings";
import { TwoFactorMock } from "./mocks/TwoFactor";
import { InvestorDashboardMock } from "./mocks/InvestorDashboard";
import { MorningBriefMock } from "./mocks/MorningBrief";
import { TablePlanMock } from "./mocks/TablePlan";
import { TodoFlowMock } from "./mocks/TodoFlow";
import { ChatMailMock } from "./mocks/ChatMail";
import { LiveScribeMock } from "./mocks/LiveScribe";
import { WeeklyCalMock } from "./mocks/WeeklyCal";
import { FileManagerMock } from "./mocks/FileManager";
import { CommunicationMock } from "./mocks/Communication";
import { AutomationMock } from "./mocks/Automation";
import { FileDriveMock } from "./mocks/FileDrive";
import { ProjectFilesMock } from "./mocks/ProjectFiles";
import { DailyCalMock } from "./mocks/DailyCal";
import { EmployeePanelMock } from "./mocks/EmployeePanel";
import { InboxMock } from "./mocks/Inbox";
import { MonthlyCalendarMock } from "./mocks/MonthlyCalendar";
import { DesignDiscussionMock } from "./mocks/DesignDiscussion";
import { CompanyProfileMock } from "./mocks/CompanyProfile";
import { AutomationBuilderMock } from "./mocks/AutomationBuilder";

export interface Story {
	title: string;
	render: () => ReactNode;
	code?: string;
}

export interface ComponentEntry {
	id: string;
	group: "Foundation" | "Primitives" | "Shell" | "Data" | "Chat" | "Showcase";
	name: string;
	description: string;
	/** Full-page mocks: the story preview widens past the usual column. */
	fullWidth?: boolean;
	stories: Story[];
}

/* --- Signature foundation piece: the horizon, night → day --- */
function HorizonStrip() {
	const cues = [
		{ n: "00", name: "Night", hex: "#050506", bg: "#050506", ink: "#f4f3f8" },
		{
			n: "10",
			name: "Cobalt horizon",
			hex: "#0A2BFF",
			bg: "#0a2bff",
			ink: "#ffffff",
		},
		{
			n: "20",
			name: "Rose gather",
			hex: "#D24BFF",
			bg: "#d24bff",
			ink: "#ffffff",
		},
		{
			n: "30",
			name: "Rose light",
			hex: "#FF7BAE",
			bg: "#ff7bae",
			ink: "#121218",
		},
		{
			n: "40",
			name: "Dawn wash",
			hex: "#FFD7E6",
			bg: "#ffd7e6",
			ink: "#121218",
		},
		{ n: "50", name: "Day", hex: "#FFFFFF", bg: "#ffffff", ink: "#121218" },
	];
	return (
		<div className="horizon">
			{cues.map((c) => (
				<div
					key={c.n}
					className="horizon__band"
					style={{ background: c.bg, color: c.ink }}
				>
					<span className="horizon__cue">{c.n}</span>
					<span className="horizon__name">{c.name}</span>
					<span className="horizon__hex tw-tnum">{c.hex}</span>
				</div>
			))}
		</div>
	);
}

function TypeScale() {
	const rows = [
		{
			label: "Display / cue",
			cls: "type-demo__cue",
			text: "LIGHT RISES ON YOUR WORK",
		},
		{
			label: "Title",
			cls: "type-demo__title",
			text: "Every note, one horizon",
		},
		{
			label: "Body",
			cls: "type-demo__body",
			text: "Capture it in seconds. Find it in one search. Let the light carry the state — never shadow, never noise.",
		},
		{
			label: "Data / tabular",
			cls: "type-demo__data tw-tnum",
			text: "06:12:00 · 128 notes · 99.9%",
		},
	];
	return (
		<div className="type-demo">
			{rows.map((r) => (
				<div key={r.label} className="type-demo__row">
					<span className="tw-cue">{r.label}</span>
					<span className={r.cls}>{r.text}</span>
				</div>
			))}
		</div>
	);
}

/* --- Stateful demos --- */
function TabsDemo() {
	const [tab, setTab] = useState("notes");
	return (
		<div style={{ width: "100%" }}>
			<Tabs
				aria-label="Demo sections"
				value={tab}
				onValueChange={setTab}
				items={[
					{ id: "notes", label: "Notes" },
					{ id: "automations", label: "Automations" },
					{ id: "apps", label: "Apps" },
				]}
			/>
			<p style={{ marginTop: 12, color: "var(--ink-2)" }}>
				{tab === "notes" && "Notes live here — each one a card on the horizon."}
				{tab === "automations" &&
					"Automations: plain-language rules that act for you."}
				{tab === "apps" && "Apps the AI built for you, ready to use."}
			</p>
		</div>
	);
}

function MarkdownEditorDemo() {
	const [md, setMd] = useState(
		[
			"## Monday clinic notes",
			"",
			"Morning rounds went **well** — three follow-ups moved to next week.",
			"",
			"- Order new stock of gauze and gloves",
			"- Call the lab about *pending* reports",
			"- [ ] Confirm Tuesday's visiting hours",
			"",
			"> Reminder: the new invoice table goes live Friday.",
		].join("\n"),
	);
	return (
		<div
			style={{
				width: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 16,
			}}
		>
			<MarkdownEditor
				value={md}
				onChange={setMd}
				placeholder="Write the plan…"
			/>
			<div>
				<span className="tw-cue">Markdown out</span>
				<pre className="md-out">{md}</pre>
			</div>
		</div>
	);
}

const BLOG_MD = [
	"# The five-minute morning brief",
	"",
	"*How a clinic of eleven people replaced the 8 a.m. chaos with one quiet page — Aug 3, 2026 · 6 min read*",
	"",
	"**Every morning used to start the same way.** Four phone calls, two registers, and a whiteboard nobody trusted. The front desk knew half the schedule; the nurses knew the other half. By nine, the day was already behind.",
	"",
	"This is the story of how that stopped — and the exact page they use now, which you can copy in an afternoon.",
	"",
	"![The morning brief page, synthetic demo image](IMG1)",
	"",
	"## The problem was never people",
	"",
	"Clinics don't forget patients because they care too little. They forget because the remembering lives in eleven places at once: a diary at reception, sticky notes on the pathology fridge, a WhatsApp group that scrolls too fast, and the head nurse's famously reliable memory — which retires the day she does.",
	"",
	"When information lives in fragments, the morning becomes an archaeology dig. The brief is the opposite: one page, written by the day itself, waiting before anyone asks.",
	"",
	"> The goal is not more information in the morning. It is fewer questions.",
	"",
	"## What goes on the page",
	"",
	"The brief answers five questions and nothing more:",
	"",
	"- Who is coming today, and who needs preparation before they arrive?",
	"- Which reports came back overnight, and which are still pending?",
	"- What stock crossed below its reorder line yesterday?",
	"- Which invoices aged past thirty days this week?",
	"- What is the one thing the whole team must not forget?",
	"",
	"Everything else is noise, and noise is what mornings are made of.",
	"",
	"## How it gets assembled",
	"",
	"Nobody *writes* the brief. The system keeps a gentle eye on the same ledgers the team already maintains, and at 06:30 it drafts the page:",
	"",
	"1. Appointments are read off the calendar — no re-entry, ever.",
	"2. Lab reports attach themselves to the right patient automatically.",
	"3. Stock counts below their threshold surface with a suggested order quantity.",
	"4. Anything unresolved from yesterday rolls forward with a small `↻ carried` mark.",
	"",
	"The rule that makes it trustworthy: if the data isn't already in the system, it doesn't get on the page. A brief someone has to maintain dies by the third week.",
	"",
	"```",
	"06:30  draft brief from overnight data",
	"06:45  head nurse reviews, adds one line",
	"07:55  page opens on every desk — no meeting",
	"```",
	"",
	"## What changed in six weeks",
	"",
	"The numbers the clinic tracked, before and after:",
	"",
	"| Measure | Before | After six weeks |",
	"| --- | --- | --- |",
	"| Morning phone calls | 14–18 | 2–3 |",
	"| Patients asked to wait while files were found | ~9 / day | ~1 / day |",
	"| Stock-out incidents per week | 3 | 0 |",
	"| Invoices older than 30 days | 22 | 6 |",
	"| Staff meeting minutes per morning | 25 | 0 |",
	"",
	"The head nurse's summary was shorter than any table: *\"I stopped being the hospital's search engine.\"*",
	"",
	"![The reorder view, synthetic demo image](IMG2)",
	"",
	"## Start tomorrow, not next quarter",
	"",
	"The temptation is to design the perfect brief. Resist it. Write tomorrow's five answers by hand tonight, put the page where everyone already looks, and let the routine prove which questions deserve to stay. Most teams delete two of their first five within a month — the page earns its shape.",
	"",
	"---",
	"",
	"*The morning brief is one of twelve templates in the [twodb starter library](#). Also ~~deprecated~~ retired: the 8 a.m. all-hands.*",
].join("\n");

function MarkdownBlogDemo() {
	const md = BLOG_MD.replace("IMG1", ph("#050506", "#0A2BFF")).replace(
		"IMG2",
		ph("#D24BFF", "#FFD7E6"),
	);
	return (
		<div style={{ width: "100%", maxWidth: 760 }}>
			<MarkdownEditor defaultValue={md} readOnly minHeight={0} />
		</div>
	);
}

function ColorPickerDemo() {
	const [color, setColor] = useState("#3A55FF");
	return (
		<div
			style={{
				display: "flex",
				gap: 24,
				alignItems: "flex-start",
				flexWrap: "wrap",
				width: "100%",
			}}
		>
			<div style={{ width: 260 }}>
				<ColorPicker value={color} onValueChange={setColor} />
			</div>
			<div className="tw-colorpreview" aria-live="polite">
				<div className="tw-colorpreview__well" style={{ background: color }} />
				<div>
					<span className="tw-cue">Preview</span>
					<div className="tw-colorpreview__hex">{color}</div>
					<div className="tw-colorpreview__name">
						{CURATED_COLORS.find((c) => c.value === color)?.name ??
							"Custom color"}
					</div>
				</div>
			</div>
		</div>
	);
}

function DialogDemo() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Open dialog
			</Button>
			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				title="Archive this note?"
				footer={
					<>
						<Button variant="ghost" onClick={() => setOpen(false)}>
							Keep it
						</Button>
						<Button onClick={() => setOpen(false)}>Archive</Button>
					</>
				}
			>
				It stays searchable, but leaves your daily view. You can bring it back
				any time.
			</Dialog>
		</>
	);
}

function CardsShowcase() {
	const clinicPhoto = ph("#050506", "#0A2BFF");
	const productPhoto = ph("#0A2BFF", "#D24BFF");
	const articlePhoto = ph("#D24BFF", "#FFD7E6");
	const eventPhoto = ph("#FF7BAE", "#FFFFFF");

	return (
		<div className="card-showcase">
			<Card
				className="card-showcase__social"
				aria-label="Twitter style post card"
			>
				<div className="card-showcase__post-head">
					<Avatar name="Asha Verma" />
					<span>
						<strong>Dr. Asha Verma</strong>
						<em>@clinic-notes · 12m</em>
					</span>
					<MoreHorizontal aria-hidden="true" />
				</div>
				<p>
					Moved every follow-up into one twodb timeline. The team can see what
					is due before the waiting room fills.
				</p>
				<img src={clinicPhoto} alt="Synthetic clinic timeline preview" />
				<div className="card-showcase__actions" aria-label="Post actions">
					<span>
						<MessageCircle /> 18
					</span>
					<span>
						<Repeat2 /> 42
					</span>
					<span>
						<Heart /> 128
					</span>
					<span>
						<Bookmark /> Save
					</span>
				</div>
			</Card>

			<Card
				className="card-showcase__insta"
				aria-label="Instagram style media card"
			>
				<div className="card-showcase__post-head">
					<Avatar name="Meera Iyer" />
					<span>
						<strong>meera.records</strong>
						<em>Camp setup</em>
					</span>
					<MoreHorizontal aria-hidden="true" />
				</div>
				<img src={articlePhoto} alt="Synthetic dawn media card" />
				<div className="card-showcase__actions card-showcase__actions--media">
					<span>
						<Heart /> 2.4k
					</span>
					<span>
						<MessageCircle /> 89
					</span>
					<span>
						<Bookmark /> Saved
					</span>
				</div>
				<p>
					<strong>meera.records</strong> One shared brief instead of five group
					chats.
				</p>
			</Card>

			<Card
				className="card-showcase__product"
				aria-label="Ecommerce product card"
			>
				<img src={productPhoto} alt="Synthetic product pack" />
				<div className="card-showcase__product-copy">
					<Badge tone="go">In stock</Badge>
					<h3>Clinic starter kit</h3>
					<p>Forms, reminders, and invoice workflows for a small practice.</p>
					<div className="card-showcase__price-row">
						<span className="tw-tnum">₹4,200</span>
						<em>
							<Star /> 4.8
						</em>
					</div>
					<Button size="sm">
						<ShoppingBag /> Add
					</Button>
				</div>
			</Card>

			<Card
				tone="rose"
				className="card-showcase__brief"
				title="Morning brief"
				actions={<Badge tone="rose">AI draft</Badge>}
			>
				<p>
					Three appointments today. Two invoices unpaid. One note links to both.
				</p>
				<div className="card-showcase__facts">
					<span>
						<strong className="tw-tnum">07:30</strong>
						<em>opens</em>
					</span>
					<span>
						<strong className="tw-tnum">3</strong>
						<em>follow-ups</em>
					</span>
					<span>
						<strong className="tw-tnum">2</strong>
						<em>payments</em>
					</span>
				</div>
				<Button size="sm">Open brief</Button>
			</Card>

			<Card
				className="card-showcase__article"
				title="Article preview"
				actions={<Badge>Read</Badge>}
			>
				<img src={articlePhoto} alt="Synthetic article cover" />
				<h3>How a morning brief replaced the 8 a.m. meeting</h3>
				<p>
					A field note on making daily operations visible without another
					dashboard.
				</p>
			</Card>

			<Card tone="band" className="card-showcase__event" title="Event card">
				<img src={eventPhoto} alt="Synthetic event poster" />
				<div className="card-showcase__event-grid">
					<span>
						<CalendarDays /> Aug 14, 10:30
					</span>
					<span>
						<MapPin /> West clinic
					</span>
				</div>
				<Button size="sm" variant="secondary">
					Add to day
				</Button>
			</Card>

			<Card
				className="card-showcase__record"
				title="Linked record"
				actions={<Badge tone="go">Synced</Badge>}
			>
				<div className="card-showcase__person">
					<Avatar name="Ravi Kumar" />
					<span>
						<strong>Ravi Kumar</strong>
						<em>Visit note · invoice · lab report</em>
					</span>
				</div>
				<p>
					The card keeps a person, latest work, and next action in one calm
					band.
				</p>
			</Card>

			<Card
				className="card-showcase__review"
				tone="warning"
				title="Needs review"
				actions={<Badge tone="warning">Due soon</Badge>}
			>
				<p>The first send waits for a person to approve the message copy.</p>
			</Card>

			<Card
				className="card-showcase__blocked"
				tone="danger"
				density="compact"
				title="Blocked automation"
			>
				<p>
					Phone number missing for two recipients. Add numbers before twodb
					sends.
				</p>
			</Card>
		</div>
	);
}

/* --- Shell demos --- */
function NavRailDemo() {
	const [active, setActive] = useState("notes");
	return (
		<div className="demo-frame" style={{ height: 320 }}>
			<NavRail
				value={active}
				onValueChange={setActive}
				header={
					<span
						style={{
							display: "grid",
							placeItems: "center",
							width: 32,
							height: 32,
							marginBottom: 8,
							borderRadius: "var(--r-md)",
							background: "var(--action)",
							color: "#fff",
							fontFamily: "var(--font-cue)",
							fontWeight: 600,
							fontSize: 15,
						}}
					>
						T
					</span>
				}
				items={[
					{ id: "notes", icon: <StickyNote />, label: "Notes" },
					{ id: "search", icon: <Search />, label: "Search" },
					{ id: "automations", icon: <Zap />, label: "Automations" },
					{ id: "settings", icon: <Settings />, label: "Settings" },
				]}
			/>
		</div>
	);
}

function NavPanelDemo() {
	const [page, setPage] = useState("inbox");
	return (
		<div className="demo-frame" style={{ height: 460 }}>
			<NavPanel
				search={
					<SearchInput placeholder="Search notes…" aria-label="Search notes" />
				}
				footer={
					<AccountMenu name="Asha Verma" sub="Clinic workspace">
						<MenuItem icon={<User />}>Profile</MenuItem>
						<MenuItem icon={<SlidersHorizontal />}>Preferences</MenuItem>
						<MenuDivider />
						<MenuItem icon={<LogOut />} danger>
							Log out
						</MenuItem>
					</AccountMenu>
				}
			>
				<NavSection
					label="Workspace"
					value={page}
					onValueChange={setPage}
					items={[
						{
							id: "inbox",
							label: "Inbox",
							icon: <Home />,
							badge: <Badge tone="go">3</Badge>,
						},
						{ id: "notes", label: "All notes", icon: <StickyNote /> },
						{ id: "automations", label: "Automations", icon: <Zap /> },
					]}
				/>
				<NavSection
					label="Recent"
					value={page}
					onValueChange={setPage}
					items={[
						{
							id: "rounds",
							label: "Morning rounds",
							badge: <Badge tone="rose">AI</Badge>,
						},
						{ id: "invoices", label: "Unpaid invoices" },
					]}
				/>
			</NavPanel>
		</div>
	);
}

/* --- Data demos --- */
interface Invoice {
	id: string;
	patient: string;
	amount: number;
	status: "Paid" | "Due" | "Overdue";
	date: string;
	tags: string[];
	received: number;
	priority: number;
	receipt: string;
	portal: string;
}

const BASE_INVOICES = [
	{
		id: "INV-1041",
		patient: "Ravi Kumar",
		amount: 1200,
		status: "Paid",
		date: "2026-08-01",
	},
	{
		id: "INV-1042",
		patient: "Meera Iyer",
		amount: 850,
		status: "Due",
		date: "2026-08-01",
	},
	{
		id: "INV-1043",
		patient: "Arjun Nair",
		amount: 2400,
		status: "Overdue",
		date: "2026-07-28",
	},
	{
		id: "INV-1044",
		patient: "Sana Sheikh",
		amount: 600,
		status: "Paid",
		date: "2026-07-27",
	},
	{
		id: "INV-1045",
		patient: "Vikram Rao",
		amount: 1750,
		status: "Due",
		date: "2026-07-26",
	},
	{
		id: "INV-1046",
		patient: "Priya Sharma",
		amount: 300,
		status: "Paid",
		date: "2026-07-25",
	},
	{
		id: "INV-1047",
		patient: "Dev Patel",
		amount: 990,
		status: "Overdue",
		date: "2026-07-24",
	},
	{
		id: "INV-1048",
		patient: "Anita Desai",
		amount: 4200,
		status: "Due",
		date: "2026-07-23",
	},
	{
		id: "INV-1049",
		patient: "Farhan Ali",
		amount: 700,
		status: "Paid",
		date: "2026-07-22",
	},
	{
		id: "INV-1050",
		patient: "Kavya Menon",
		amount: 1350,
		status: "Due",
		date: "2026-07-21",
	},
	{
		id: "INV-1051",
		patient: "Rohan Gupta",
		amount: 520,
		status: "Paid",
		date: "2026-07-20",
	},
	{
		id: "INV-1052",
		patient: "Isha Bose",
		amount: 2100,
		status: "Overdue",
		date: "2026-07-19",
	},
	{
		id: "INV-1053",
		patient: "Kabir Shah",
		amount: 940,
		status: "Paid",
		date: "2026-07-18",
	},
	{
		id: "INV-1054",
		patient: "Nisha Pillai",
		amount: 1680,
		status: "Due",
		date: "2026-07-17",
	},
	{
		id: "INV-1055",
		patient: "Amit Joshi",
		amount: 450,
		status: "Paid",
		date: "2026-07-16",
	},
	{
		id: "INV-1056",
		patient: "Tara Krishnan",
		amount: 2890,
		status: "Due",
		date: "2026-07-15",
	},
	{
		id: "INV-1057",
		patient: "Sameer Khan",
		amount: 760,
		status: "Paid",
		date: "2026-07-14",
	},
	{
		id: "INV-1058",
		patient: "Lakshmi Reddy",
		amount: 1120,
		status: "Overdue",
		date: "2026-07-13",
	},
	{
		id: "INV-1059",
		patient: "Nitin Malhotra",
		amount: 640,
		status: "Paid",
		date: "2026-07-12",
	},
] as const;

const INVOICES: Invoice[] = BASE_INVOICES.map((r, i) => ({
	...r,
	status: r.status as Invoice["status"],
	tags:
		i % 3 === 0
			? ["lab", "follow-up"]
			: i % 3 === 1
				? ["consultation"]
				: ["pharmacy"],
	received: r.status === "Paid" ? 100 : r.status === "Due" ? 45 : 10,
	priority: (i % 5) + 1,
	receipt: `receipt-${r.id.slice(4)}.pdf`,
	portal: `pay.twodb.in/${r.id.toLowerCase()}`,
}));

const TAG_OPTIONS = [
	{ value: "consultation", label: "Consultation", tone: "go" as const },
	{ value: "follow-up", label: "Follow-up", tone: "rose" as const },
	{ value: "lab", label: "Lab", tone: "neutral" as const },
	{ value: "pharmacy", label: "Pharmacy", tone: "warning" as const },
];

const STATUS_OPTIONS = [
	{ value: "Paid", label: "Paid", tone: "go" as const },
	{ value: "Due", label: "Due", tone: "warning" as const },
	{ value: "Overdue", label: "Overdue", tone: "danger" as const },
];

const invoiceColumns: DataColumn<Invoice>[] = [
	{
		id: "id",
		label: "Invoice",
		type: "text",
		width: 130,
		sortValue: (r) => r.id,
		filter: { kind: "text" },
		editValue: (r) => r.id,
		setValue: (r, v) => ({ ...r, id: String(v) }),
	},
	{
		id: "patient",
		label: "Patient",
		type: "text",
		width: 180,
		sortValue: (r) => r.patient,
		filter: { kind: "text" },
		editValue: (r) => r.patient,
		setValue: (r, v) => ({ ...r, patient: String(v) }),
	},
	{
		id: "tags",
		label: "Tags",
		type: "chips",
		width: 200,
		options: TAG_OPTIONS,
		editValue: (r) => r.tags,
		setValue: (r, v) => ({ ...r, tags: v as string[] }),
	},
	{
		id: "amount",
		label: "Amount",
		type: "currency",
		align: "right",
		width: 120,
		sortValue: (r) => r.amount,
		filter: { kind: "number" },
		editValue: (r) => r.amount,
		setValue: (r, v) => ({ ...r, amount: Number(v) || 0 }),
	},
	{
		id: "status",
		label: "Status",
		type: "select",
		width: 130,
		options: STATUS_OPTIONS,
		filter: { kind: "enum", options: STATUS_OPTIONS },
		filterValue: (r) => r.status,
		editValue: (r) => r.status,
		setValue: (r, v) => ({ ...r, status: v as Invoice["status"] }),
	},
	{
		id: "received",
		label: "Received",
		type: "progress",
		width: 140,
		sortValue: (r) => r.received,
		editValue: (r) => r.received,
		setValue: (r, v) => ({ ...r, received: Number(v) }),
	},
	{
		id: "priority",
		label: "Priority",
		type: "stars",
		width: 110,
		sortValue: (r) => r.priority,
		editValue: (r) => r.priority,
		setValue: (r, v) => ({ ...r, priority: Number(v) }),
	},
	{
		id: "receipt",
		label: "Receipt",
		type: "file",
		width: 170,
		editValue: (r) => r.receipt,
		setValue: (r, v) => ({ ...r, receipt: String(v) }),
	},
	{
		id: "portal",
		label: "Portal",
		type: "url",
		width: 200,
		editValue: (r) => r.portal,
		setValue: (r, v) => ({ ...r, portal: String(v) }),
	},
	{
		id: "date",
		label: "Date",
		type: "text",
		width: 130,
		sortValue: (r) => r.date,
		filter: { kind: "text" },
		editValue: (r) => r.date,
		setValue: (r, v) => ({ ...r, date: String(v) }),
	},
];

const GANTT_ITEMS: DataGanttItem[] = [
	{
		id: "capture",
		kicker: "Plain-language intake",
		title: "Collect field notes",
		start: "2026-08-03",
		end: "2026-08-08",
		progress: 82,
		status: "Live",
		tone: "go",
		owner: "Asha",
		description:
			"Morning notes, invoice photos, and follow-up requests land in one calmer record before anything becomes automation.",
		meta: [
			{ label: "Inputs", value: "42 notes" },
			{ label: "Next", value: "Review", tone: "warning" },
		],
		milestones: [
			{ date: "2026-08-07", label: "First import complete", tone: "go" },
		],
	},
	{
		id: "link",
		kicker: "Knowledge graph",
		title: "Connect patients and invoices",
		start: "2026-08-06",
		end: "2026-08-14",
		progress: 56,
		status: "Mapping",
		tone: "neutral",
		owner: "Meera",
		description:
			"Records are grouped into people, visits, payments, and tasks so the assistant can answer from context instead of isolated rows.",
		meta: [
			{ label: "Links", value: "128" },
			{ label: "Confidence", value: "91%" },
		],
		milestones: [{ date: "2026-08-12", label: "Duplicate check" }],
	},
	{
		id: "assistant",
		kicker: "AI presence",
		title: "Draft reminder workflow",
		start: "2026-08-10",
		end: "2026-08-18",
		progress: 34,
		status: "AI draft",
		tone: "rose",
		owner: "twodb",
		description:
			"The assistant proposes a human-readable reminder flow and shows which notes, invoices, and dates shaped the draft.",
		meta: [
			{ label: "Drafts", value: "3" },
			{ label: "Needs", value: "Approval", tone: "rose" },
		],
		milestones: [
			{ date: "2026-08-15", label: "Review suggestion", tone: "rose" },
		],
	},
	{
		id: "launch",
		kicker: "Operations",
		title: "Send first follow-ups",
		start: "2026-08-17",
		end: "2026-08-23",
		progress: 12,
		status: "Queued",
		tone: "warning",
		owner: "Ravi",
		description:
			"Approved reminders move from a timeline row into a clear detail panel: what sends, when it sends, and who can stop it.",
		meta: [
			{ label: "Messages", value: "18" },
			{ label: "Risk", value: "Low" },
		],
		milestones: [{ date: "2026-08-21", label: "First send", tone: "warning" }],
	},
];

/* --- Picker demos --- */
function CalendarDemo() {
	const [day, setDay] = useState<Date | undefined>(new Date());
	return <Calendar mode="single" selected={day} onSelect={setDay} />;
}

function DatePickerDemo() {
	const [date, setDate] = useState<Date | undefined>();
	return (
		<div style={{ width: 260 }}>
			<DatePicker
				label="Appointment"
				value={date}
				onValueChange={setDate}
				hint={date ? `Chosen: ${date.toDateString()}` : "No date chosen yet"}
			/>
		</div>
	);
}

function DateRangePickerDemo() {
	const [range, setRange] = useState<DateRange | undefined>();
	return (
		<div style={{ width: 300 }}>
			<DateRangePicker
				label="Camp dates"
				value={range}
				onValueChange={setRange}
				hint={
					range?.from && range?.to
						? `${range.from.toDateString()} → ${range.to.toDateString()}`
						: "Pick a start and an end"
				}
			/>
		</div>
	);
}

function DateTimePickerDemo() {
	const [value, setValue] = useState<Date | undefined>();
	return (
		<div style={{ width: 300 }}>
			<DateTimePicker
				label="Reminder at"
				value={value}
				onValueChange={setValue}
			/>
		</div>
	);
}

function TimePickerDemo() {
	const [value, setValue] = useState<Date | undefined>();
	return (
		<div style={{ width: 220 }}>
			<TimePicker label="Opens at" value={value} onValueChange={setValue} />
		</div>
	);
}

/* --- Chat demos --- */

/* authored placeholder imagery: the world's own dawn gradients (synthetic) */
function ph(c1: string, c2: string): string {
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='640' height='480' fill='url(#g)'/><circle cx='480' cy='120' r='90' fill='rgba(255,255,255,0.14)'/></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PHOTOS = [
	{
		src: ph("#050506", "#0A2BFF"),
		alt: "Synthetic scan placeholder, night to cobalt",
	},
	{
		src: ph("#0A2BFF", "#D24BFF"),
		alt: "Synthetic scan placeholder, cobalt to rose",
	},
	{ src: ph("#D24BFF", "#FF7BAE"), alt: "Synthetic scan placeholder, rose" },
	{ src: ph("#FF7BAE", "#FFD7E6"), alt: "Synthetic scan placeholder, dawn" },
	{ src: ph("#0A2BFF", "#FF7BAE"), alt: "Synthetic scan placeholder, horizon" },
	{
		src: ph("#050506", "#D24BFF"),
		alt: "Synthetic scan placeholder, night rose",
	},
];

function ChatPanelDemo() {
	const [sent, setSent] = useState<string[]>([]);
	return (
		<div
			className="demo-frame"
			style={{
				height: 560,
				width: 640,
				maxWidth: "100%",
				overflow: "auto",
			}}
		>
			<ChatPanel>
				<ChatHeader
					title="Morning rounds"
					subtitle="4 members"
					members={[
						"Asha Verma",
						"Ravi Kumar",
						"Meera Iyer",
						"Dev Patel",
						"Sana Sheikh",
					]}
				/>
				<ChatList>
					<MessageGroup id="rounds-original" author="Dev Patel" time="09:40">
						<ChatMessage>
							<TextMessage>
								The resulting cell should show the value from the appropriate
								column (and not, for instance, all equal those from x1). Any
								idea on how this can be achieved?
							</TextMessage>
						</ChatMessage>
					</MessageGroup>

					<MessageGroup author="Asha Verma" time="09:41">
						<ChatMessage>
							<TextMessage>Morning! Ward 4 summaries are in.</TextMessage>
						</ChatMessage>
						<ChatMessage
							reactions={[
								{ emoji: "👍", count: 2 },
								{ emoji: "❤️", count: 1, active: true },
							]}
						>
							<TextMessage>
								Discharge for Ravi Kumar is ready for review.
							</TextMessage>
						</ChatMessage>
					</MessageGroup>

					<MessageGroup author="Ravi Kumar" time="09:44">
						<ChatMessage>
							<GalleryMessage images={PHOTOS} />
						</ChatMessage>
						<ChatMessage reactions={[{ emoji: "🎉", count: 3 }]}>
							<TextMessage>
								This morning&rsquo;s batch — all six scans.
							</TextMessage>
						</ChatMessage>
					</MessageGroup>

					<MessageGroup author="twodb Assistant" bot time="09:45">
						<ChatMessage
							actions={[
								{ label: "Summarize thread", variant: "primary" },
								{ label: "Create reminders" },
								{ label: "Not now", variant: "ghost" },
							]}
						>
							<TextMessage>
								I found 3 unpaid invoices linked to today&rsquo;s discharges.
								Want me to draft payment reminders?
							</TextMessage>
						</ChatMessage>
					</MessageGroup>

					<MessageGroup author="Meera Iyer" time="09:52">
						<ChatMessage>
							<AudioMessage duration="0:42" />
						</ChatMessage>
					</MessageGroup>

					<MessageGroup author="Asha Verma" time="09:58">
						<ChatMessage>
							<DocumentMessage
								name="Discharge-summary-Kumar.pdf"
								meta="PDF · 184 KB"
							/>
						</ChatMessage>
						<ChatMessage reactions={[{ emoji: "👀", count: 1 }]}>
							<VideoMessage poster={ph("#050506", "#0A2BFF")} duration="0:18" />
						</ChatMessage>
					</MessageGroup>

					<MessageGroup author="Amanda" time="10:08">
						<ChatMessage
							reactions={[{ emoji: "🙌", count: 1 }]}
							replyTo={{
								id: "rounds-original",
								author: "Dev Patel",
								time: "09:40",
								text: "The resulting cell should show the value from the appropriate column (and not, for instance, all equal those from x1). Any idea on how this can be achieved?",
							}}
							onReplyClick={(id) => {
								document
									.getElementById(id ?? "")
									?.scrollIntoView({ behavior: "smooth", block: "center" });
							}}
						>
							<TextMessage>
								Thank you for the suggestion. There is still one difference from
								the desired output though; I think the false argument in the
								if_else() function should not be constant.
							</TextMessage>
						</ChatMessage>
					</MessageGroup>

					{sent.map((t, i) => (
						<MessageGroup key={i} author="You" time="now">
							<ChatMessage>
								<TextMessage>{t}</TextMessage>
							</ChatMessage>
						</MessageGroup>
					))}
				</ChatList>
				<ChatComposer
					placeholder="Message Morning rounds…"
					onSend={(t) => setSent((c) => [...c, t])}
				/>
			</ChatPanel>
		</div>
	);
}

export const registry: ComponentEntry[] = [
	{
		id: "horizon",
		group: "Foundation",
		name: "The Horizon",
		description:
			"The palette is one sweep of light: depthless night, a cobalt horizon, rose gathering, dawn wash, day. Color is never decoration — it is the phase a surface is in.",
		stories: [
			{
				title: "Phases",
				render: () => <HorizonStrip />,
				code: `--twdb-night: #050506;   /* 00 night */
--twdb-cobalt: #0A2BFF;  /* 10 cobalt horizon */
--twdb-rose: #D24BFF;    /* 20 rose gather */
--twdb-rose-light: #FF7BAE; /* 30 rose light */
--twdb-dawn: #FFD7E6;    /* 40 dawn wash */
--twdb-day: #FFFFFF;     /* 50 day */`,
			},
			{
				title: "The sweep — identity only",
				render: () => (
					<div
						style={{
							height: 72,
							width: "100%",
							borderRadius: "var(--r-md)",
							background: "var(--wash)",
						}}
					/>
				),
				code: `--wash: linear-gradient(105deg,
  var(--twdb-cobalt) 0%,
  var(--twdb-rose) 55%,
  var(--twdb-rose-light) 100%);

/* Identity material only. Controls stay flat —
   the primary action is solid cobalt, no gradient
   fills, no glow, no colored shadows. */`,
			},
		],
	},
	{
		id: "typography",
		group: "Foundation",
		name: "Typography",
		description:
			"Two voices: Public Sans carries the interface at reading sizes; Oswald speaks only in tracked caps — cue labels, the wordmark, instrument readouts. Numerals run tabular.",
		stories: [
			{
				title: "Scale",
				render: () => <TypeScale />,
				code: `--font-ui: "Public Sans", system-ui, sans-serif;
--font-cue: "Oswald", "Public Sans", sans-serif;
--tracking-cue: 0.14em;

.tw-cue   { /* tracked caps, instrument labels */ }
.tw-tnum  { /* tabular-nums for data */ }`,
			},
		],
	},
	{
		id: "button",
		group: "Primitives",
		name: "Button",
		description:
			"Quiet until lit. Only the primary action carries color — a flat cobalt; everything else is hairline and ink until hovered.",
		stories: [
			{
				title: "Variants",
				render: () => (
					<div className="row">
						<Button>Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="danger">Danger</Button>
					</div>
				),
				code: `<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>`,
			},
			{
				title: "Sizes",
				render: () => (
					<div className="row">
						<Button size="sm">Small</Button>
						<Button size="md">Medium</Button>
						<Button size="lg">Large</Button>
					</div>
				),
				code: `<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`,
			},
			{
				title: "Disabled",
				render: () => (
					<div className="row">
						<Button disabled>Primary</Button>
						<Button variant="secondary" disabled>
							Secondary
						</Button>
					</div>
				),
				code: `<Button disabled>Primary</Button>
<Button variant="secondary" disabled>Secondary</Button>`,
			},
		],
	},
	{
		id: "input",
		group: "Primitives",
		name: "Input",
		description:
			"A hairline instrument. Focus arrives as a ring of light; errors name the problem.",
		stories: [
			{
				title: "States",
				render: () => (
					<div className="row" style={{ alignItems: "flex-start" }}>
						<Input label="Full name" placeholder="Dr. Asha Verma" />
						<Input
							label="Phone"
							placeholder="+91 98765 43210"
							hint="Used only for reminders"
						/>
						<Input
							label="Email"
							defaultValue="asha@clinic"
							error="That address is incomplete"
						/>
					</div>
				),
				code: `<Input label="Full name" placeholder="Dr. Asha Verma" />
<Input label="Phone" hint="Used only for reminders" />
<Input label="Email" error="That address is incomplete" />`,
			},
		],
	},
	{
		id: "textarea",
		group: "Primitives",
		name: "Textarea",
		description: "For longer capture — the note itself.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ maxWidth: 420, width: "100%" }}>
						<Textarea
							label="Note"
							placeholder="Patient reports the fever broke overnight…"
						/>
					</div>
				),
				code: `<Textarea label="Note" placeholder="Patient reports the fever broke overnight…" />`,
			},
		],
	},
	{
		id: "markdown-editor",
		group: "Primitives",
		name: "Markdown Editor",
		description:
			"Rich writing on TipTap — markdown shortcuts work live, and the value in and out is plain markdown. Every pixel is ours.",
		stories: [
			{
				title: "Default — markdown in, markdown out",
				render: () => <MarkdownEditorDemo />,
				code: `const [md, setMd] = useState(sample);

<MarkdownEditor
  value={md}
  onChange={setMd}
  placeholder="Write the plan…"
/>

{/* md is a plain markdown string */}`,
			},
			{
				title: "In a form",
				render: () => (
					<div style={{ maxWidth: 560, width: "100%" }}>
						<MarkdownEditor
							label="Discharge summary"
							hint="Markdown shortcuts work — # heading, **bold**, - list"
							placeholder="Patient was discharged in stable condition…"
						/>
					</div>
				),
				code: `<MarkdownEditor
  label="Discharge summary"
  hint="Markdown shortcuts work — # heading, **bold**, - list"
  placeholder="Patient was discharged in stable condition…"
/>`,
			},
			{
				title: "Blog preview — every block",
				render: () => <MarkdownBlogDemo />,
				code: `<MarkdownEditor defaultValue={blogMarkdown} readOnly />

// renders headings, images, lists, quote, code,
// a pipe table, hr, links — no toolbar, just the page`,
			},
		],
	},
	{
		id: "color-picker",
		group: "Primitives",
		name: "Color Picker",
		description:
			"Sixteen tones curated for both phases, plus a custom-color bench — saturation, hue, and hex — behind one toggle. The trigger doubles as the preview.",
		stories: [
			{
				title: "Swatches + live preview",
				render: () => <ColorPickerDemo />,
				code: `const [color, setColor] = useState("#3A55FF");

<ColorPicker value={color} onValueChange={setColor} />

{/* 16 curated swatches by default; "Custom color"
    opens the hue/saturation bench + hex input */}`,
			},
			{
				title: "In a form",
				render: () => (
					<div style={{ maxWidth: 320, width: "100%" }}>
						<ColorPicker
							label="Department color"
							hint="Used on tags, schedules, and reports"
							defaultValue="#0F9D8F"
						/>
					</div>
				),
				code: `<ColorPicker
  label="Department color"
  hint="Used on tags, schedules, and reports"
  defaultValue="#0F9D8F"
/>`,
			},
		],
	},
	{
		id: "select",
		group: "Primitives",
		name: "Select",
		description:
			"A custom listbox — no native chrome. Arrows, Enter, Escape, Home/End all work; the selection keeps its check.",
		stories: [
			{
				title: "States",
				render: () => (
					<div className="row" style={{ alignItems: "flex-start" }}>
						<div style={{ width: 220 }}>
							<Select
								label="Reminder"
								defaultValue="morning"
								options={[
									{ value: "morning", label: "Every morning" },
									{ value: "week", label: "Once a week" },
									{ value: "never", label: "Never" },
								]}
							/>
						</div>
						<div style={{ width: 220 }}>
							<Select
								label="Assign to"
								placeholder="Choose a person…"
								options={[
									{ value: "asha", label: "Dr. Asha Verma" },
									{ value: "ravi", label: "Ravi Kumar" },
									{ value: "meera", label: "Meera Iyer" },
								]}
							/>
						</div>
					</div>
				),
				code: `<Select
  label="Reminder"
  defaultValue="morning"
  options={[
    { value: "morning", label: "Every morning" },
    { value: "week", label: "Once a week" },
    { value: "never", label: "Never" },
  ]}
/>`,
			},
		],
	},
	{
		id: "checkbox",
		group: "Primitives",
		name: "Checkbox",
		description:
			"The native input stays invisible but real — forms and keyboard keep working. The check draws itself in; a mixed group gets the dash.",
		stories: [
			{
				title: "States",
				render: () => (
					<div className="row">
						<Checkbox label="Sync this notebook" defaultChecked />
						<Checkbox label="Share with assistant" />
						<Checkbox label="2 of 4 selected" indeterminate />
						<Checkbox label="Unavailable" disabled />
					</div>
				),
				code: `<Checkbox label="Sync this notebook" defaultChecked />
<Checkbox label="Share with assistant" />
<Checkbox label="2 of 4 selected" indeterminate />
<Checkbox label="Unavailable" disabled />`,
			},
		],
	},
	{
		id: "radio",
		group: "Primitives",
		name: "Radio",
		description: "One choice of several — the lit dot.",
		stories: [
			{
				title: "Group",
				render: () => (
					<div className="row">
						<Radio name="density" label="Condensed" defaultChecked />
						<Radio name="density" label="Comfortable" />
						<Radio name="density" label="Spacious" />
					</div>
				),
				code: `<Radio name="density" label="Condensed" defaultChecked />
<Radio name="density" label="Comfortable" />
<Radio name="density" label="Spacious" />`,
			},
		],
	},
	{
		id: "switch",
		group: "Primitives",
		name: "Switch",
		description: "The track lights flat cobalt when on.",
		stories: [
			{
				title: "States",
				render: () => (
					<div className="row">
						<Switch label="Morning summary" defaultChecked />
						<Switch label="Automation active" />
					</div>
				),
				code: `<Switch label="Morning summary" defaultChecked />
<Switch label="Automation active" />`,
			},
		],
	},
	{
		id: "badge",
		group: "Primitives",
		name: "Badge",
		description:
			"Small tracked pills for state. Cobalt means go; rose marks the AI's hand.",
		stories: [
			{
				title: "Tones",
				render: () => (
					<div className="row">
						<Badge>Neutral</Badge>
						<Badge tone="go">Synced</Badge>
						<Badge tone="rose">AI draft</Badge>
						<Badge tone="warning">Due soon</Badge>
						<Badge tone="danger">Failed</Badge>
					</div>
				),
				code: `<Badge>Neutral</Badge>
<Badge tone="go">Synced</Badge>
<Badge tone="rose">AI draft</Badge>
<Badge tone="warning">Due soon</Badge>
<Badge tone="danger">Failed</Badge>`,
			},
			{
				title: "Sizes — md pairs with small buttons, lg with medium",
				render: () => (
					<div className="row">
						<Badge size="sm" tone="go">
							Small
						</Badge>
						<Badge tone="go">Medium</Badge>
						<Badge size="lg" tone="go">
							Large
						</Badge>
						<Button size="sm" variant="secondary">
							Small button
						</Button>
						<Button size="md" variant="secondary">
							Medium button
						</Button>
					</div>
				),
				code: `<Badge size="sm">Small</Badge>
<Badge>Medium</Badge>
<Badge size="lg">Large</Badge>

<Button size="sm">…</Button> + <Badge>…</Badge>   {/* both 26px */}
<Button size="md">…</Button> + <Badge size="lg">…</Badge> {/* both 32px */}`,
			},
		],
	},
	{
		id: "card",
		group: "Primitives",
		name: "Card",
		description:
			"A real-world card gallery: social posts, media cards, product cards, article previews, event cards, records, and status cards — all using the same matte hairline primitive.",
		fullWidth: true,
		stories: [
			{
				title: "Default — quiet information band",
				render: () => (
					<div className="card-showcase__single">
						<Card title="Morning brief" actions={<Badge tone="rose">AI</Badge>}>
							Three appointments today. Two invoices unpaid. One note from
							yesterday links to both.
						</Card>
					</div>
				),
				code: `<Card title="Morning brief" actions={<Badge tone="rose">AI</Badge>}>
  Three appointments today. Two invoices unpaid.
</Card>`,
			},
			{
				title: "Showcase — card types",
				render: () => <CardsShowcase />,
				code: `<Card aria-label="Twitter style post card">
  <PostHeader />
  <p>Moved every follow-up into one timeline…</p>
  <img src={preview} alt="Timeline preview" />
  <PostActions />
</Card>

<Card aria-label="Instagram style media card">…</Card>
<Card aria-label="Ecommerce product card">…</Card>
<Card title="Article preview" actions={<Badge>Read</Badge>}>…</Card>
<Card tone="band" title="Event card">…</Card>
<Card tone="warning" title="Needs review">…</Card>`,
			},
		],
	},
	{
		id: "tabs",
		group: "Primitives",
		name: "Tabs",
		description: "The active tab's horizon lights in cobalt.",
		stories: [
			{
				title: "Default",
				render: () => <TabsDemo />,
				code: `const [tab, setTab] = useState("notes");

<Tabs
  aria-label="Sections"
  value={tab}
  onValueChange={setTab}
  items={[
    { id: "notes", label: "Notes" },
    { id: "automations", label: "Automations" },
    { id: "apps", label: "Apps" },
  ]}
/>`,
			},
		],
	},
	{
		id: "dialog",
		group: "Primitives",
		name: "Dialog",
		description:
			"The stage dims; one lit panel rises. Used only when focus must be protected.",
		stories: [
			{
				title: "Default",
				render: () => <DialogDemo />,
				code: `<Dialog
  open={open}
  onClose={close}
  title="Archive this note?"
  footer={<Button onClick={close}>Archive</Button>}
>
  It stays searchable, but leaves your daily view.
</Dialog>`,
			},
		],
	},
	{
		id: "avatar",
		group: "Primitives",
		name: "Avatar",
		description: "A soft token for a person — initials until a photo exists.",
		stories: [
			{
				title: "Sizes",
				render: () => (
					<div className="row">
						<Avatar name="Asha Verma" size="sm" />
						<Avatar name="Asha Verma" size="md" />
						<Avatar name="Ravi Kumar" size="lg" />
					</div>
				),
				code: `<Avatar name="Asha Verma" size="sm" />
<Avatar name="Asha Verma" size="md" />
<Avatar name="Ravi Kumar" size="lg" />`,
			},
		],
	},
	{
		id: "divider",
		group: "Primitives",
		name: "Divider",
		description: "The horizon rule: a hairline that fades at the edges.",
		stories: [
			{
				title: "Variants",
				render: () => (
					<div
						style={{
							width: "100%",
							display: "flex",
							flexDirection: "column",
							gap: 24,
						}}
					>
						<Divider />
						<Divider label="Yesterday" />
					</div>
				),
				code: `<Divider />
<Divider label="Yesterday" />`,
			},
		],
	},
	{
		id: "skeleton",
		group: "Primitives",
		name: "Skeleton",
		description:
			"The band warming up before content arrives. Stills completely under reduced motion.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ maxWidth: 420, width: "100%" }}>
						<Skeleton lines={3} />
					</div>
				),
				code: `<Skeleton lines={3} />`,
			},
		],
	},
	{
		id: "calendar",
		group: "Primitives",
		name: "Calendar",
		description:
			"react-day-picker headless under our skin: tabular days, cobalt selection, today wears a hairline ring.",
		stories: [
			{
				title: "Default",
				render: () => <CalendarDemo />,
				code: `const [day, setDay] = useState(new Date());

<Calendar mode="single" selected={day} onSelect={setDay} />`,
			},
		],
	},
	{
		id: "date-picker",
		group: "Primitives",
		name: "Date Picker",
		description: "A field that opens the calendar; picks one day.",
		stories: [
			{
				title: "Default",
				render: () => <DatePickerDemo />,
				code: `const [date, setDate] = useState<Date>();

<DatePicker label="Appointment" value={date} onValueChange={setDate} />`,
			},
		],
	},
	{
		id: "date-range-picker",
		group: "Primitives",
		name: "Date Range Picker",
		description:
			"Two months side by side; the range is a lit band between two solid endpoints.",
		stories: [
			{
				title: "Two months",
				render: () => <DateRangePickerDemo />,
				code: `const [range, setRange] = useState<DateRange>();

<DateRangePicker label="Camp dates" value={range} onValueChange={setRange} />`,
			},
		],
	},
	{
		id: "date-time-picker",
		group: "Primitives",
		name: "Date & Time Picker",
		description:
			"The calendar with hour, minute, and AM/PM fields riding below it.",
		stories: [
			{
				title: "Default",
				render: () => <DateTimePickerDemo />,
				code: `<DateTimePicker label="Reminder at" value={value} onValueChange={setValue} />`,
			},
		],
	},
	{
		id: "time-picker",
		group: "Primitives",
		name: "Time Picker",
		description: "Just the clock: 12-hour, five-minute steps, AM/PM.",
		stories: [
			{
				title: "Default",
				render: () => <TimePickerDemo />,
				code: `<TimePicker label="Opens at" value={value} onValueChange={setValue} />`,
			},
		],
	},
	{
		id: "tooltip",
		group: "Primitives",
		name: "Tooltip",
		description: "A console readout: always night, always brief.",
		stories: [
			{
				title: "Default",
				render: () => (
					<Tooltip tip="Linked to 4 notes">
						<Button variant="secondary">Hover or focus me</Button>
					</Tooltip>
				),
				code: `<Tooltip tip="Linked to 4 notes">
  <Button variant="secondary">Hover or focus me</Button>
</Tooltip>`,
			},
		],
	},
	{
		id: "icon-button",
		group: "Shell",
		name: "Icon Button",
		description:
			"An action with no visible text — the label prop is required and becomes the accessible name.",
		stories: [
			{
				title: "Variants & sizes",
				render: () => (
					<div className="row">
						<IconButton label="Add" icon={<Plus />} />
						<IconButton
							label="Notifications"
							icon={<Bell />}
							variant="secondary"
						/>
						<IconButton
							label="More actions"
							icon={<MoreHorizontal />}
							size="sm"
						/>
						<IconButton
							label="Add large"
							icon={<Plus />}
							size="lg"
							variant="secondary"
						/>
					</div>
				),
				code: `<IconButton label="Add" icon={<Plus />} />
<IconButton label="Notifications" icon={<Bell />} variant="secondary" />
<IconButton label="More actions" icon={<MoreHorizontal />} size="sm" />`,
			},
		],
	},
	{
		id: "search-input",
		group: "Shell",
		name: "Search Input",
		description:
			"The field with its instrument built in — leading icon, full width of its tier.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ width: 260 }}>
						<SearchInput
							placeholder="Search notes…"
							aria-label="Search notes"
						/>
					</div>
				),
				code: `<SearchInput placeholder="Search notes…" aria-label="Search notes" />`,
			},
		],
	},
	{
		id: "menu",
		group: "Shell",
		name: "Menu",
		description:
			"An anchored popup for secondary actions. Closes on Escape, outside click, or selection.",
		stories: [
			{
				title: "Default",
				render: () => (
					<Menu trigger={<Button variant="secondary">Note actions</Button>}>
						<MenuItem icon={<Pencil />}>Rename</MenuItem>
						<MenuItem icon={<Copy />}>Duplicate</MenuItem>
						<MenuDivider />
						<MenuItem icon={<Trash2 />} danger>
							Delete
						</MenuItem>
					</Menu>
				),
				code: `<Menu trigger={<Button variant="secondary">Note actions</Button>}>
  <MenuItem icon={<Pencil />}>Rename</MenuItem>
  <MenuItem icon={<Copy />}>Duplicate</MenuItem>
  <MenuDivider />
  <MenuItem icon={<Trash2 />} danger>Delete</MenuItem>
</Menu>`,
			},
		],
	},
	{
		id: "file-tree",
		group: "Shell",
		name: "File Tree",
		description:
			"Folders with guide lines: click expands, the selected row lights cobalt, counts stay tabular.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ width: 280 }}>
						<FileTree
							aria-label="Demo folders"
							defaultExpanded={["inspiration"]}
							nodes={[
								{
									id: "sources",
									label: "Project sources",
									children: [
										{ id: "s1", label: "Source files" },
										{ id: "s2", label: "Exports" },
									],
								},
								{
									id: "inspiration",
									label: "Design inspiration",
									children: [
										{ id: "pd", label: "Product design", count: 4 },
										{ id: "br", label: "Branding" },
										{ id: "da", label: "Digital art" },
									],
								},
								{ id: "neu", label: "NEU documents" },
							]}
						/>
					</div>
				),
				code: `<FileTree
  nodes={[
    { id: "inspiration", label: "Design inspiration",
      children: [{ id: "pd", label: "Product design", count: 4 }, …] },
  ]}
  selected={id}
  onSelect={setId}
  defaultExpanded={["inspiration"]}
/>`,
			},
		],
	},
	{
		id: "nav-rail",
		group: "Shell",
		name: "Nav Rail",
		description:
			"The slim first tier: icons only, always night. The active space lights in cobalt; labels ride as right-side tooltips.",
		stories: [
			{
				title: "Default",
				render: () => <NavRailDemo />,
				code: `<NavRail
  value={space}
  onValueChange={setSpace}
  items={[
    { id: "notes", icon: <StickyNote />, label: "Notes" },
    { id: "search", icon: <Search />, label: "Search" },
    { id: "automations", icon: <Zap />, label: "Automations" },
    { id: "settings", icon: <Settings />, label: "Settings" },
  ]}
/>`,
			},
		],
	},
	{
		id: "nav-panel",
		group: "Shell",
		name: "Nav Panel",
		description:
			"The full second tier: search on top, sections of links, and a footer for secondary links and the account row.",
		stories: [
			{
				title: "Composed",
				render: () => <NavPanelDemo />,
				code: `<NavPanel
  search={<SearchInput placeholder="Search notes…" />}
  footer={
    <AccountMenu name="Asha Verma" sub="Clinic workspace">
      <MenuItem icon={<User />}>Profile</MenuItem>
      <MenuDivider />
      <MenuItem icon={<LogOut />} danger>Log out</MenuItem>
    </AccountMenu>
  }
>
  <NavSection label="Workspace" items={…} value={page} onValueChange={setPage} />
  <NavSection label="Recent" items={…} />
</NavPanel>`,
			},
		],
	},
	{
		id: "account-menu",
		group: "Shell",
		name: "Account Menu",
		description:
			"Avatar, name, and a three-dots button that opens a menu upward — the foot of every panel.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ width: 240 }}>
						<AccountMenu name="Asha Verma" sub="Clinic workspace">
							<MenuItem icon={<User />}>Profile</MenuItem>
							<MenuItem icon={<SlidersHorizontal />}>Preferences</MenuItem>
							<MenuDivider />
							<MenuItem icon={<LogOut />} danger>
								Log out
							</MenuItem>
						</AccountMenu>
					</div>
				),
				code: `<AccountMenu name="Asha Verma" sub="Clinic workspace">
  <MenuItem icon={<User />}>Profile</MenuItem>
  <MenuItem icon={<SlidersHorizontal />}>Preferences</MenuItem>
  <MenuDivider />
  <MenuItem icon={<LogOut />} danger>Log out</MenuItem>
</AccountMenu>`,
			},
		],
	},
	{
		id: "table",
		group: "Data",
		name: "Table",
		description:
			"The plain ledger: cue-caps header, hairline rows, tabular figures. Compose it by hand.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ width: "100%" }}>
						<Table>
							<THead>
								<TR>
									<TH>Date</TH>
									<TH>Patient</TH>
									<TH align="right">Amount</TH>
								</TR>
							</THead>
							<TBody>
								<TR>
									<TD>Aug 1</TD>
									<TD>Ravi Kumar</TD>
									<TD align="right">₹1,200</TD>
								</TR>
								<TR>
									<TD>Aug 1</TD>
									<TD>Meera Iyer</TD>
									<TD align="right">₹850</TD>
								</TR>
								<TR>
									<TD>Jul 28</TD>
									<TD>Arjun Nair</TD>
									<TD align="right">₹2,400</TD>
								</TR>
							</TBody>
						</Table>
					</div>
				),
				code: `<Table>
  <THead>
    <TR>
      <TH>Date</TH>
      <TH>Patient</TH>
      <TH align="right">Amount</TH>
    </TR>
  </THead>
  <TBody>
    <TR>
      <TD>Aug 1</TD>
      <TD>Ravi Kumar</TD>
      <TD align="right">₹1,200</TD>
    </TR>
  </TBody>
</Table>`,
			},
		],
	},
	{
		id: "data-gantt",
		group: "Data",
		name: "Data Gantt",
		description:
			"A data-to-details timeline: records stay readable on the left, work appears as tabular date bars on the right, and the selected row opens a detail panel below.",
		stories: [
			{
				title: "Automation plan — selectable records and detail facts",
				render: () => (
					<div style={{ width: "100%" }}>
						<DataGantt
							items={GANTT_ITEMS}
							from="2026-08-03"
							to="2026-08-24"
							today="2026-08-14"
							defaultSelectedId="assistant"
						/>
					</div>
				),
				code: `<DataGantt
  items={[
    {
      id: "assistant",
      title: "Draft reminder workflow",
      start: "2026-08-10",
      end: "2026-08-18",
      progress: 34,
      status: "AI draft",
      tone: "rose",
      meta: [{ label: "Needs", value: "Approval", tone: "rose" }],
    },
  ]}
  from="2026-08-03"
  to="2026-08-24"
  today="2026-08-14"
/>`,
			},
		],
	},
	{
		id: "day-timeline",
		group: "Data",
		name: "Day Timeline",
		description:
			"A tracked day as segments of light: proportional bands, hour axis, and a legend with shares — tones cycle the horizon palette.",
		stories: [
			{
				title: "Default",
				render: () => (
					<div style={{ width: "100%", maxWidth: 560 }}>
						<DayTimeline
							title="Timeline"
							dateLabel="Today, Apr 05 2026"
							tracking
							segments={[
								{ label: "Nexora Web", start: 10 * 60, end: 14 * 60 + 15 },
								{
									label: "Bluemint App",
									start: 14 * 60 + 15,
									end: 18 * 60 + 20,
								},
								{ label: "Klaro", start: 18 * 60 + 20, end: 20 * 60 + 30 },
								{ label: "FEST", start: 20 * 60 + 30, end: 21 * 60 },
							]}
						/>
					</div>
				),
				code: `<DayTimeline
  title="Timeline"
  dateLabel="Today, Apr 05 2026"
  tracking
  segments={[
    { label: "Nexora Web", start: 600, end: 855 },
    { label: "Bluemint App", start: 855, end: 1100 },
    // minutes from midnight; tones cycle automatically
  ]}
/>`,
			},
		],
	},
	{
		id: "data-table",
		group: "Data",
		name: "Data Table",
		description:
			"The working table, on TanStack Table: click any cell to edit in place, filter builder, sorts, resizable columns, pagination. Header gear opens column settings.",
		stories: [
			{
				title: "Invoices — editable cells, ten column types",
				render: () => (
					<div style={{ width: "100%" }}>
						<DataTable
							columns={invoiceColumns}
							rows={INVOICES}
							rowKey={(r) => r.id}
							searchText={(r) => `${r.id} ${r.patient}`}
							searchPlaceholder="Search invoices…"
							pageSize={8}
							editable
						/>
					</div>
				),
				code: `<DataTable
  columns={[
    { id: "patient", label: "Patient", width: 210,
      cell: (r) => r.patient, sortValue: (r) => r.patient,
      filter: { kind: "text" } },
    { id: "amount", label: "Amount", align: "right", width: 130,
      cell: (r) => "₹" + r.amount.toLocaleString(), sortValue: (r) => r.amount,
      filter: { kind: "number" } },
    { id: "status", label: "Status", width: 140,
      cell: (r) => <Badge tone={tone(r.status)}>{r.status}</Badge>,
      filter: { kind: "enum", options: [Paid, Due, Overdue] },
      filterValue: (r) => r.status },
    // …
  ]}
  rows={invoices}
  rowKey={(r) => r.id}
  searchText={(r) => r.id + " " + r.patient}
  pageSize={8}
  editable
/>`,
			},
		],
	},
	{
		id: "messages",
		group: "Chat",
		name: "Messages",
		description:
			"Slack-style grouping: one avatar and header per run of messages, hover actions, reply quotes, Author badges for thread starters, nested thread replies with a connector line, an X-reply link, and reaction pills that light cobalt when you join them.",
		stories: [
			{
				title: "Grouped with reactions",
				render: () => (
					<div style={{ width: 480, maxWidth: "100%" }}>
						<MessageGroup author="Asha Verma" time="09:41">
							<ChatMessage>
								<TextMessage>Morning! Ward 4 summaries are in.</TextMessage>
							</ChatMessage>
							<ChatMessage
								reactions={[
									{ emoji: "👍", count: 2 },
									{ emoji: "❤️", count: 1, active: true },
								]}
							>
								<TextMessage>
									Discharge for Ravi Kumar is ready for review.
								</TextMessage>
							</ChatMessage>
						</MessageGroup>
					</div>
				),
				code: `<MessageGroup author="Asha Verma" time="09:41">
  <ChatMessage>
    <TextMessage>Morning! Ward 4 summaries are in.</TextMessage>
  </ChatMessage>
  <ChatMessage reactions={[{ emoji: "👍", count: 2, active: true }]}>
    <TextMessage>Discharge is ready for review.</TextMessage>
  </ChatMessage>
</MessageGroup>`,
			},
			{
				title: "Reply quote — inline preview of the message being replied to",
				render: () => (
					<div style={{ width: 480, maxWidth: "100%" }}>
						<MessageGroup id="m1" author="Dev Patel" time="10:02">
							<ChatMessage>
								<TextMessage>
									If you really just want to filter out the first n characters
									of a file, the tool you want is dd which allows you to specify
									the number of blocks to skip. If you want a block size of 1,
									specify that with bs.
								</TextMessage>
							</ChatMessage>
						</MessageGroup>

						<MessageGroup author="Amanda" time="10:08">
							<ChatMessage
								replyTo={{
									id: "m1",
									author: "Dev Patel",
									time: "10:02",
									text: "If you really just want to filter out the first n characters of a file, the tool you want is dd which allows you to specify the number of blocks to skip. If you want a block size of 1, specify that with bs.",
								}}
								onReplyClick={() => {
									document
										.getElementById("m1")
										?.scrollIntoView({ behavior: "smooth", block: "center" });
								}}
							>
								<TextMessage>
									Thank you for the suggestion. There is still one difference
									from the desired output though; I think the false argument in
									the if_else() function should not be constant.
								</TextMessage>
							</ChatMessage>
						</MessageGroup>

						<MessageGroup author="Amanda" time="10:11">
							<ChatMessage
								reactions={[{ emoji: "🙌", count: 1 }]}
								replyTo={{
									id: "m1",
									author: "Dev Patel",
									time: "10:02",
									text: "The resulting cell should show the value from the appropriate column (and not, for instance, all equal those from x1). Any idea on how this can be achieved?",
								}}
							>
								<TextMessage>
									Okay great, that&rsquo;s all the information I needed to know!
								</TextMessage>
							</ChatMessage>
						</MessageGroup>
					</div>
				),
				code: `<MessageGroup author="Amanda" time="10:08">
  <ChatMessage
    replyTo={{
      id: "m1",
      author: "Dev Patel",
      time: "10:02",
      text: "If you really just want to filter out the first n characters…",
    }}
    onReplyClick={(id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
  >
    <TextMessage>Thank you for the suggestion…</TextMessage>
  </ChatMessage>
</MessageGroup>`,
			},
			{
				title: "Threaded reply — Author badge, X-reply link, nested connector",
				render: () => (
					<div style={{ width: 540, maxWidth: "100%" }}>
						<ChatPanel active>
							<ChatList>
								<MessageGroup author="Amanda" time="5h ago">
									<ChatMessage
										reactions={[{ emoji: "😄", count: 1 }]}
										replyCount={1}
									>
										<TextMessage>
											If you really just want to filter out the first n
											characters of a file, the tool you want is dd which allows
											you to specify the number of blocks to skip. If you want a
											block size of 1, specify that with bs.
										</TextMessage>
									</ChatMessage>
								</MessageGroup>

								<MessageGroup author="Amanda" time="5h ago" thread authorBadge>
									<ChatMessage reactions={[{ emoji: "🙌", count: 1 }]}>
										<TextMessage>
											Okay great thats all the information i needed to know!
										</TextMessage>
									</ChatMessage>
								</MessageGroup>
							</ChatList>
						</ChatPanel>
					</div>
				),
				code: `<ChatPanel active>
  <ChatList>
    <MessageGroup author="Amanda" time="5h ago">
      <ChatMessage
        reactions={[{ emoji: "😄", count: 1 }]}
        replyCount={1}
      >
        <TextMessage>If you really just want to filter out…</TextMessage>
      </ChatMessage>
    </MessageGroup>

    {/* thread reply: indented avatar, vertical connector,
        Author badge for the thread starter */}
    <MessageGroup author="Amanda" time="5h ago" thread authorBadge>
      <ChatMessage reactions={[{ emoji: "🙌", count: 1 }]}>
        <TextMessage>Okay great thats all the information i needed to know!</TextMessage>
      </ChatMessage>
    </MessageGroup>
  </ChatList>
</ChatPanel>

{/* ChatPanel \`active\` lights the cobalt outline around the whole panel */}`,
			},
		],
	},
	{
		id: "media-messages",
		group: "Chat",
		name: "Media Messages",
		description:
			"Image, gallery with overflow count, video with play affordance, voice note with waveform, and a document card. (Imagery is synthetic placeholder.)",
		stories: [
			{
				title: "All media types",
				render: () => (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 20,
							width: 480,
							maxWidth: "100%",
						}}
					>
						<MessageGroup author="Ravi Kumar" time="09:44">
							<ChatMessage>
								<ImageMessage src={PHOTOS[1].src} alt={PHOTOS[1].alt} />
							</ChatMessage>
							<ChatMessage>
								<GalleryMessage images={PHOTOS} />
							</ChatMessage>
							<ChatMessage>
								<VideoMessage poster={PHOTOS[0].src} duration="0:18" />
							</ChatMessage>
							<ChatMessage>
								<AudioMessage duration="0:42" />
							</ChatMessage>
							<ChatMessage>
								<DocumentMessage
									name="Discharge-summary-Kumar.pdf"
									meta="PDF · 184 KB"
								/>
							</ChatMessage>
						</MessageGroup>
					</div>
				),
				code: `<ImageMessage src={scan} alt="Lab scan" />
<GalleryMessage images={scans} />        {/* 4 tiles, +N overflow */}
<VideoMessage poster={poster} duration="0:18" />
<AudioMessage duration="0:42" />
<DocumentMessage name="Summary.pdf" meta="PDF · 184 KB" />`,
			},
		],
	},
	{
		id: "bot-message",
		group: "Chat",
		name: "Bot Message",
		description:
			"The AI carries the rose light: rose badge, and action buttons that turn a suggestion into one tap.",
		stories: [
			{
				title: "With action buttons",
				render: () => (
					<div style={{ width: 480, maxWidth: "100%" }}>
						<MessageGroup author="twodb Assistant" bot time="09:45">
							<ChatMessage
								actions={[
									{ label: "Summarize thread", variant: "primary" },
									{ label: "Create reminders" },
									{ label: "Not now", variant: "ghost" },
								]}
							>
								<TextMessage>
									I found 3 unpaid invoices linked to today&rsquo;s discharges.
									Want me to draft payment reminders?
								</TextMessage>
							</ChatMessage>
						</MessageGroup>
					</div>
				),
				code: `<MessageGroup author="twodb Assistant" bot time="09:45">
  <ChatMessage actions={[
    { label: "Summarize thread", variant: "primary" },
    { label: "Create reminders" },
    { label: "Not now", variant: "ghost" },
  ]}>
    <TextMessage>I found 3 unpaid invoices…</TextMessage>
  </ChatMessage>
</MessageGroup>`,
			},
		],
	},
	{
		id: "chat-panel",
		group: "Chat",
		name: "Chat Panel",
		description:
			"The whole thing composed: group header with member stack, grouped messages of every type, bot actions, reactions — and a working composer.",
		stories: [
			{
				title: "Full mock — try sending a message",
				render: () => <ChatPanelDemo />,
				code: `<ChatPanel>
  <ChatHeader title="Morning rounds" subtitle="4 members" members={…} />
  <ChatList>
    <MessageGroup author="Asha Verma" time="09:41">…</MessageGroup>
    <MessageGroup author="twodb Assistant" bot time="09:45">…</MessageGroup>
    …
  </ChatList>
  <ChatComposer onSend={(text) => append(text)} />
</ChatPanel>`,
			},
		],
	},

	{
		id: "compose-email",
		group: "Showcase",
		name: "Compose Email",
		description:
			"A large compose window inspired by the supplied reference: sender and recipient chips, subject/body, attachment cards, round compose tools, and a primary send action.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — composed email with attachments",
				render: () => <ComposeEmailMock />,
				code: `<ComposeEmailMock />

{/* Full compose state:
    from/to chips, cc/bcc controls,
    message body, attachment cards,
    formatting/attach/link/emoji/schedule tools. */}`,
			},
		],
	},

	{
		id: "detected-accounts",
		group: "Showcase",
		name: "Detected Accounts",
		description:
			"An automatically detected accounts section for a person profile: integration matches, confidence, split link actions, overflow account actions, and already-linked connections.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — review and link detected accounts",
				render: () => <DetectedAccountsMock />,
				code: `<DetectedAccountsMock />

{/* Person profile account linking:
    detected identities from integrations,
    match confidence and evidence,
    link / ignore actions,
    and linked connections table. */}`,
			},
		],
	},
	{
		id: "weekly-calendar",
		group: "Showcase",
		name: "Weekly Calendar",
		description:
			"A weekly calendar workspace inspired by the supplied reference: slim app rail, mini month picker, schedule filters, week/month controls, and a time-grid with realistic event blocks.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — week schedule with filters",
				render: () => <WeeklyCalendarMock />,
				code: `<WeeklyCalendarMock />

{/* Calendar workspace:
    app rail + mini month,
    schedule and category filters,
    week view with time slots,
    color-coded events and attendee stacks. */}`,
			},
		],
	},
	{
		id: "share-settings",
		group: "Showcase",
		name: "Share Settings",
		description:
			"A share dialog mock inspired by the supplied reference: access list, permissions, copy-link footer, and the active group/person search state.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — access list and search results",
				render: () => <ShareSettingsMock />,
				code: `<ShareSettingsMock />

{/* Two dialog states side-by-side:
    people with access + permissions,
    and the active group/person search result list. */}`,
			},
		],
	},
	{
		id: "prodex-dashboard",
		group: "Showcase",
		name: "Prodex Dashboard",
		description:
			"A commerce analytics dashboard inspired by the supplied Prodex reference: sidebar, KPI tiles, revenue bars, category donut, activity feed, and top-products table.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — commerce analytics dashboard",
				render: () => <ProdexDashboardMock />,
				code: `<ProdexDashboardMock />

{/* Built as a full dashboard composition:
    sidebar + workspace switcher,
    KPI stat cards,
    CSS/SVG revenue + donut charts,
    recent activity and products table. */}`,
			},
		],
	},
	{
		id: "salesmate-pro",
		group: "Showcase",
		name: "SalesMate Pro",
		description:
			"A CRM sales dashboard in warm earth tones — espresso top bar, cream sidebar, and a five-card Sales Overview with revenue and pipeline trend bars, action items list, a six-month performance line chart, and quota attainment.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — Sales Overview dashboard",
				render: () => <SalesMateProMock />,
				code: `<SalesMateProMock />

{/* Espresso top bar + cream sidebar + 5-card overview grid:
    Revenue (Closed Won vs Pending bars),
    Deals Pipeline (In Progress vs At Risk bars),
    Action Items (5-row task list),
    Sales Performance (smooth Won/Lost line + area),
    Quota Attainment (3-bar Target / Achieved / Remaining).
    Self-contained earth-tone palette so the dashboard keeps
    its identity when the canvas flips to night. */}`,
			},
		],
	},
	{
		id: "integrations",
		group: "Showcase",
		name: "Integrations",
		description:
			"A full-page mock built from system parts: category tabs, connected-first rows with issue states, and an available grid with Connect.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — plugins, tools, services",
				render: () => <IntegrationsMock />,
				code: `<Tabs items={[Plugins, Tools, Services]} … />

{/* connected first, issues inline */}
<Row icon name status="issue">
  <Badge tone="danger">Issue</Badge>
  <Button size="sm">Reconnect</Button>
  <Menu>Configure · Sync now · Disconnect</Menu>
</Row>

{/* available grid */}
<Card icon name desc>
  <Button size="sm" variant="secondary">Connect</Button>
</Card>`,
			},
		],
	},
	{
		id: "settings",
		group: "Showcase",
		name: "Settings",
		description:
			"The deep one — profile, security, privacy, a notification matrix, and appearance, all built from SettingGroup/SettingRow and live controls.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — five sections, everything works",
				render: () => <SettingsMock />,
				code: `<SettingGroup label="Who can see you">
  <SettingRow label="Profile visibility"
    control={<Select options={whoOptions} />} />
  <SettingRow label="Activity status"
    control={<Switch checked />} />
</SettingGroup>

{/* profile photo, password flow with validation,
    2FA, sessions, privacy selects + switches,
    notification matrix, quiet hours (TimePicker),
    theme that flips the real phase */}`,
			},
		],
	},
	{
		id: "two-factor",
		group: "Showcase",
		name: "Two-Factor Auth",
		description:
			"Authenticator setup end to end: QR code, manual secret with copy, 6-digit verification, then backup codes — on the new QRCode and CodeInput components.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — setup flow and enabled state",
				render: () => <TwoFactorMock />,
				code: `<QRCode value={otpauthUri} size={168} />
<CodeInput length={6} onComplete={verify} error={err} />

{/* Step 1: scan or copy the secret
    Step 2: 6-digit verify (000000 = error demo)
    Success: backup codes, copy all, regenerate */}`,
			},
		],
	},
	{
		id: "morning-brief",
		group: "Showcase",
		name: "Morning Brief",
		description:
			"The 06:30 page from the blog post, live: appointments with prep flags, interactive task stacks with snooze/complete, overnight reports, stock below the reorder line, and the one thing.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — the 06:30 page",
				render: () => <MorningBriefMock />,
				code: `<Stack cue="Appointments" footer="2 need preparation">
  <Row avatar name reason />
  <Badge tone="warning">Prep soon</Badge> + time pill
</Stack>

<Stack cue="Tasks" action={<Button>New task</Button>}>
  <TaskRow checkbox title snooze complete />
  {/* completing strikes + sinks; footer strips count open tasks */}
</Stack>`,
			},
		],
	},
	{
		id: "investor-dashboard",
		group: "Showcase",
		name: "Investor Dashboard",
		description:
			"Portfolio SaaS: company list with score rings, metric donuts, a customer-concentration table with expandable rows, KPI strip, and revenue split bar.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — companies and concentration",
				render: () => <InvestorDashboardMock />,
				code: `<ScoreRing value={company.score} size={26} />

{/* list → detail: pick a company, expand a customer
    row for KPIs, revenue split, company details */}`,
			},
		],
	},
	{
		id: "table-plan",
		group: "Showcase",
		name: "Table Management",
		description:
			"Hotel floor service: reservation cards with time chips and payment states, zone floors with per-table chairs, and a two-way selection between the list and the plan.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — Main Dining, Terrace, Outdoor",
				render: () => <TablePlanMock />,
				code: `<FloorPlan zone={zone} tables={FLOORS[zone]} />
<ReservationList filter search select />

{/* click a reservation → its table lights up;
    click a table → its card selects */}`,
			},
		],
	},
	{
		id: "employee-panel",
		group: "Showcase",
		name: "Employee Panel",
		description:
			"A profile side panel: identity row, contact info, a tracked DayTimeline, notes with scope badges, file cards, and effective-dated compensation rows.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — profile drawer",
				render: () => <EmployeePanelMock />,
				code: `<DayTimeline title="Timeline" tracking
  dateLabel="Today, Apr 05 2026"
  segments={[{ label, start, end }, …]} />

{/* + notes (Private/Public), files, compensation history */}`,
			},
		],
	},
	{
		id: "todo-flow",
		group: "Showcase",
		name: "Todo Flow",
		description:
			"TickTick anatomy in our grammar: night nav with smart views and a week strip, grouped tasks with priority-colored checks and quick add, and a detail pane with subtasks and live comments.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — Next 7 Days",
				render: () => <TodoFlowMock />,
				code: `<TodoFlow />

{/* views filter the list; checks move tasks to
    Completed; click a task for subtasks + comments;
    quick-add lands in Inbox on Tomorrow */}`,
			},
		],
	},
	{
		id: "inbox",
		group: "Showcase",
		name: "Inbox",
		description:
			"A three-pane mail inbox: folders and labels, pinned + primary thread list with live search, and a reading pane with an AI summary card, recipient chips, and attachments.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — folders, threads, reading pane",
				render: () => <InboxMock />,
				code: `{/* folders rail + thread list + reading pane */}
<NavSection items={folders} />  {/* counts as tabular badges */}
<ThreadRow active unread time snippet />
{/* AI summary = rose-soft panel (the AI's light) */}
<Composer via Dialog — To / Subject / Message />`,
			},
		],
	},
	{
		id: "monthly-calendar",
		group: "Showcase",
		name: "Monthly Calendar",
		description:
			"A full month page on the new MonthCalendar: tabs per calendar, live search, month/list views, and an Add-event dialog using DatePicker + TimePicker.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — month grid, tabs, add event",
				render: () => <MonthlyCalendarMock />,
				code: `<MonthCalendar
  month={month}
  events={events}   // { date, title, time, tone, cal }
  today={demoToday}
  onSelectDay={(d) => openAdd(d)}
/>

{/* chips: cobalt / rose / warning / neutral / danger;
    "+N more…" overflow; click a day to prefill the dialog */}`,
			},
		],
	},
	{
		id: "design-discussion",
		group: "Showcase",
		name: "Design Discussion",
		description:
			"A threaded discussion space: channel tree, posts with @mentions and toggleable reactions, a link card, a composer with working @-autocomplete, and an info panel with activity and members.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — thread, mentions, info panel",
				render: () => <DesignDiscussionMock />,
				code: `{/* @mentions light up cobalt; reactions toggle;
    composer: type @ for member autocomplete;
    Send appends your post to the thread */}`,
			},
		],
	},
	{
		id: "chat-mail",
		group: "Showcase",
		name: "Chat Mail",
		description:
			"Email that reads like a conversation: folders rail, thread list with categories and a smart-replies toggle, and a reading pane built on the chat suite — summary card, quick answers, composer.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — the inbox as a chat",
				render: () => <ChatMailMock />,
				code: `{/* reading pane = ChatList + MessageGroup */}
<MessageGroup author time><TextMessage /></MessageGroup>
<ChatComposer onSend={reply} />

{/* quick answers send instantly; star toggles;
    opening a thread clears its unread badge */}`,
			},
		],
	},
	{
		id: "live-scribe",
		group: "Showcase",
		name: "Live Transcription",
		description:
			"A meeting that types itself: video stage with real call controls, an AI scribe card with a live waveform and lines that arrive while you watch, participant tiles, and a summary with key points.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — Ward 4 morning rounds",
				render: () => <LiveScribeMock />,
				code: `{/* the transcript is actually live:
    lines append on an interval while Listening */}
<Scribe listening onPause />
<Stage controls=[mic, cam, end, share] />

{/* Pause freezes the waveform; Transcript tab
    mirrors every arrived line */}`,
			},
		],
	},
	{
		id: "week-planner",
		group: "Showcase",
		name: "Week Planner",
		description:
			"The week as a planner: mini month and category filters on the left, a time-grid with tinted event cards on the right. Day / Week / Month tabs, week navigation, and filters that hide whole categories.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — the clinic week",
				render: () => <WeeklyCalMock />,
				code: `{/* the mini month and the grid share one anchor date;
    unchecking a category removes its cards */}
<Calendar selected={anchor} onSelect={setAnchor} />
<WeekGrid events={visible} />

{/* Day tab collapses the grid to the anchor day;
    Month tab jumps back to week on pick */}`,
			},
		],
	},
	{
		id: "company-profile",
		group: "Showcase",
		name: "Company Profile",
		description:
			"A Notion-style company page: identity hero, about + certifications + details column, and a files table on DataTable with expiration status pills and file chips.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — profile and files",
				render: () => <CompanyProfileMock />,
				code: `{/* DataTable does search / filters / pagination;
    expiration pill: danger expired · warning ≤30d · go valid;
    filter enums: has-file, expiration state */}`,
			},
		],
	},
	{
		id: "file-manager",
		group: "Showcase",
		name: "File Manager",
		description:
			"The file sidebar: night Create-new button with a menu, the FileTree folder browser, and a content grid that follows the selected folder.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — sidebar and content",
				render: () => <FileManagerMock />,
				code: `<FileTree nodes={tree} selected={sel} onSelect={setSel} />

{/* create-new = night button + Menu
    (New folder / New document / Upload) */}`,
			},
		],
	},
	{
		id: "file-drive",
		group: "Showcase",
		name: "File Drive",
		description:
			"The clinic's documents, organized: folder cards and a rail sub-nav that filter the same list, recent chips, type tabs + search, row selection with a live count, and a grid/list toggle.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — project files",
				render: () => <FileDriveMock />,
				code: `{/* one filter pipeline: folder cards, rail sub-nav,
    type tabs and search all narrow the same rows */}
<FolderCard onClick={filterFolder} />
<Table rows={visible} selectable />

{/* grid/list toggle switches the All files section;
    selection count lives in the table footer */}`,
			},
		],
	},
	{
		id: "project-files",
		group: "Showcase",
		name: "Project Files",
		description:
			"The three-pane file manager from the reference: folder rail, center with folder cards + recent chips + selectable table, and the right Files panel — all wired to one filter state.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — three panes, one state",
				render: () => <ProjectFilesMock />,
				code: `{/* the right Files panel is live: its folder tiles filter
    the center table (and light the center cards); its recent
    rows toggle table selection */}
<FilesPanel onFolder={filter} onPick={toggleSelect} />

{/* grid/list toggle, type tabs, search —
    one pipeline, three panes */}`,
			},
		],
	},
	{
		id: "communication",
		group: "Showcase",
		name: "Communication",
		description:
			"An autopilot thread: call recording with waveform player, expandable transcription, sent-mail bubble, AI suggestion that advances the task meter, Email/SMS composer, and a contact panel with history timeline.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — thread, composer, contact panel",
				render: () => <CommunicationMock />,
				code: `{/* waveform player (play/pause), transcription
    disclosure, suggestion ✓ -> tasks 1/2,
    Email/SMS tabs switch the composer */}`,
			},
		],
	},
	{
		id: "daily-calendar",
		group: "Showcase",
		name: "Daily Calendar",
		description:
			"One day, hour by hour: a timeline with a now-line at 14:00, spanning and overlapping event cards, category chips that filter, and an agenda checklist that strikes through as you finish the day.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — the clinic day",
				render: () => <DailyCalMock />,
				code: `{/* three navigable days share one shape;
    overlapped events split the lane (col/cols) */}
<Timeline events={day.events} now={14} />
<Agenda onToggle={strikeThrough} />

{/* category chips dim AND filter; the mini month
    jumps between the three days */}`,
			},
		],
	},
	{
		id: "automation-builder",
		group: "Showcase",
		name: "Path Builder",
		description:
			"A visual path builder on React Flow: launch pill, trigger and step cards, a two-path branch, edge insert buttons, live node insertion from the Add Integration panel, working delete, search dimming, and zoom chrome.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — path builder canvas",
				render: () => <AutomationBuilderMock />,
				code: `{/* React Flow under the twodb skin:
    custom step/paths/launch/add nodes,
    smoothstep edges with mid-edge "+" insert */}
<ReactFlow nodes={nodes} edges={edges}
  nodeTypes={nodeTypes} edgeTypes={edgeTypes}
  nodesConnectable={false} fitView />

{/* edge "+" opens Add Integration;
    Continue splices the new step into the path */}`,
			},
		],
	},
	{
		id: "automation",
		group: "Showcase",
		name: "Recipe Builder",
		description:
			"A low-code recipe builder on React Flow: connector palette, a branched flow canvas with custom nodes and add-step edges, and a config panel that follows the selected node.",
		fullWidth: true,
		stories: [
			{
				title: "Mock — palette, canvas, config",
				render: () => <AutomationMock />,
				code: `{/* React Flow + custom AutomationNode
    (icon tile + label + handles);
    click a node -> config panel swaps;
    branch node fans out QUESTION/QUESTION/DEFAULT */}`,
			},
		],
	},
];
