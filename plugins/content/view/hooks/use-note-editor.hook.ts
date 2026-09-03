import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { PLUGIN_ID } from "../../shared/constants";
import { rowsApi } from "../api";
import { useSection } from "../provider/section-provider";
import { useSectionRowMutations } from "./use-section-row-mutations.hook";

const SAVE_DEBOUNCE_MS = 800;

/**
 * Editor state for the open note. The MarkdownEditor mounts uncontrolled
 * (defaultValue) once content has loaded — typing before load would
 * clobber, so callers gate on `contentReady`. Saves are debounced and
 * flushed when switching notes.
 */
export function useNoteEditor() {
	const { section, openNoteId } = useSection();
	const sectionId = section?.id ?? "";
	const { update } = useSectionRowMutations();

	const { data: rowData } = useQuery({
		queryKey: [PLUGIN_ID, "note", sectionId, openNoteId],
		enabled: !!sectionId && !!openNoteId,
		queryFn: () => rowsApi.get(sectionId, openNoteId ?? ""),
	});

	const { data: contentData, isFetched: contentReady } = useQuery({
		queryKey: [PLUGIN_ID, "note-content", sectionId, openNoteId],
		enabled: !!sectionId && !!openNoteId,
		queryFn: () => rowsApi.getContent(sectionId, openNoteId ?? ""),
	});

	const note = rowData?.row;
	const incoming = contentData?.content;
	const initialValue =
		typeof incoming === "string"
			? incoming
			: incoming == null
				? ""
				: JSON.stringify(incoming, null, 2);

	const dirtyRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const draftRef = useRef("");

	// Reset on note switch; flush a pending save for the note being left.
	useEffect(() => {
		dirtyRef.current = false;
		draftRef.current = "";
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			if (dirtyRef.current && openNoteId) {
				update.mutate({
					rowId: openNoteId,
					body: { content: draftRef.current },
				});
				dirtyRef.current = false;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [openNoteId]);

	const save = useCallback(() => {
		if (!openNoteId || !dirtyRef.current) return;
		dirtyRef.current = false;
		update.mutate({
			rowId: openNoteId,
			body: { content: draftRef.current },
		});
	}, [openNoteId, update]);

	const handleChange = useCallback(
		(markdown: string) => {
			draftRef.current = markdown;
			dirtyRef.current = true;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(save, SAVE_DEBOUNCE_MS);
		},
		[save],
	);

	return { note, initialValue, contentReady, handleChange };
}
