/* Live-data adapter for the notes scene: maps content-plugin rows onto the
   scene's Note shape and owns add/toggle mutations. Box semantics map onto
   the row's `completed` flag: inbox = active, archive = completed. */

import { useMemo } from "react";
import type { ContentRowDto } from "@twodb/contracts";
import {
	useRowMutations,
	useRows,
	useSectionSchema,
} from "@twodb/content/view";
import type { Box, ChipTone, Note } from "../../shell/types";

const CHIP_TONES: ChipTone[] = ["red", "purple", "blue", "green"];

function chipTone(tone: string | undefined): ChipTone {
	return CHIP_TONES.includes(tone as ChipTone) ? (tone as ChipTone) : "blue";
}

function relativeTime(iso: string): { ago: string; mins: number } {
	const then = new Date(iso).getTime();
	const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
	if (mins < 1) return { ago: "just now", mins: 0 };
	if (mins < 60) return { ago: `${mins}m ago`, mins };
	const hours = Math.round(mins / 60);
	if (hours < 24) return { ago: `${hours}h ago`, mins };
	const days = Math.round(hours / 24);
	return { ago: `${days}d ago`, mins };
}

function previewOf(content: string): string {
	const firstLine = content.split("\n").find((l) => l.trim());
	return firstLine?.slice(0, 120) ?? "";
}

export function toNote(row: ContentRowDto): Note {
	const { ago, mins } = relativeTime(row.updated_at);
	return {
		id: row.id,
		box: row.completed ? "archive" : "inbox",
		title: row.title || "Untitled note",
		preview: previewOf(row.content),
		tags: row.tags.map((t) => ({ label: t.label, tone: chipTone(t.tone) })),
		ago,
		mins,
		doc: {
			type: "Note",
			typeIcon: null,
			slug: row.section_id,
			status: row.completed ? "Done" : "Active",
			date: new Date(row.created_at).toLocaleDateString(),
			notionId: row.id,
			url: "",
			belongsTo: null,
			hasNotes: [],
			body: null,
		},
	};
}

export interface SectionNotes {
	notes: Note[];
	isLoading: boolean;
	addNote: () => void;
	toggleComplete: (note: Note) => void;
	sectionName: string | undefined;
}

export function useSectionNotes(
	identifier: string | undefined,
	box: Box,
	query: string,
	sortDesc: boolean,
): SectionNotes {
	const rows = useRows(identifier);
	const schema = useSectionSchema(identifier);
	const { create, update } = useRowMutations(identifier);

	const notes = useMemo(() => {
		const mapped = (rows.data ?? []).map(toNote);
		const pool = box === "all" ? mapped : mapped.filter((n) => n.box === box);
		const q = query.trim().toLowerCase();
		const filtered = q
			? pool.filter((n) =>
					[n.title, n.preview, ...n.tags.map((t) => t.label)]
						.join(" ")
						.toLowerCase()
						.includes(q),
				)
			: pool;
		// mins is "minutes since update" — ascending = most recent first.
		return [...filtered].sort((a, b) =>
			sortDesc ? a.mins - b.mins : b.mins - a.mins,
		);
	}, [rows.data, box, query, sortDesc]);

	return {
		notes,
		isLoading: rows.isLoading,
		sectionName: schema.data?.section.name,
		addNote: () => create.mutate({ title: "Untitled note" }),
		toggleComplete: (note) => {
			const row = (rows.data ?? []).find((r) => r.id === note.id);
			if (row) update.mutate({ rowId: row.id, completed: !row.completed });
		},
	};
}
