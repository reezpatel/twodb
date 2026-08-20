import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
	CalendarDays,
	Code2,
	FilePlus2,
	FileText,
	Files,
	Inbox,
	Mail,
	MessageCircle,
	Mic,
	Moon,
	Search,
	Sun,
	Workflow,
} from "lucide-react";
import { commandPaletteStyles } from "./command-palette.style";
import { useShellState } from "./state";

type PaletteItem = {
	id: string;
	icon: ReactNode;
	label: string;
	hint?: string[];
	run: () => void;
};

/* decorative tiles for the no-results state — scene initials on shell hues */
const EMPTY_ICONS = [
	{
		initials: "IN",
		color: "var(--shell-orange)",
		top: "16%",
		left: "14%",
		rot: -15,
	},
	{
		initials: "EM",
		color: "var(--shell-blue)",
		top: "22%",
		left: "34%",
		rot: 10,
	},
	{
		initials: "CA",
		color: "var(--shell-red)",
		top: "34%",
		left: "24%",
		rot: -8,
	},
	{
		initials: "FI",
		color: "var(--shell-amber)",
		top: "56%",
		left: "64%",
		rot: 12,
	},
	{
		initials: "CH",
		color: "var(--shell-purple)",
		top: "18%",
		left: "60%",
		rot: -10,
	},
	{
		initials: "CO",
		color: "var(--shell-green)",
		top: "44%",
		left: "76%",
		rot: 8,
	},
	{
		initials: "RE",
		color: "var(--shell-red)",
		top: "34%",
		left: "82%",
		rot: -12,
	},
	{
		initials: "AU",
		color: "var(--shell-blue)",
		top: "52%",
		left: "18%",
		rot: 15,
	},
];

export function CommandPalette() {
	const { notes, openNote, addNote, phase, togglePhase } = useShellState();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIdx, setSelectedIdx] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIdx(0);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	useEffect(() => setSelectedIdx(0), [query]);

	useEffect(() => {
		resultsRef.current
			?.querySelector(".is-selected")
			?.scrollIntoView({ block: "nearest" });
	}, [selectedIdx]);

	const close = () => setOpen(false);

	const items = useMemo<PaletteItem[]>(() => {
		const go = (route: string) => () => {
			navigate(route);
			close();
		};
		return [
			{
				id: "inbox",
				icon: <Inbox size={16} />,
				label: "Go to Inbox",
				run: go("/inbox"),
			},
			{
				id: "email",
				icon: <Mail size={16} />,
				label: "Go to Email",
				run: go("/email"),
			},
			{
				id: "calendar",
				icon: <CalendarDays size={16} />,
				label: "Go to Calendar",
				run: go("/calendar"),
			},
			{
				id: "files",
				icon: <Files size={16} />,
				label: "Go to Files",
				run: go("/files"),
			},
			{
				id: "automations",
				icon: <Workflow size={16} />,
				label: "Go to Automations",
				run: go("/automations"),
			},
			{
				id: "chat",
				icon: <MessageCircle size={16} />,
				label: "Go to Chat",
				run: go("/chat"),
			},
			{
				id: "code",
				icon: <Code2 size={16} />,
				label: "Go to Code",
				run: go("/code"),
			},
			{
				id: "notes",
				icon: <FileText size={16} />,
				label: "Go to Notes",
				run: go("/notes"),
			},
			{
				id: "recording",
				icon: <Mic size={16} />,
				label: "Go to Recording",
				run: go("/recording"),
			},
			{
				id: "new-note",
				icon: <FilePlus2 size={16} />,
				label: "Create new note",
				hint: ["⌘", "N"],
				run: () => {
					addNote();
					navigate("/inbox");
					close();
				},
			},
			{
				id: "phase",
				icon: phase === "day" ? <Moon size={16} /> : <Sun size={16} />,
				label: phase === "day" ? "Switch to night mode" : "Switch to day mode",
				hint: ["⌘", "⇧", "L"],
				run: () => {
					togglePhase();
					close();
				},
			},
		];
	}, [navigate, addNote, togglePhase, phase]);

	const recent = useMemo<PaletteItem[]>(
		() =>
			notes.slice(0, 3).map((n) => ({
				id: `note-${n.id}`,
				icon: <FileText size={16} />,
				label: n.title,
				run: () => {
					openNote(n.id);
					navigate("/notes");
					close();
				},
			})),
		[notes, openNote, navigate],
	);

	const q = query.trim().toLowerCase();
	const filteredRecent = recent.filter((i) =>
		i.label.toLowerCase().includes(q),
	);
	const filteredItems = items.filter((i) => i.label.toLowerCase().includes(q));
	const flat = [...filteredRecent, ...filteredItems];
	const showEmpty = q.length > 0 && flat.length === 0;

	const onInputKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown" && flat.length) {
			e.preventDefault();
			setSelectedIdx((v) => (v + 1) % flat.length);
		} else if (e.key === "ArrowUp" && flat.length) {
			e.preventDefault();
			setSelectedIdx((v) => (v - 1 + flat.length) % flat.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			flat[selectedIdx]?.run();
		} else if (e.key === "Escape") {
			close();
		}
	};

	if (!open) return null;

	return (
		<div className="shell__palette-backdrop" onMouseDown={close}>
			<style jsx>{commandPaletteStyles}</style>
			<div
				className="shell__palette"
				role="dialog"
				aria-modal="true"
				aria-label="Command palette"
				onMouseDown={(e) => e.stopPropagation()}
			>
				<div className="shell__palette-search">
					<Search size={18} aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						placeholder="Type a command or search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={onInputKeyDown}
						aria-label="Search commands"
					/>
					<span className="shell__palette-kbd">
						<kbd>⌘</kbd>
						<kbd>K</kbd>
					</span>
				</div>

				<div className="shell__palette-results" ref={resultsRef}>
					{showEmpty ? (
						<div className="shell__palette-empty">
							<div className="shell__palette-emptybg" aria-hidden="true">
								<i className="shell__palette-ripple shell__palette-ripple--1" />
								<i className="shell__palette-ripple shell__palette-ripple--2" />
								<i className="shell__palette-ripple shell__palette-ripple--3" />
								{EMPTY_ICONS.map((ic) => (
									<span
										className="shell__palette-appicon"
										key={ic.initials}
										style={{
											top: ic.top,
											left: ic.left,
											transform: `rotate(${ic.rot}deg)`,
										}}
									>
										<span
											className="shell__palette-appicon-bg"
											style={{ backgroundColor: ic.color }}
										>
											{ic.initials}
										</span>
									</span>
								))}
							</div>
							<div className="shell__palette-emptyicon">
								<Search size={24} aria-hidden="true" />
							</div>
							<h3 className="shell__palette-emptytitle">Sorry, no results!</h3>
							<p className="shell__palette-emptytext">
								We couldn't find any pages or commands for “{query}”.
							</p>
							<button
								type="button"
								className="shell__palette-clear"
								onClick={() => {
									setQuery("");
									inputRef.current?.focus();
								}}
							>
								Clear search
							</button>
						</div>
					) : (
						<>
							{filteredRecent.length > 0 ? (
								<div className="shell__palette-section">
									<span className="shell__palette-sectitle">Recent notes</span>
									{filteredRecent.map((item, idx) => (
										<button
											type="button"
											key={item.id}
											className={
												idx === selectedIdx
													? "shell__palette-item is-selected"
													: "shell__palette-item"
											}
											onMouseMove={() => setSelectedIdx(idx)}
											onClick={item.run}
										>
											<span className="shell__palette-itemicon">
												{item.icon}
											</span>
											<span className="shell__palette-itemlabel">
												{item.label}
											</span>
											{item.hint ? (
												<span className="shell__palette-kbd">
													{item.hint.map((k) => (
														<kbd key={k}>{k}</kbd>
													))}
												</span>
											) : null}
										</button>
									))}
								</div>
							) : null}
							{filteredItems.length > 0 ? (
								<div className="shell__palette-section">
									<span className="shell__palette-sectitle">Commands</span>
									{filteredItems.map((item, idx) => {
										const rowIdx = filteredRecent.length + idx;
										return (
											<button
												type="button"
												key={item.id}
												className={
													rowIdx === selectedIdx
														? "shell__palette-item is-selected"
														: "shell__palette-item"
												}
												onMouseMove={() => setSelectedIdx(rowIdx)}
												onClick={item.run}
											>
												<span className="shell__palette-itemicon">
													{item.icon}
												</span>
												<span className="shell__palette-itemlabel">
													{item.label}
												</span>
												{item.hint ? (
													<span className="shell__palette-kbd">
														{item.hint.map((k) => (
															<kbd key={k}>{k}</kbd>
														))}
													</span>
												) : null}
											</button>
										);
									})}
								</div>
							) : null}
						</>
					)}
				</div>

				{!showEmpty ? (
					<div className="shell__palette-footer">
						<span className="shell__palette-hint">
							<kbd>↑</kbd>
							<kbd>↓</kbd> navigate
						</span>
						<span className="shell__palette-hint">
							<kbd>↵</kbd> open
						</span>
						<span className="shell__palette-hint">
							<kbd>esc</kbd> close
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
}
