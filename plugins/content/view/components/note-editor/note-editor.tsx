import { IconButton, MarkdownEditor } from "@twodb/ui";
import { FileText, Inbox, MoreHorizontal, Star } from "lucide-react";
import { useState } from "react";
import { useNoteEditor } from "../../hooks/use-note-editor.hook";
import { noteEditorStyles } from "./note-editor.style";

export function NoteEditor() {
  const { note, initialValue, contentReady, handleChange } = useNoteEditor();
  const [starred, setStarred] = useState(false);

  return (
    <section className="note-editor" aria-label="Note editor">
      <style jsx>{noteEditorStyles}</style>
      {note ? (
        <>
          <div className="note-editor__chrome">
            <span className="note-editor__doctype">
              <span className="note-editor__doctypeicon">
                <FileText size={12} />
              </span>
              {note.title}
            </span>
            <span className="note-editor__chromespacer" />
            <IconButton
              active={starred}
              className="note-editor__barbtn note-editor__barbtn--star"
              icon={<Star size={14} fill={starred ? "currentColor" : "none"} />}
              label="Favorite"
              onClick={() => setStarred((s) => !s)}
              size="sm"
            />
            <IconButton
              className="note-editor__barbtn"
              icon={<MoreHorizontal size={14} />}
              label="More actions"
              size="sm"
            />
          </div>
          <main className="note-editor__body">
            {contentReady ? (
              <MarkdownEditor
                key={note.id}
                defaultValue={initialValue}
                onChange={handleChange}
                minHeight={360}
                placeholder="Start writing…"
              />
            ) : (
              <div style={{ minHeight: 360 }} />
            )}
          </main>
        </>
      ) : (
        <div className="note-editor__empty">
          <Inbox size={20} />
          <p>Select a note to read it here.</p>
        </div>
      )}
    </section>
  );
}
