import { noteMarkerStyles } from "./NoteMarker.style.js";

export function NoteMarker({ marker }: { marker: string }) {
  if (!marker) return null;

  const classes = ["shell__mark", `shell__mark--${marker}`].join(" ");

  return (
    <span className={classes}>
      <style jsx>{noteMarkerStyles}</style>
      {marker === "glyph" ? "⌘" : null}
    </span>
  );
}
