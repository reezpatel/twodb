import { TagChip } from "@twodb/ui";
import { noteListItemStyles } from "./list-item.style";
import { NoteMarker } from "../../notes-old/notes-list/note-marker";
import type { ContentRowDto } from "@twodb/contracts";

type NoteListItemProps = {
  note: ContentRowDto;
  open: boolean;
  onOpen: (id: string) => void;
};

export function ListItem({ note, open, onOpen }: NoteListItemProps) {
  return (
    <article
      className={`shell__note ${open ? "is-open" : ""}`}
      onClick={() => onOpen(note.id)}
    >
      <style jsx>{noteListItemStyles}</style>
      <div className="shell__notehead">
        <strong>
          <NoteMarker marker={"glyph"} />
          {note.title}
        </strong>
      </div>
      <p>{note.content}</p>
      {note.tags.length > 0 && (
        <div className="shell__notechips">
          {note.tags.map((tag) => (
            <TagChip
              key={tag.label}
              color={`var(--shell-${tag.tone})`}
              background={`var(--shell-${tag.tone}-bg)`}
              icon={tag.link ? "link" : "tag"}
            >
              {tag.label}
            </TagChip>
          ))}
        </div>
      )}
      <div className="shell__notefoot">
        <span>{note.updated_at}</span>
      </div>
    </article>
  );
}
