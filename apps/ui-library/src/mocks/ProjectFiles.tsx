import { useMemo, useState } from "react";
import {
	Avatar,
	Button,
	Checkbox,
	IconButton,
	SearchInput,
	Select,
	Tabs,
} from "@twodb/ui";
import {
	Cloud,
	File,
	FileImage,
	FileSpreadsheet,
	FileText,
	Folder,
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
import "./ProjectFiles.css";

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
	size: string;
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
	{ name: "Service_agreement.pdf", type: "pdf", size: "1.8 MB", opened: "10 min ago", owner: "Asha Verma", folder: "Contracts & Legal" },
	{ name: "Lab_panel_Meera-Iyer.pdf", type: "pdf", size: "640 KB", opened: "12 min ago", owner: "Meera Iyer", folder: "Lab Reports" },
	{ name: "Invoice_1042.pdf", type: "pdf", size: "220 KB", opened: "2 min ago", owner: "Dev Patel", folder: "Invoices" },
	{ name: "Consent_Sana-Sheikh.docx", type: "doc", size: "96 KB", opened: "30 min ago", owner: "Ravi Kumar", folder: "Consent Forms" },
	{ name: "Discharge_Ravi-Kumar.docx", type: "doc", size: "104 KB", opened: "1 hour ago", owner: "Asha Verma", folder: "Consent Forms" },
	{ name: "Stock_March.xlsx", type: "sheet", size: "1.2 MB", opened: "2 hours ago", owner: "Dev Patel", folder: "Invoices" },
	{ name: "Supplier_quote_gauze.xlsx", type: "sheet", size: "84 KB", opened: "Jan 28, 2026", owner: "Dev Patel", folder: "Invoices" },
	{ name: "Lab_panel_Rao.pdf", type: "pdf", size: "588 KB", opened: "Jan 25, 2026", owner: "Meera Iyer", folder: "Lab Reports" },
	{ name: "Waiting_room_poster.png", type: "image", size: "3.4 MB", opened: "Jan 25, 2026", owner: "Ravi Kumar", folder: "Contracts & Legal" },
	{ name: "Clinic_floorplan.png", type: "image", size: "5.1 MB", opened: "Jan 15, 2026", owner: "Asha Verma", folder: "Contracts & Legal" },
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
					? `mock-pf__ficon mock-pf__ficon--sm is-${meta.cls}`
					: `mock-pf__ficon is-${meta.cls}`
			}
		>
			<Icon aria-hidden="true" />
		</span>
	);
}

export function ProjectFilesMock() {
	const [folder, setFolder] = useState<string | null>(null);
	const [typeTab, setTypeTab] = useState("all");
	const [query, setQuery] = useState("");
	const [view, setView] = useState<"list" | "grid">("list");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [sideType, setSideType] = useState("all");

	const rows = useMemo(
		() =>
			FILES.filter((f) => {
				if (folder && f.folder !== folder) return false;
				if (typeTab !== "all" && TYPE_META[f.type].label !== typeTab) return false;
				if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false;
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
		<div className="mock-pf">
			{/* left rail */}
			<aside className="mock-pf__rail">
				<div className="mock-pf__brand">
					<Avatar name="City Clinic" size="sm" />
					<strong>City Clinic</strong>
				</div>
				<nav className="mock-pf__nav" aria-label="Main menu">
					<span className="mock-pf__navlabel">Main menu</span>
					{NAV.map((n) => (
						<span
							className={n.active ? "mock-pf__navitem is-active" : "mock-pf__navitem"}
							key={n.label}
						>
							<n.icon aria-hidden="true" />
							{n.label}
						</span>
					))}
					<div className="mock-pf__subnav">
						{FOLDERS.map((f) => (
							<button
								className={folder === f.name ? "mock-pf__subitem is-active" : "mock-pf__subitem"}
								key={f.name}
								onClick={() => setFolder(folder === f.name ? null : f.name)}
							>
								{f.name}
							</button>
						))}
						<button className="mock-pf__subitem mock-pf__subitem--add">
							<Plus aria-hidden="true" /> Add new folder
						</button>
					</div>
				</nav>

				<div className="mock-pf__storage">
					<Cloud aria-hidden="true" />
					<strong>Storage</strong>
					<span>78.5 GB of 100 GB used</span>
					<div className="mock-pf__meter">
						<i style={{ width: "78%" }} />
					</div>
					<Button variant="primary" size="sm">
						Upgrade
					</Button>
				</div>

				<div className="mock-pf__user">
					<Avatar name="Asha Verma" size="sm" />
					<div>
						<strong>Asha Verma</strong>
						<span>Clinic admin</span>
					</div>
				</div>
			</aside>

			{/* center */}
			<main className="mock-pf__main">
				<header className="mock-pf__head">
					<div>
						<span className="mock-pf__crumb">Dashboard / Project Files</span>
						<h2>Project Files</h2>
					</div>
					<Button variant="primary" size="sm">
						<Upload aria-hidden="true" /> Upload file
					</Button>
				</header>

				{/* folder cards */}
				<div className="mock-pf__folders">
					{FOLDERS.map((f) => (
						<button
							className={folder === f.name ? "mock-pf__folder is-active" : "mock-pf__folder"}
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
				<h3 className="mock-pf__sect">Recent files</h3>
				<div className="mock-pf__recent">
					{RECENT.map((f) => (
						<div className="mock-pf__chip" key={f.name}>
							<FileIcon type={f.type} size="sm" />
							<div>
								<strong>{f.name}</strong>
								<span>{f.opened}</span>
							</div>
						</div>
					))}
				</div>

				{/* all files */}
				<div className="mock-pf__allhead">
					<h3 className="mock-pf__sect">All files</h3>
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
					<div className="mock-pf__viewtoggle">
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
					<div className="mock-pf__tablewrap">
						<table className="mock-pf__table">
							<thead>
								<tr>
									<th className="mock-pf__check" />
									<th>Filename</th>
									<th>Last opened</th>
									<th>Owner</th>
									<th>Location</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{rows.map((f) => (
									<tr key={f.name} className={selected.has(f.name) ? "is-selected" : ""}>
										<td className="mock-pf__check">
											<Checkbox
												checked={selected.has(f.name)}
												onChange={() => toggle(f.name)}
												aria-label={`Select ${f.name}`}
											/>
										</td>
										<td>
											<span className="mock-pf__fname">
												<FileIcon type={f.type} size="sm" />
												{f.name}
											</span>
										</td>
										<td className="mock-pf__muted">{f.opened}</td>
										<td>
											<span className="mock-pf__owner">
												<Avatar name={f.owner} size="sm" />
												{f.owner}
											</span>
										</td>
										<td>
											<code className="mock-pf__loc">
												/{f.folder.toLowerCase().replace(/ & | /g, "-")}
											</code>
										</td>
										<td className="mock-pf__rowact">
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
										<td colSpan={6} className="mock-pf__empty">
											No files match these filters.
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
						<div className="mock-pf__foot">
							<span>
								{selected.size} of {rows.length} row(s) selected.
							</span>
							<span className="mock-pf__page">Page 1 of 1</span>
						</div>
					</div>
				) : (
					<div className="mock-pf__grid">
						{rows.map((f) => (
							<button
								className={selected.has(f.name) ? "mock-pf__card is-selected" : "mock-pf__card"}
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
							<p className="mock-pf__empty">No files match these filters.</p>
						) : null}
					</div>
				)}
			</main>

			{/* right panel — the reference's Files sidebar */}
			<aside className="mock-pf__side">
				<div className="mock-pf__sidehead">
					<h3>Files</h3>
					<IconButton icon={<MoreHorizontal />} label="Panel options" variant="ghost" size="sm" />
				</div>
				<Select
					aria-label="Filter panel by type"
					options={[
						{ value: "all", label: "All types" },
						{ value: "PDF", label: "PDFs" },
						{ value: "Document", label: "Documents" },
						{ value: "Spreadsheet", label: "Spreadsheets" },
						{ value: "Image", label: "Images" },
					]}
					value={sideType}
					onValueChange={setSideType}
				/>

				<div className="mock-pf__sidefolders">
					{FOLDERS.map((f) => (
						<button
							className={folder === f.name ? "mock-pf__tile is-active" : "mock-pf__tile"}
							key={f.name}
							onClick={() => setFolder(folder === f.name ? null : f.name)}
							aria-pressed={folder === f.name}
						>
							<Folder aria-hidden="true" />
							<strong>{f.name}</strong>
							<span>{f.files} files</span>
						</button>
					))}
				</div>

				<h4 className="mock-pf__sidesect">Recent files</h4>
				<div className="mock-pf__sidelist">
					{FILES.filter((f) => sideType === "all" || TYPE_META[f.type].label === sideType)
						.slice(0, 5)
						.map((f) => (
							<button
								className={selected.has(f.name) ? "mock-pf__siderow is-selected" : "mock-pf__siderow"}
								key={f.name}
								onClick={() => toggle(f.name)}
								title={selected.has(f.name) ? "Selected — click to deselect" : "Click to select in the list"}
							>
								<FileIcon type={f.type} />
								<div>
									<strong>{f.name}</strong>
									<span>
										{f.size} · {f.opened}
									</span>
								</div>
							</button>
						))}
				</div>
			</aside>
		</div>
	);
}
