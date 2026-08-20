import type { Note } from "../../../shell/types";
import { noteMarkerStyles } from "./note-marker.style";

export function NoteMarker({ marker }: { marker?: Note["marker"] }) {
	if (!marker) return null;

	const classes = ["shell__mark", `shell__mark--${marker}`].join(" ");

	return (
		<span className={classes}>
			<style jsx>{noteMarkerStyles}</style>
			{marker === "glyph" ? "⌘" : null}
		</span>
	);
}
