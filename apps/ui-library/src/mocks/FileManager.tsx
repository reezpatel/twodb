import { useMemo, useState } from "react";
import {
	Avatar,
	Button,
	Checkbox,
	IconButton,
	SearchInput,
	Tabs,
} from "@twodb/ui";
import {
	Cloud,
	File,
	FileImage,
	FileSpreadsheet,
	FileText,
	FolderOpen,
	LayoutGrid,
	LayoutDashboard,
	List,
	MoreHorizontal,
	Plus,
	Settings,
	Upload,
	Users,
} from "lucide-react";
import "./FileManager.css";

/* ---------- data ---------- */

const FOLDERS = [
	{ name: "Contracts & Legal", files: 24, size: "1.2 GB" },
	{ name: "Invoices", files: 12, size: "4 MB" },
	{ name: "Lab Reports", files: 45, size: "2.8 GB" },
	{ name: "Consent Forms", files: 18, size: "640 MB" },
];

type FileType = "pdf" | "doc" | "sheet" | "image";

interface FileRow {
	name: string;
	type: FileType;
	opened: string;
	owner: string;
	folder: string;
}

const TYPE_META: Record<
	FileType,
	{ label: string; icon: typeof File; cls: string }
> = {
	pdf: { label: "PDF", icon: File, cls: "pdf" },
	doc: { label: "Document", icon: FileText, cls: "doc" },
	sheet: { label: "Spreadsheet", icon: FileSpreadsheet, cls: "sheet" },
	image: { label: "Image", icon: FileImage, cls: "image" },
};

const FILES: FileRow[] = [
	{
		name: "Service_agreement.pdf",
		type: "pdf",
		opened: "10 min ago",
		owner: "Asha Verma",
		folder: "Contracts & Legal",
	},
	{
		name: "Lab_panel_Meera-Iyer.pdf",
		type: "pdf",
		opened: "12 min ago",
		owner: "Meera Iyer",
		folder: "Lab Reports",
	},
	{
		name: "Invoice_1042.pdf",
		type: "pdf",
		opened: "2 min ago",
		owner: "Dev Patel",
		folder: "Invoices",
	},
	{
		name: "Consent_Sana-Sheikh.docx",
		type: "doc",
		opened: "30 min ago",
		owner: "Ravi Kumar",
		folder: "Consent Forms",
	},
	{
		name: "Discharge_Ravi-Kumar.docx",
		type: "doc",
		opened: "1 hour ago",
		owner: "Asha Verma",
		folder: "Consent Forms",
	},
	{
		name: "Stock_March.xlsx",
		type: "sheet",
		opened: "2 hours ago",
		owner: "Dev Patel",
		folder: "Invoices",
	},
	{
		name: "Supplier_quote_gauze.xlsx",
		type: "sheet",
		opened: "Jan 28, 2026",
		owner: "Dev Patel",
		folder: "Invoices",
	},
	{
		name: "Lab_panel_Rao.pdf",
		type: "pdf",
		opened: "Jan 25, 2026",
		owner: "Meera Iyer",
		folder: "Lab Reports",
	},
	{
		name: "Waiting_room_poster.png",
		type: "image",
		opened: "Jan 25, 2026",
		owner: "Ravi Kumar",
		folder: "Contracts & Legal",
	},
	{
		name: "Clinic_floorplan.png",
		type: "image",
		opened: "Jan 15, 2026",
		owner: "Asha Verma",
		folder: "Contracts & Legal",
	},
];

const RECENT = FILES.slice(0, 4);

const NAV = [
	{ icon: LayoutDashboard, label: "Dashboard" },
	{ icon: Users, label: "Patients" },
	{ icon: FolderOpen, label: "Project Files", active: true },
	{ icon: Settings, label: "Settings" },
];

function FileIcon({ type, size }: { type: FileType; size?: "sm" }) {
	const meta = TYPE_META[type];
	const Icon = meta.icon;
	return (
		<span
			className={
				size === "sm"
					? `mock-fm__ficon mock-fm__ficon--sm is-${meta.cls}`
					: `mock-fm__ficon is-${meta.cls}`
			}
		>
			<Icon aria-hidden="true" />
		</span>
	);
}

export function FileManagerMock() {
	const [folder, setFolder] = useState<string | null>(null);
	const [typeTab, setTypeTab] = useState("all");
	const [query, setQuery] = useState("");
	const [view, setView] = useState<"list" | "grid">("list");
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const rows = useMemo(
		() =>
			FILES.filter((f) => {
				if (folder && f.folder !== folder) return false;
				if (typeTab !== "all" && TYPE_META[f.type].label !== typeTab)
					return false;
				if (query && !f.name.toLowerCase().includes(query.toLowerCase()))
					return false;
				return true;
			}),
		[folder, typeTab, query],
	);

	const toggle = (name: string) =>
		setSelected((s) => {
			const n = new Set(s);
			if (n.has(name)) n.delete(name);
			else n.add(name);
			return n;
		});

	return (
		<div className="mock-fm">
			{/* left rail */}
			<aside className="mock-fm__rail">
				<div className="mock-fm__brand">
					<Avatar name="City Clinic" size="sm" />
					<strong>City Clinic</strong>
				</div>
				<nav className="mock-fm__nav" aria-label="Main menu">
					<span className="mock-fm__navlabel">Main menu</span>
					{NAV.map((n) => (
						<span
							className={
								n.active ? "mock-fm__navitem is-active" : "mock-fm__navitem"
							}
							key={n.label}
						>
							<n.icon aria-hidden="true" />
							{n.label}
						</span>
					))}
					<div className="mock-fm__subnav">
						{FOLDERS.map((f) => (
							<button
								className={
									folder === f.name
										? "mock-fm__subitem is-active"
										: "mock-fm__subitem"
								}
								key={f.name}
								onClick={() => setFolder(folder === f.name ? null : f.name)}
							>
								{f.name}
							</button>
						))}
						<button className="mock-fm__subitem mock-fm__subitem--add">
							<Plus aria-hidden="true" /> Add new folder
						</button>
					</div>
				</nav>

				<div className="mock-fm__storage">
					<Cloud aria-hidden="true" />
					<strong>Storage</strong>
					<span>78.5 GB of 100 GB used</span>
					<div className="mock-fm__meter">
						<i style={{ width: "78%" }} />
					</div>
					<Button variant="primary" size="sm">
						Upgrade
					</Button>
				</div>

				<div className="mock-fm__user">
					<Avatar name="Asha Verma" size="sm" />
					<div>
						<strong>Asha Verma</strong>
						<span>Clinic admin</span>
					</div>
				</div>
			</aside>

			{/* center */}
			<main className="mock-fm__main">
				<header className="mock-fm__head">
					<div>
						<span className="mock-fm__crumb">Dashboard / Project Files</span>
						<h2>Project Files</h2>
					</div>
					<Button variant="primary" size="sm">
						<Upload aria-hidden="true" /> Upload file
					</Button>
				</header>

				{/* folder cards */}
				<div className="mock-fm__folders">
					{FOLDERS.map((f) => (
						<button
							className={
								folder === f.name
									? "mock-fm__folder is-active"
									: "mock-fm__folder"
							}
							key={f.name}
							onClick={() => setFolder(folder === f.name ? null : f.name)}
							aria-pressed={folder === f.name}
						>
							<FolderOpen aria-hidden="true" />
							<strong>{f.name}</strong>
							<span>
								{f.files} files · {f.size}
							</span>
						</button>
					))}
				</div>

				{/* recent */}
				<h3 className="mock-fm__sect">Recent files</h3>
				<div className="mock-fm__recent">
					{RECENT.map((f) => (
						<div className="mock-fm__chip" key={f.name}>
							<FileIcon type={f.type} size="sm" />
							<div>
								<strong>{f.name}</strong>
								<span>{f.opened}</span>
							</div>
						</div>
					))}
				</div>

				{/* all files */}
				<div className="mock-fm__allhead">
					<h3 className="mock-fm__sect">All files</h3>
					<Tabs
						aria-label="Filter by type"
						items={[
							{ id: "all", label: "View all" },
							{ id: "Document", label: "Documents" },
							{ id: "Spreadsheet", label: "Spreadsheets" },
							{ id: "PDF", label: "PDFs" },
							{ id: "Image", label: "Images" },
						]}
						value={typeTab}
						onValueChange={setTypeTab}
					/>
					<SearchInput
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search files…"
						aria-label="Search files"
					/>
					<div className="mock-fm__viewtoggle">
						<IconButton
							icon={<LayoutGrid />}
							label="Grid view"
							variant={view === "grid" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setView("grid")}
						/>
						<IconButton
							icon={<List />}
							label="List view"
							variant={view === "list" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setView("list")}
						/>
					</div>
				</div>

				{view === "list" ? (
					<div className="mock-fm__tablewrap">
						<table className="mock-fm__table">
							<thead>
								<tr>
									<th className="mock-fm__check" />
									<th>Filename</th>
									<th>Last opened</th>
									<th>Owner</th>
									<th>Location</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{rows.map((f) => (
									<tr
										key={f.name}
										className={selected.has(f.name) ? "is-selected" : ""}
									>
										<td className="mock-fm__check">
											<Checkbox
												checked={selected.has(f.name)}
												onChange={() => toggle(f.name)}
												aria-label={`Select ${f.name}`}
											/>
										</td>
										<td>
											<span className="mock-fm__fname">
												<FileIcon type={f.type} size="sm" />
												{f.name}
											</span>
										</td>
										<td className="mock-fm__muted">{f.opened}</td>
										<td>
											<span className="mock-fm__owner">
												<Avatar name={f.owner} size="sm" />
												{f.owner}
											</span>
										</td>
										<td>
											<code className="mock-fm__loc">
												/{f.folder.toLowerCase().replace(/ & | /g, "-")}
											</code>
										</td>
										<td className="mock-fm__rowact">
											<IconButton
												icon={<MoreHorizontal />}
												label={`Actions for ${f.name}`}
												variant="ghost"
												size="sm"
											/>
										</td>
									</tr>
								))}
								{!rows.length ? (
									<tr>
										<td colSpan={6} className="mock-fm__empty">
											No files match these filters.
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
						<div className="mock-fm__foot">
							<span>
								{selected.size} of {rows.length} row(s) selected.
							</span>
							<span className="mock-fm__page">Page 1 of 1</span>
						</div>
					</div>
				) : (
					<div className="mock-fm__grid">
						{rows.map((f) => (
							<button
								className={
									selected.has(f.name)
										? "mock-fm__card is-selected"
										: "mock-fm__card"
								}
								key={f.name}
								onClick={() => toggle(f.name)}
							>
								<FileIcon type={f.type} />
								<strong>{f.name}</strong>
								<span>
									{f.opened} · {f.owner}
								</span>
							</button>
						))}
						{!rows.length ? (
							<p className="mock-fm__empty">No files match these filters.</p>
						) : null}
					</div>
				)}
			</main>
		</div>
	);
}
