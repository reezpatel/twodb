import { useState, useRef, useEffect } from "react";
import { Avatar } from "@twodb/ui";
import {
	BookOpen,
	Building2,
	File,
	FolderOpen,
	Hash,
	MessageSquare,
	Plus,
	Search,
	Sparkles,
	SquarePlus,
	UserPlus,
} from "lucide-react";
import "./QuickLauncher.css";

/* ---------- Types ---------- */

interface RecentItem {
	id: string;
	type: "project";
	name: string;
	members: string[];
}

interface CommandItem {
	id: string;
	type: "command";
	icon: React.ReactNode;
	label: string;
	shortcut?: string[];
	action?: string;
	separator?: boolean;
}

/* ---------- Data ---------- */

const RECENT_ITEMS: RecentItem[] = [
	{
		id: "r1",
		type: "project",
		name: "Sisyphus Ventures Logo Design",
		members: ["Olivia Rhye", "Phoenix Baker", "Lana Steiner"],
	},
	{
		id: "r2",
		type: "project",
		name: "Sisyphus Ventures Marketing Site",
		members: ["Olivia Rhye", "Phoenix Baker", "Lana Steiner", "Demi Wilkinson"],
	},
];

const COMMAND_ITEMS: CommandItem[] = [
	{
		id: "c1",
		type: "command",
		icon: <Hash size={16} />,
		label: "Add tag",
		shortcut: ["⌘", "T"],
	},
	{
		id: "c2",
		type: "command",
		icon: <SquarePlus size={16} />,
		label: "Create new project",
		shortcut: ["⌘", "⇧", "N"],
	},
	{
		id: "c3",
		type: "command",
		icon: <UserPlus size={16} />,
		label: "Assign to...",
		shortcut: ["⌘", "A"],
		separator: true,
	},
	{
		id: "c4",
		type: "command",
		icon: <MessageSquare size={16} />,
		label: "Send new message",
		shortcut: ["⌘", "M"],
		action: "Sign in to Slack",
	},
	{
		id: "c5",
		type: "command",
		icon: <File size={16} />,
		label: "Create new file",
		shortcut: ["⌘", "N"],
	},
	{
		id: "c6",
		type: "command",
		icon: <Plus size={16} />,
		label: "Create new project",
		shortcut: ["⌘", "⇧", "N"],
	},
	{
		id: "c7",
		type: "command",
		icon: <Building2 size={16} />,
		label: "Company profile",
		shortcut: ["⌘", "K", "→", "C"],
	},
	{
		id: "c8",
		type: "command",
		icon: <BookOpen size={16} />,
		label: "Documentation",
		shortcut: ["⌘", "?"],
	},
	{
		id: "c9",
		type: "command",
		icon: <Sparkles size={16} />,
		label: "Changelog",
		shortcut: ["⌘", "C"],
	},
];

/* ---------- Keyboard Shortcut Component ---------- */

function Kbd({ keys }: { keys: string[] }) {
	return (
		<span className="mock-ql__kbd">
			{keys.map((key, idx) => (
				<kbd key={idx}>{key}</kbd>
			))}
		</span>
	);
}

/* ---------- Avatar Stack ---------- */

function AvatarStack({ names }: { names: string[] }) {
	const display = names.slice(0, 3);
	return (
		<div className="mock-ql__avatars">
			{display.map((name, idx) => (
				<Avatar key={idx} name={name} size="sm" />
			))}
		</div>
	);
}

/* ---------- Main Component ---------- */

export function QuickLauncherMock() {
	const [query, setQuery] = useState("");
	const [selectedIdx, setSelectedIdx] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	// Filter based on query
	const filteredRecent = RECENT_ITEMS.filter((item) =>
		item.name.toLowerCase().includes(query.toLowerCase()),
	);
	const filteredCommands = COMMAND_ITEMS.filter((item) =>
		item.label.toLowerCase().includes(query.toLowerCase()),
	);

	const hasResults = filteredRecent.length > 0 || filteredCommands.length > 0;

	// Reset selection when query changes
	useEffect(() => {
		setSelectedIdx(0);
	}, [query]);

	// Keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		const totalItems = filteredRecent.length + filteredCommands.length;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIdx((prev) => (prev + 1) % totalItems);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIdx((prev) => (prev - 1 + totalItems) % totalItems);
		}
	};

	return (
		<div className="mock-ql__backdrop">
			<div
				className="mock-ql__dialog"
				role="dialog"
				aria-label="Command palette"
			>
				{/* Search Input */}
				<div className="mock-ql__search">
					<Search size={18} aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						placeholder="Type a command or search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						aria-label="Search commands"
					/>
					<Kbd keys={["⌘", "/"]} />
				</div>

				{/* Results */}
				<div className="mock-ql__results">
					{/* Recent Searches */}
					{filteredRecent.length > 0 && (
						<div className="mock-ql__section">
							<div className="mock-ql__section-header">
								<span className="mock-ql__section-title">Recent searches</span>
								<button className="mock-ql__customize">Customize</button>
							</div>
							{filteredRecent.map((item, idx) => (
								<div
									key={item.id}
									className={`mock-ql__item mock-ql__item--project ${
										selectedIdx === idx ? "is-selected" : ""
									}`}
								>
									<FolderOpen size={16} aria-hidden="true" />
									<span className="mock-ql__item-label">{item.name}</span>
									<AvatarStack names={item.members} />
									<button className="mock-ql__jump">Jump to...</button>
								</div>
							))}
						</div>
					)}

					{/* Commands */}
					{filteredCommands.length > 0 && (
						<div className="mock-ql__section">
							{filteredCommands.map((item, idx) => {
								const itemIdx = filteredRecent.length + idx;
								return (
									<div key={item.id}>
										{item.separator && <div className="mock-ql__separator" />}
										<div
											className={`mock-ql__item ${
												selectedIdx === itemIdx ? "is-selected" : ""
											}`}
										>
											<span className="mock-ql__item-icon">{item.icon}</span>
											<span className="mock-ql__item-label">{item.label}</span>
											{item.action && (
												<button className="mock-ql__action">
													{item.action}
												</button>
											)}
											{item.shortcut && <Kbd keys={item.shortcut} />}
										</div>
									</div>
								);
							})}
						</div>
					)}

					{/* No Results */}
					{!hasResults && query && (
						<div className="mock-ql__empty">No results for "{query}"</div>
					)}
				</div>

				{/* Footer */}
				<div className="mock-ql__footer">
					<span className="mock-ql__hint">
						<kbd>#</kbd> tags
					</span>
					<span className="mock-ql__hint">
						<kbd>↑</kbd> <kbd>↓</kbd> navigate
					</span>
					<span className="mock-ql__hint">
						<kbd>↵</kbd> open
					</span>
					<span className="mock-ql__hint">
						<kbd>esc</kbd> close
					</span>
					<span className="mock-ql__hint">
						<kbd>←</kbd> parent
					</span>
				</div>
			</div>
		</div>
	);
}
