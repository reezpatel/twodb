import {
	AlertTriangle,
	ArrowUpRight,
	BarChart3,
	Bell,
	ChevronRight,
	Clock,
	FileSignature,
	LayoutDashboard,
	Phone,
	PlayCircle,
	Plug,
	Search,
	Settings,
	Target,
	TrendingUp,
	Trophy,
	Users,
	WalletCards,
} from "lucide-react";
import "./sales-mate-pro";

/* ---------- Data ---------- */

const NAV = [
	{ label: "Dashboard", icon: <LayoutDashboard />, active: true },
	{ label: "Deals", icon: <WalletCards />, chevron: true },
	{ label: "Contacts", icon: <Users />, chevron: true },
	{ label: "Pipeline", icon: <TrendingUp />, chevron: true },
	{ label: "Leads", icon: <Target />, chevron: true },
	{ label: "Targets", icon: <Trophy /> },
	{ label: "Commissions", icon: <BarChart3 />, chevron: true },
	{ label: "Integrations", icon: <Plug /> },
	{ label: "Reports", icon: <BarChart3 /> },
];

const REVENUE = [
	{ label: "Last Month", a: 96, b: 70 },
	{ label: "This Week", a: 132, b: 100 },
	{ label: "Week 1", a: 110, b: 92 },
	{ label: "Week 2", a: 80, b: 72 },
	{ label: "Week 3", a: 64, b: 58 },
];
const REVENUE_TICKS = ["$150K", "$100K", "$50K", "$0K"];

const PIPELINE = [
	{ label: "Last Month", a: 132, b: 100 },
	{ label: "This Week", a: 156, b: 118 },
	{ label: "Week 1", a: 138, b: 108 },
	{ label: "Week 2", a: 100, b: 84 },
	{ label: "Week 3", a: 84, b: 72 },
];
const PIPELINE_TICKS = ["$400K", "$250K", "$100K", "$0K"];

const ACTION_ITEMS = [
	{
		icon: <Phone />,
		title: "Follow-up calls overdue",
		sub: "Enterprise prospects waiting",
		value: "14",
		badge: true,
	},
	{
		icon: <AlertTriangle />,
		title: "Stalled deals",
		sub: "$218,400 pipeline at risk",
		value: "$218,400",
	},
	{
		icon: <Clock />,
		title: "Expiring contracts",
		sub: "$67,500 needs renewal",
		value: "$67,500",
	},
	{
		icon: <PlayCircle />,
		title: "Demo requests pending",
		sub: "Scheduled for this week",
		value: "",
	},
	{
		icon: <FileSignature />,
		title: "Contracts awaiting signature",
		sub: "Worth $92,000 total",
		value: "$92,000",
	},
];

const PERF = [
	{ m: "Mar '26", won: 180, lost: -55 },
	{ m: "Apr '26", won: 240, lost: -45 },
	{ m: "May '26", won: 210, lost: -60 },
	{ m: "Jun '26", won: 280, lost: -50 },
	{ m: "Jul '26", won: 320, lost: -40 },
	{ m: "Aug '26", won: 360, lost: -35 },
];

const QUOTA = [
	{
		label: "Target",
		value: "$1,430,000",
		cls: "mock-sm__quotabar--target",
		barH: "100%",
	},
	{
		label: "Achieved",
		value: "$1,245,800",
		cls: "mock-sm__quotabar--achieved",
		barH: "89%",
	},
	{
		label: "Remaining",
		value: "$184,200",
		cls: "mock-sm__quotabar--remaining",
		barH: "27%",
	},
];

/* ---------- Sub-components ---------- */

function TopBar() {
	return (
		<div className="mock-sm__topbar">
			<div className="mock-sm__brand">
				<span className="mock-sm__brand-mark">SM</span>
				<span>SalesMate Pro</span>
			</div>
			<div className="mock-sm__search">
				<Search />
				<input type="text" placeholder="Search deals, contacts…" />
			</div>
			<div className="mock-sm__topbar-actions">
				<button
					type="button"
					className="mock-sm__iconbtn"
					aria-label="Notifications"
				>
					<Bell />
					<span className="mock-sm__bell-dot" />
				</button>
				<button
					type="button"
					className="mock-sm__iconbtn"
					aria-label="Settings"
				>
					<Settings />
				</button>
				<div className="mock-sm__avatar" aria-label="Account">
					MR
				</div>
			</div>
		</div>
	);
}

function Sidebar() {
	return (
		<aside className="mock-sm__side">
			{NAV.map((n) => (
				<button
					key={n.label}
					type="button"
					className={
						n.active
							? "mock-sm__navbtn mock-sm__navbtn--active"
							: "mock-sm__navbtn"
					}
				>
					{n.icon}
					<span className="mock-sm__navbtn-label">{n.label}</span>
					{n.chevron ? (
						<ChevronRight className="mock-sm__navbtn-chevron" />
					) : null}
				</button>
			))}
		</aside>
	);
}

function CardHead({
	title,
	sub,
	icon,
}: {
	title: string;
	sub: string;
	icon?: React.ReactNode;
}) {
	return (
		<div className="mock-sm__card-head">
			<div className="mock-sm__card-title-block">
				<h3 className="mock-sm__card-title">
					{icon}
					{title}
				</h3>
				<p className="mock-sm__card-sub">{sub}</p>
			</div>
			<button type="button" className="mock-sm__expand" aria-label="Expand">
				<ArrowUpRight />
			</button>
		</div>
	);
}

function TwoSeriesBarChart({
	data,
	ticks,
	legendA,
	legendB,
}: {
	data: { label: string; a: number; b: number }[];
	ticks: string[];
	legendA: string;
	legendB: string;
}) {
	const max = Math.max(...data.flatMap((d) => [d.a, d.b]));
	const scale = 110 / max; /* max bar height ~110px */

	return (
		<div className="mock-sm__chart">
			<div className="mock-sm__axis">
				{ticks.map((t) => (
					<span key={t}>{t}</span>
				))}
			</div>
			<div className="mock-sm__bars">
				{data.map((d) => (
					<div className="mock-sm__barcol" key={d.label}>
						<div className="mock-sm__bar-pair">
							<div
								className="mock-sm__bar mock-sm__bar--a"
								style={{ height: `${d.a * scale}px` }}
							/>
							<div
								className="mock-sm__bar mock-sm__bar--b"
								style={{ height: `${d.b * scale}px` }}
							/>
						</div>
						<span className="mock-sm__bar-x">{d.label}</span>
					</div>
				))}
			</div>
			<div style={{ gridColumn: "1 / -1", display: "none" }} />
			<div style={{ gridColumn: "2 / -1" }} className="mock-sm__legend">
				<span className="mock-sm__legend-item">
					<span className="mock-sm__legend-swatch mock-sm__legend-swatch--a" />
					{legendA}
				</span>
				<span className="mock-sm__legend-item">
					<span className="mock-sm__legend-swatch mock-sm__legend-swatch--b" />
					{legendB}
				</span>
			</div>
		</div>
	);
}

function RevenueCard() {
	return (
		<section className="mock-sm__card mock-sm__card--rev">
			<CardHead
				title="Revenue"
				sub="Monthly sales revenue"
				icon={<WalletCards />}
			/>
			<div className="mock-sm__stats">
				<div>
					<p className="mock-sm__stat-label">Closed Won</p>
					<p className="mock-sm__stat-value tw-tnum">$124,850</p>
					<p className="mock-sm__stat-meta">
						<strong>18</strong> Deals
					</p>
				</div>
				<div>
					<p className="mock-sm__stat-label">Pending</p>
					<p className="mock-sm__stat-value mock-sm__stat-value--coral tw-tnum">
						$87,320
					</p>
					<p className="mock-sm__stat-meta">
						<strong>12</strong> of <strong>30</strong> Deals
					</p>
				</div>
			</div>
			<TwoSeriesBarChart
				data={REVENUE}
				ticks={REVENUE_TICKS}
				legendA="Closed Won"
				legendB="Pending"
			/>
		</section>
	);
}

function PipelineCard() {
	return (
		<section className="mock-sm__card mock-sm__card--pipe">
			<CardHead
				title="Deals Pipeline"
				sub="Active opportunities"
				icon={<TrendingUp />}
			/>
			<div className="mock-sm__stats">
				<div>
					<p className="mock-sm__stat-label">In Progress</p>
					<p className="mock-sm__stat-value tw-tnum">$342,500</p>
					<p className="mock-sm__stat-meta">
						<strong>24</strong> Deals
					</p>
				</div>
				<div>
					<p className="mock-sm__stat-label">At Risk</p>
					<p className="mock-sm__stat-value mock-sm__stat-value--coral tw-tnum">
						$156,200
					</p>
					<p className="mock-sm__stat-meta">
						<strong>8</strong> of <strong>24</strong> At Risk
					</p>
				</div>
			</div>
			<TwoSeriesBarChart
				data={PIPELINE}
				ticks={PIPELINE_TICKS}
				legendA="In Progress"
				legendB="At Risk"
			/>
		</section>
	);
}

function ActionItemsCard() {
	return (
		<section className="mock-sm__card mock-sm__card--act">
			<CardHead title="Action Items" sub="Tasks requiring your attention" />
			<div className="mock-sm__actions">
				{ACTION_ITEMS.map((a) => (
					<div className="mock-sm__action-row" key={a.title}>
						<span className="mock-sm__action-icon">{a.icon}</span>
						<span className="mock-sm__action-text">
							<span className="mock-sm__action-title">{a.title}</span>
							<span className="mock-sm__action-sub">{a.sub}</span>
						</span>
						{a.badge ? (
							<span className="mock-sm__action-pill">{a.value}</span>
						) : (
							<span className="mock-sm__action-value tw-tnum">{a.value}</span>
						)}
						<ChevronRight className="mock-sm__action-chevron" />
					</div>
				))}
			</div>
		</section>
	);
}

/* Catmull-Rom → cubic bezier for smooth curves */
function smoothPath(points: { x: number; y: number }[]): string {
	if (points.length === 0) return "";
	let d = `M ${points[0].x},${points[0].y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
	}
	return d;
}

function PerformanceCard() {
	const w = 720;
	const h = 200;
	const pad = { l: 44, r: 16, t: 14, b: 28 };
	const max = 400;
	const min = 0;
	const xStep = (w - pad.l - pad.r) / (PERF.length - 1);
	const x = (i: number) => pad.l + i * xStep;
	const y = (v: number) =>
		pad.t + ((max - v) / (max - min)) * (h - pad.t - pad.b);

	const wonPts = PERF.map((p, i) => ({ x: x(i), y: y(p.won) }));
	const lostPts = PERF.map((p, i) => ({ x: x(i), y: y(p.lost) }));
	const wonPath = smoothPath(wonPts);
	const lostPath = smoothPath(lostPts);
	const areaPath = `${wonPath} L ${wonPts[wonPts.length - 1].x},${y(0)} L ${wonPts[0].x},${y(0)} Z`;

	return (
		<section className="mock-sm__card mock-sm__card--perf">
			<CardHead
				title="Sales Performance"
				sub="Last 6 months trends"
				icon={<TrendingUp />}
			/>
			<div className="mock-sm__perf-stats">
				<div>
					<p className="mock-sm__perf-stat-label">Won</p>
					<span className="mock-sm__perf-stat-value tw-tnum">$485,200</span>
				</div>
				<div>
					<p className="mock-sm__perf-stat-label">Lost</p>
					<span className="mock-sm__perf-stat-value mock-sm__perf-stat-value--coral tw-tnum">
						-$128,750
					</span>
				</div>
				<div>
					<p className="mock-sm__perf-stat-label">Net</p>
					<span className="mock-sm__perf-stat-value tw-tnum">$356,450</span>
				</div>
			</div>
			<svg
				className="mock-sm__perf-svg"
				viewBox={`0 0 ${w} ${h}`}
				role="img"
				aria-label="Sales performance over the last 6 months"
			>
				<defs>
					<linearGradient id="sm-won-fill" x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor="var(--sm-sienna-soft)"
							stopOpacity="0.45"
						/>
						<stop
							offset="100%"
							stopColor="var(--sm-sienna-soft)"
							stopOpacity="0"
						/>
					</linearGradient>
				</defs>
				{/* gridlines */}
				{[0, 0.5, 1].map((p) => (
					<line
						key={p}
						x1={pad.l}
						x2={w - pad.r}
						y1={pad.t + p * (h - pad.t - pad.b)}
						y2={pad.t + p * (h - pad.t - pad.b)}
						stroke="var(--sm-line)"
						strokeDasharray="3 4"
					/>
				))}
				{/* area */}
				<path d={areaPath} fill="url(#sm-won-fill)" />
				{/* Lost curve */}
				<path
					d={lostPath}
					fill="none"
					stroke="var(--sm-coral)"
					strokeWidth="2"
					strokeLinecap="round"
				/>
				{/* Won curve */}
				<path
					d={wonPath}
					fill="none"
					stroke="var(--sm-sienna)"
					strokeWidth="2.5"
					strokeLinecap="round"
				/>
				{/* highlight last won point */}
				<line
					x1={x(PERF.length - 1)}
					x2={x(PERF.length - 1)}
					y1={pad.t}
					y2={h - pad.b}
					stroke="var(--sm-line-strong)"
					strokeDasharray="2 3"
				/>
				<circle
					cx={x(PERF.length - 1)}
					cy={y(PERF[PERF.length - 1].won)}
					r="5"
					fill="var(--sm-sienna)"
					stroke="var(--sm-panel)"
					strokeWidth="2.5"
				/>
				{/* x labels */}
				{PERF.map((p, i) => (
					<text
						key={p.m}
						x={x(i)}
						y={h - 8}
						fontSize="11"
						fill="var(--sm-ink-3)"
						textAnchor="middle"
					>
						{p.m}
					</text>
				))}
				{/* y labels */}
				{["$500K", "$250K", "$0K"].map((t, i) => (
					<text
						key={t}
						x={pad.l - 8}
						y={pad.t + i * ((h - pad.t - pad.b) / 2) + 4}
						fontSize="10"
						fill="var(--sm-ink-3)"
						textAnchor="end"
					>
						{t}
					</text>
				))}
			</svg>
			<div className="mock-sm__legend">
				<span className="mock-sm__legend-item">
					<span className="mock-sm__legend-swatch mock-sm__legend-swatch--won" />
					Won
				</span>
				<span className="mock-sm__legend-item">
					<span className="mock-sm__legend-swatch mock-sm__legend-swatch--lost" />
					Lost
				</span>
			</div>
		</section>
	);
}

function QuotaCard() {
	return (
		<section className="mock-sm__card mock-sm__card--quota">
			<CardHead title="Quota Attainment" sub="Year to date" icon={<Target />} />
			<div className="mock-sm__quota-head">
				<p className="mock-sm__stat-label mock-sm__quota-head-label">
					Achieved
				</p>
			</div>
			<div className="mock-sm__quota-head-row">
				<span className="mock-sm__quota-achieved tw-tnum">$1,245,800</span>
				<span className="mock-sm__quota-trend">
					<TrendingUp /> 87%
				</span>
			</div>
			<div className="mock-sm__quotabars">
				{QUOTA.map((q) => (
					<div className="mock-sm__quotabars-col" key={q.label}>
						<div
							className={`mock-sm__quotabar ${q.cls}`}
							style={{ height: q.barH }}
						/>
						<div className="mock-sm__quotabar-label">{q.label}</div>
						<div className="mock-sm__quotabar-value">{q.value}</div>
					</div>
				))}
			</div>
		</section>
	);
}

/* ---------- Main export ---------- */

export function SalesMateProMock() {
	return (
		<div className="mock-sm" aria-label="SalesMate Pro dashboard mock">
			<TopBar />
			<div className="mock-sm__body">
				<Sidebar />
				<main className="mock-sm__main">
					<header className="mock-sm__header">
						<div>
							<h2>Sales Overview</h2>
							<p>Your sales performance dashboard at a glance.</p>
						</div>
						<button type="button" className="mock-sm__newdeal">
							+ New Deal
						</button>
					</header>
					<div className="mock-sm__grid">
						<RevenueCard />
						<PipelineCard />
						<ActionItemsCard />
						<PerformanceCard />
						<QuotaCard />
					</div>
				</main>
			</div>
		</div>
	);
}
