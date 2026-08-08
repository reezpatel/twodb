import { useState } from "react";
import { Badge, Button, IconButton, ScoreRing, Select, Tabs } from "@twodb/ui";
import { Bookmark, ChevronDown, ChevronRight, Share2 } from "lucide-react";

/* ---------- data ---------- */

interface Company {
	id: string;
	name: string;
	path: string;
	sector: string;
	score: number;
}

const COMPANIES: Company[] = [
	{
		id: "payverge",
		name: "Payverge",
		path: "Payments Dig · Merchant",
		sector: "Home Services",
		score: 12,
	},
	{
		id: "paylocity",
		name: "Paylocity",
		path: "Payments Dig · Fintech",
		sector: "Finance",
		score: 23,
	},
	{
		id: "flowtap",
		name: "Flowtap",
		path: "Payments Dig · Merchant",
		sector: "Food & Beverages",
		score: 43,
	},
	{
		id: "adyn",
		name: "Adyn",
		path: "Payments Dig · Merchant",
		sector: "Finance",
		score: 61,
	},
	{
		id: "granitek",
		name: "Granitek",
		path: "Payments Dig · Merchant",
		sector: "Construction",
		score: -28,
	},
	{
		id: "vitavera",
		name: "Vitavera",
		path: "Payments Dig · Merchant",
		sector: "Healthcare",
		score: 32,
	},
	{
		id: "veloura",
		name: "Veloura",
		path: "Streetwear fashion · Merchant",
		sector: "Fashion",
		score: 78,
	},
	{
		id: "forgebuilt",
		name: "ForgeBuilt",
		path: "Payments Dig · Merchant",
		sector: "Construction",
		score: 8,
	},
];

interface YearCell {
	pct: string;
	delta: string;
}

interface Customer {
	name: string;
	years: YearCell[];
	detail?: boolean;
}

const YEARS = ["2019", "2020", "2021", "2022", "2023"];

const CUSTOMERS: Customer[] = [
	{
		name: "Goldman Sachs Group",
		years: [
			{ pct: "22%", delta: "-0.21%" },
			{ pct: "3%", delta: "-0.50%" },
			{ pct: "12%", delta: "-0.28%" },
			{ pct: "15%", delta: "+0.55%" },
			{ pct: "16%", delta: "+0.06%" },
		],
	},
	{
		name: "Kimberly-Clark",
		detail: true,
		years: [
			{ pct: "14%", delta: "+0.21%" },
			{ pct: "11%", delta: "-0.28%" },
			{ pct: "7%", delta: "-0.28%" },
			{ pct: "9%", delta: "+0.21%" },
			{ pct: "13%", delta: "+0.41%" },
		],
	},
	{
		name: "J.B. Hunt Transport Services",
		years: [
			{ pct: "11%", delta: "-2.4%" },
			{ pct: "1.5%", delta: "+0.12%" },
			{ pct: "15%", delta: "+0.55%" },
			{ pct: "16%", delta: "+0.20%" },
			{ pct: "3%", delta: "+1.13%" },
		],
	},
	{
		name: "Constellation Brands",
		years: [
			{ pct: "8%", delta: "+0.50%" },
			{ pct: "6%", delta: "+0.55%" },
			{ pct: "12%", delta: "+0.53%" },
			{ pct: "4%", delta: "+0.06%" },
			{ pct: "9%", delta: "+3.64%" },
		],
	},
	{
		name: "Regions Financial Corporation",
		years: [
			{ pct: "4%", delta: "-2.33%" },
			{ pct: "3%", delta: "-0.28%" },
			{ pct: "7%", delta: "+4.26%" },
			{ pct: "8%", delta: "+1.23%" },
			{ pct: "16%", delta: "+6.22%" },
		],
	},
	{
		name: "Polaris Industries",
		years: [
			{ pct: "11%", delta: "-0.50%" },
			{ pct: "7%", delta: "-4.31%" },
			{ pct: "9%", delta: "+2.51%" },
			{ pct: "3%", delta: "+4.06%" },
			{ pct: "12%", delta: "+0.06%" },
		],
	},
];

const KPIS = [
	{ label: "Total amount", value: "$525,977" },
	{ label: "Open amount", value: "$7,237,530" },
	{ label: "V.A.T amount", value: "$149,973" },
	{ label: "Invoicing costs", value: "$963" },
];

const REVENUE_SEGMENTS = [
	{ tone: "var(--twdb-cobalt)", width: 18, label: "Product" },
	{ tone: "var(--twdb-rose)", width: 34, label: "Services" },
	{ tone: "var(--twdb-rose-light)", width: 28, label: "Licensing" },
	{ tone: "var(--twdb-dawn)", width: 20, label: "Other" },
];

const DETAILS: [string, string][] = [
	["Business name", "Paylocity"],
	["Business type", "LTD/PVT LTD"],
	["Company type", "Paylocity"],
	["Business country", "USA"],
	["Added by", "Benjamin Cooper"],
];

/* ---------- pieces ---------- */

function Delta({ value }: { value: string }) {
	const up = value.startsWith("+");
	return (
		<span
			className={up ? "mock-inv__delta mock-inv__delta--up" : "mock-inv__delta"}
		>
			{value}
		</span>
	);
}

function MetricCard({
	label,
	value,
	ring,
}: {
	label: string;
	value: string;
	ring?: number;
}) {
	return (
		<div className="mock-inv__metric">
			{ring !== undefined ? (
				<ScoreRing value={ring} size={40} stroke={4} />
			) : null}
			<div>
				<span className="mock-inv__metric-label tw-cue">{label}</span>
				<span className="mock-inv__metric-value tw-tnum">{value}</span>
			</div>
		</div>
	);
}

function CustomerDetail() {
	return (
		<div className="mock-inv__detail">
			<div className="mock-inv__kpis">
				{KPIS.map((k) => (
					<div key={k.label} className="mock-inv__kpi">
						<span className="mock-inv__kpi-value tw-tnum">{k.value}</span>
						<span className="mock-inv__kpi-label">{k.label}</span>
					</div>
				))}
			</div>

			<div className="mock-inv__revenue">
				<span className="mock-inv__kpi-title">Total revenue</span>
				<div
					className="mock-inv__bar"
					role="img"
					aria-label="Revenue split: product 18%, services 34%, licensing 28%, other 20%"
				>
					{REVENUE_SEGMENTS.map((s) => (
						<span
							key={s.label}
							style={{ background: s.tone, width: `${s.width}%` }}
						/>
					))}
				</div>
				<div className="mock-inv__legend">
					{REVENUE_SEGMENTS.map((s) => (
						<span key={s.label}>
							<i style={{ background: s.tone }} /> {s.label} · {s.width}%
						</span>
					))}
				</div>
			</div>

			<div className="mock-inv__details">
				<span className="mock-inv__kpi-title">Company details</span>
				<div className="mock-inv__details-grid">
					{DETAILS.map(([k, v]) => (
						<div key={k} className="mock-inv__detail-item">
							<span className="mock-inv__kpi-label">{k}</span>
							<span className="mock-inv__detail-value">{v}</span>
						</div>
					))}
					<div className="mock-inv__detail-item mock-inv__detail-item--wide">
						<span className="mock-inv__kpi-label">Business description</span>
						<span className="mock-inv__detail-value">
							Paylocity was established in 2008, and is primarily known for
							cloud-based payroll and human capital management (HCM) software
							solutions for businesses.
						</span>
					</div>
					<div className="mock-inv__detail-item mock-inv__detail-item--wide">
						<span className="mock-inv__kpi-label">Address</span>
						<span className="mock-inv__detail-value">
							Corporate Headquarters: 1400 American Lane, Schaumburg, IL 60173
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ---------- main ---------- */

export function InvestorDashboardMock() {
	const [companyId, setCompanyId] = useState("paylocity");
	const [tab, setTab] = useState("overview");
	const [expanded, setExpanded] = useState<string | null>("Kimberly-Clark");
	const [watched, setWatched] = useState(false);

	const company = COMPANIES.find((c) => c.id === companyId)!;

	return (
		<div className="mock-inv">
			{/* left: company list */}
			<aside className="mock-inv__list">
				<div className="mock-inv__list-tabs">
					<span className="mock-inv__list-tab mock-inv__list-tab--active">
						Listed <b className="tw-tnum">26</b>
					</span>
					<span className="mock-inv__list-tab">
						Sectors <b className="tw-tnum">43</b>
					</span>
				</div>
				<Select
					aria-label="Listing"
					defaultValue="all"
					options={[
						{ value: "all", label: "All listings" },
						{ value: "watchlist", label: "Watchlist" },
						{ value: "mine", label: "Added by me" },
					]}
				/>
				<div className="mock-inv__companies">
					{COMPANIES.map((c) => (
						<button
							key={c.id}
							type="button"
							className={
								c.id === companyId
									? "mock-inv__company mock-inv__company--active"
									: "mock-inv__company"
							}
							onClick={() => setCompanyId(c.id)}
						>
							<span className="mock-inv__company-path">{c.path}</span>
							<span className="mock-inv__company-name">{c.name}</span>
							<span className="mock-inv__company-foot">
								<Badge tone="neutral" size="sm">
									{c.sector}
								</Badge>
								<span className="mock-inv__company-score">
									<span className="tw-cue">Score</span>
									<b className="tw-tnum">{c.score}</b>
									<ScoreRing value={c.score} size={26} stroke={3} />
								</span>
							</span>
						</button>
					))}
				</div>
			</aside>

			{/* right: company detail */}
			<div className="mock-inv__main">
				<header className="mock-inv__head">
					<span className="mock-inv__logo">{company.name[0]}</span>
					<div className="mock-inv__head-text">
						<span className="mock-inv__company-path">
							{company.path} · Payment solutions
						</span>
						<h3>{company.name}</h3>
					</div>
					<div className="mock-inv__head-actions">
						<Button
							size="sm"
							variant={watched ? "primary" : "secondary"}
							onClick={() => setWatched((w) => !w)}
						>
							<Bookmark size={14} aria-hidden="true" />
							{watched ? "Watching" : "Watchlist"}
						</Button>
						<IconButton label="Share" icon={<Share2 />} variant="secondary" />
					</div>
				</header>

				<div className="mock-inv__metrics">
					<MetricCard
						label="Overall score"
						value={String(company.score)}
						ring={company.score}
					/>
					<MetricCard label="Revenue goal attainment" value="87%" ring={87} />
					<MetricCard label="Forecast this month" value="1.4M" ring={64} />
					<button
						type="button"
						className="mock-inv__metric mock-inv__metric--add"
					>
						+ Add segment
					</button>
				</div>

				<Tabs
					aria-label="Company views"
					value={tab}
					onValueChange={setTab}
					items={[
						{ id: "overview", label: "Overview" },
						{ id: "analyze", label: "Analyze" },
						{ id: "topics", label: "Topics" },
						{ id: "impressions", label: "Impressions" },
						{ id: "customers", label: "Customers" },
						{ id: "competitors", label: "Competitors" },
					]}
				/>

				{tab === "overview" ? (
					<div className="mock-inv__concentration">
						<span className="mock-inv__kpi-title">
							Customer concentration (% revenue)
						</span>
						<div className="tw-table-wrap">
							<div className="tw-table-scroll">
								<table className="tw-table">
									<thead className="tw-thead">
										<tr className="tw-tr">
											<th className="tw-th">Customer</th>
											{YEARS.map((y) => (
												<th key={y} className="tw-th tw-th--right tw-tnum">
													{y}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="tw-tbody">
										{CUSTOMERS.map((cust) => {
											const open = expanded === cust.name;
											return (
												<>
													<tr
														key={cust.name}
														className={
															open
																? "tw-tr mock-inv__row mock-inv__row--open"
																: "tw-tr mock-inv__row"
														}
														onClick={() => setExpanded(open ? null : cust.name)}
													>
														<td className="tw-td">
															<span className="mock-inv__cust">
																{open ? (
																	<ChevronDown size={14} />
																) : (
																	<ChevronRight size={14} />
																)}
																{cust.name}
															</span>
														</td>
														{cust.years.map((y, i) => (
															<td key={i} className="tw-td tw-td--right">
																<span className="tw-tnum">{y.pct}</span>{" "}
																<Delta value={y.delta} />
															</td>
														))}
													</tr>
													{open ? (
														<tr key={`${cust.name}-detail`} className="tw-tr">
															<td className="mock-inv__detail-cell" colSpan={6}>
																<CustomerDetail />
															</td>
														</tr>
													) : null}
												</>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				) : (
					<div className="mock-inv__empty">
						<p>
							The {tab} view fills in once a real data source is connected —
							this mock ships Overview.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
