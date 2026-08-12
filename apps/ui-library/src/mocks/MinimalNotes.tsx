import { useState } from "react";
import { Button, MarkdownEditor } from "@twodb/ui";
import {
	ChevronDown,
	ChevronRight,
	Check,
	Clock,
	FileText,
	Folder,
	Inbox,
	ListTodo,
	Share2,
	Star,
	Trash2,
} from "lucide-react";
import "./MinimalNotes.css";

const DEFAULT_DOC = [
	"# Building a minimalist text editor",
	"",
	"The goal is to create an interface that gets out of the way. We want the user to focus entirely on their words.",
	"",
	"## Key features",
	"",
	"- Markdown support",
	"- Fast search",
	"- Local first",
	"- Customizable themes",
	"",
	"## Design principles",
	"",
	"1. Less is more",
	"2. Typography matters",
	"3. Speed is a feature",
].join("\n");

const PRIMARY = [
	{ id: "notes", label: "Notes", icon: FileText },
	{ id: "tasks", label: "Tasks", icon: ListTodo },
	{ id: "files", label: "Files", icon: Folder },
];

const VIEWS = [
	{ id: "all", label: "All", icon: Inbox },
	{ id: "recents", label: "Recents", icon: Clock },
	{ id: "starred", label: "Starred", icon: Star },
	{ id: "deleted", label: "Deleted", icon: Trash2 },
];

const FOLDERS = [
	{ id: "work", label: "Work" },
	{ id: "personal", label: "Personal" },
	{ id: "projects", label: "Projects" },
];

function countWords(md: string): number {
	const text = md
		.replace(/^#+\s*/gm, "")
		.replace(/^[-*]\s+/gm, "")
		.replace(/^\d+\.\s+/gm, "")
		.replace(/[*_`>~]/g, "");
	return text.trim().split(/\s+/).filter(Boolean).length;
}

export function MinimalNotesMock() {
	const [active, setActive] = useState("notes");
	const [foldersOpen, setFoldersOpen] = useState(true);
	const [folder, setFolder] = useState<string | null>(null);
	const [words, setWords] = useState(() => countWords(DEFAULT_DOC));

	return (
		<div className="mock-mn">
			{/* macOS titlebar */}
			<div className="mock-mn__bar">
				<span className="mock-mn__lights" aria-hidden="true">
					<i className="mock-mn__light mock-mn__light--close" />
					<i className="mock-mn__light mock-mn__light--min" />
					<i className="mock-mn__light mock-mn__light--max" />
				</span>
			</div>

			<div className="mock-mn__body">
				{/* sidebar */}
				<aside className="mock-mn__side">
					<nav className="mock-mn__nav" aria-label="Library">
						{PRIMARY.map((n) => (
							<button
								className={
									"mock-mn__item" + (active === n.id ? " is-active" : "")
								}
								type="button"
								key={n.id}
								onClick={() => setActive(n.id)}
							>
								<n.icon aria-hidden="true" />
								{n.label}
							</button>
						))}
					</nav>

					<div className="mock-mn__views">
						{VIEWS.map((n) => (
							<button
								className={
									"mock-mn__item mock-mn__item--muted" +
									(active === n.id ? " is-active" : "")
								}
								type="button"
								key={n.id}
								onClick={() => setActive(n.id)}
							>
								<n.icon aria-hidden="true" />
								{n.label}
							</button>
						))}
					</div>

					<div className="mock-mn__folders">
						<button
							className="mock-mn__cue"
							type="button"
							onClick={() => setFoldersOpen((o) => !o)}
							aria-expanded={foldersOpen}
						>
							{foldersOpen ? (
								<ChevronDown aria-hidden="true" />
							) : (
								<ChevronRight aria-hidden="true" />
							)}
							Folders
						</button>
						{foldersOpen ? (
							<div className="mock-mn__folderlist">
								{FOLDERS.map((f) => (
									<button
										className={
											"mock-mn__item mock-mn__item--muted" +
											(folder === f.id ? " is-active" : "")
										}
										type="button"
										key={f.id}
										onClick={() =>
											setFolder((cur) => (cur === f.id ? null : f.id))
										}
									>
										<Folder aria-hidden="true" />
										{f.label}
									</button>
								))}
							</div>
						) : null}
					</div>
				</aside>

				{/* main: editor */}
				<main className="mock-mn__main">
					<header className="mock-mn__head">
						<Button variant="secondary" size="sm">
							<Share2 aria-hidden="true" /> Share
						</Button>
					</header>

					<div className="mock-mn__scroll">
						<div className="mock-mn__editor">
							<MarkdownEditor
								defaultValue={DEFAULT_DOC}
								hideToolbar
								minHeight={420}
								onChange={(md) => setWords(countWords(md))}
							/>
						</div>
					</div>
				</main>
			</div>

			{/* floating status pill */}
			<div className="mock-mn__pill" role="status">
				<span className="mock-mn__count">{words} words</span>
				<span className="mock-mn__pillsep" aria-hidden="true" />
				<span className="mock-mn__saved">
					<Check aria-hidden="true" /> Saved
				</span>
			</div>
		</div>
	);
}
