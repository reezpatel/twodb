import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, IconButton, Input, Textarea } from "@twodb/ui";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { Note } from "@twodb/contracts";
import type { FrontendBus, PluginApi } from "@twodb/shared-frontend";
import "./notes.css";

interface NotesScreenProps {
	api: PluginApi;
	bus: FrontendBus;
}

export function NotesScreen({ api, bus }: NotesScreenProps) {
	const [notes, setNotes] = useState<Note[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ title: string; body: string }>({
		title: "",
		body: "",
	});
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		const list = await api.get<Note[]>("/notes");
		setNotes(list);
		setLoading(false);
	}, [api]);

	useEffect(() => {
		void refresh();
		// Backend facts arrive over SSE, mirrored onto the frontend bus.
		const off = [
			bus.on("twodb.notes.note.created", () => void refresh()),
			bus.on("twodb.notes.note.updated", () => void refresh()),
			bus.on("twodb.notes.note.deleted", ({ noteId }) => {
				setSelectedId((current) => (current === noteId ? null : current));
				void refresh();
			}),
		];
		return () => off.forEach((unsubscribe) => unsubscribe());
	}, [bus, refresh]);

	const selected = useMemo(
		() => notes.find((note) => note.id === selectedId) ?? null,
		[notes, selectedId],
	);

	useEffect(() => {
		setDraft({ title: selected?.title ?? "", body: selected?.body ?? "" });
	}, [selected]);

	function select(note: Note) {
		setSelectedId(note.id);
		bus.emit("twodb.notes.note.selected", { noteId: note.id });
	}

	async function createNote() {
		const note = await api.post<Note>("/notes", {
			title: "Untitled",
			body: "",
		});
		setSelectedId(note.id);
	}

	async function saveNote() {
		if (!selected) return;
		await api.patch<Note>(`/notes/${selected.id}`, {
			title: draft.title,
			body: draft.body,
		});
	}

	async function deleteNote() {
		if (!selected) return;
		await api.del(`/notes/${selected.id}`);
	}

	return (
		<div className="notes">
			<aside className="notes__list">
				<header className="notes__list-head">
					<span className="tw-cue">Notes</span>
					<IconButton
						icon={<Plus size={15} />}
						label="New note"
						onClick={createNote}
					/>
				</header>
				{loading ? (
					<p className="notes__empty">Loading…</p>
				) : notes.length === 0 ? (
					<p className="notes__empty">
						No notes yet. Press <Plus size={12} aria-hidden="true" /> to write
						your first one.
					</p>
				) : (
					<ul className="notes__items">
						{notes.map((note) => (
							<li key={note.id}>
								<button
									type="button"
									className={
										note.id === selectedId
											? "notes__item notes__item--active"
											: "notes__item"
									}
									onClick={() => select(note)}
								>
									<FileText size={14} aria-hidden="true" />
									<span className="notes__item-title">{note.title}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</aside>

			<section className="notes__editor">
				{selected ? (
					<>
						<header className="notes__editor-head">
							<Badge tone="neutral">
								{new Date(selected.updatedAt).toLocaleString()}
							</Badge>
							<span className="notes__editor-actions">
								<Button variant="primary" size="sm" onClick={saveNote}>
									Save
								</Button>
								<IconButton
									icon={<Trash2 size={15} />}
									label="Delete note"
									onClick={deleteNote}
								/>
							</span>
						</header>
						<Input
							value={draft.title}
							onChange={(event) =>
								setDraft({ ...draft, title: event.target.value })
							}
							placeholder="Note title"
							aria-label="Note title"
						/>
						<Textarea
							value={draft.body}
							onChange={(event) =>
								setDraft({ ...draft, body: event.target.value })
							}
							placeholder="Write it down…"
							aria-label="Note body"
							className="notes__body"
						/>
					</>
				) : (
					<div className="notes__placeholder">
						<FileText size={22} aria-hidden="true" />
						<p>Select a note, or start a new one.</p>
					</div>
				)}
			</section>
		</div>
	);
}
