/* Shell state — one context shared by every region of the frame (sidebar,
   note list, editor, properties panel, status bar). AppShell provides it;
   regions consume with useShellState(). Still mock-driven; as regions become
   plugin contribution points, their slices move onto the plugin bus. */

import {
	createContext,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { ESSAY_DOC, NOTES, doc } from "./data";
import type { Box, Doc, Note } from "./types";

let addedSeq = 0;

type ShellPhase = "day" | "night";

export interface ShellState {
	notes: Note[];
	box: Box;
	sideSel: string;
	phase: ShellPhase;
	query: string;
	searchOpen: boolean;
	sortDesc: boolean;
	openId: string | null;
	starred: boolean;
	panelOpen: boolean;
	extraRels: number;
	openDoc: Doc;
	openTitle: string;
	visible: Note[];

	pickSidebar: (id: string) => void;
	openNote: (id: string) => void;
	addNote: () => void;
	setQuery: (query: string) => void;
	toggleSearch: () => void;
	toggleSort: () => void;
	toggleStarred: () => void;
	setPanelOpen: (open: boolean) => void;
	addRelation: () => void;
	togglePhase: () => void;
}

function useShellStateValue(): ShellState {
	const [notes, setNotes] = useState<Note[]>(NOTES);
	const [box, setBox] = useState<Box>("inbox");
	const [sideSel, setSideSel] = useState("inbox");
	const [phase, setPhase] = useState<ShellPhase>("day");
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [sortDesc, setSortDesc] = useState(true);
	const [openId, setOpenId] = useState<string | null>(null);
	const [starred, setStarred] = useState(false);
	const [panelOpen, setPanelOpen] = useState(true);
	const [extraRels, setExtraRels] = useState(0);

	const openDoc: Doc = useMemo(() => {
		const note = notes.find((x) => x.id === openId);
		return note ? note.doc : ESSAY_DOC;
	}, [notes, openId]);

	const openTitle = openId
		? (notes.find((x) => x.id === openId)?.title ?? "")
		: "The State of Product Development";

	const visible = useMemo(() => {
		const pool = box === "all" ? notes : notes.filter((n) => n.box === box);
		const q = query.trim().toLowerCase();
		const filtered = q
			? pool.filter((n) =>
					[n.title, n.preview, ...n.tags.map((t) => t.label)]
						.join(" ")
						.toLowerCase()
						.includes(q),
				)
			: pool;
		return [...filtered].sort((a, b) =>
			sortDesc ? a.mins - b.mins : b.mins - a.mins,
		);
	}, [notes, box, query, sortDesc]);

	function pickSidebar(id: string) {
		setSideSel(id);
		if (id === "inbox" || id === "all" || id === "archive") setBox(id);
	}

	function openNote(id: string) {
		setOpenId(id);
		setStarred(false);
	}

	function addNote() {
		addedSeq += 1;
		const note: Note = {
			id: `added-${addedSeq}`,
			box: "inbox",
			title: "Untitled note",
			preview:
				"Start writing — this note lives in the inbox until you file it…",
			tags: [],
			ago: "just now",
			mins: -1,
			doc: doc({
				slug: "untitled",
				status: "Draft",
				date: "May 6, 2026",
				body: (
					<p>
						Start writing — this note lives in the inbox until you file it under
						a type or a folder.
					</p>
				),
			}),
		};
		setNotes((cur) => [note, ...cur]);
		setBox("inbox");
		setSideSel("inbox");
		setOpenId(note.id);
	}

	function toggleSearch() {
		if (searchOpen) setQuery("");
		setSearchOpen((v) => !v);
	}

	return {
		notes,
		box,
		sideSel,
		phase,
		query,
		searchOpen,
		sortDesc,
		openId,
		starred,
		panelOpen,
		extraRels,
		openDoc,
		openTitle,
		visible,
		pickSidebar,
		openNote,
		addNote,
		setQuery,
		toggleSearch,
		toggleSort: () => setSortDesc((v) => !v),
		toggleStarred: () => setStarred((v) => !v),
		setPanelOpen,
		addRelation: () => setExtraRels((n) => n + 1),
		togglePhase: () =>
			setPhase((current) => (current === "day" ? "night" : "day")),
	};
}

const ShellStateContext = createContext<ShellState | null>(null);

export function ShellStateProvider({ children }: { children: ReactNode }) {
	const value = useShellStateValue();
	return (
		<ShellStateContext.Provider value={value}>
			{children}
		</ShellStateContext.Provider>
	);
}

export function useShellState(): ShellState {
	const state = useContext(ShellStateContext);
	if (!state) {
		throw new Error("useShellState must be used within ShellStateProvider");
	}
	return state;
}
