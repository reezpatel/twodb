import type { ReactNode } from "react";

/* Shared shapes for the app shell regions. Content is still mock data; these
   become contract-driven (notes plugin DTOs) as regions turn into plugin
   contribution points. */

export type Box = "inbox" | "all" | "archive";
export type ChipTone = "red" | "purple" | "blue" | "green";

export interface TagChip {
	label: string;
	tone: ChipTone;
	link?: boolean;
}

export interface Doc {
	type: string;
	typeIcon: ReactNode;
	slug: string;
	status: string;
	date: string;
	notionId: string;
	url: string;
	belongsTo: { label: string; tone: ChipTone } | null;
	hasNotes: string[];
	body: ReactNode;
}

export interface Note {
	id: string;
	box: Exclude<Box, "all">;
	title: string;
	marker?: "orange" | "glyph" | "image";
	preview: string;
	tags: TagChip[];
	ago: string;
	mins: number;
	doc: Doc;
}
