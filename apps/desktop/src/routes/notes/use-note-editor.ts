import { useEffect, useRef } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { NoteRecord, NotesViewHook } from "./use-notes-view";
import { ResizableImage } from "./resizable-image";
import { useSlashCommand } from "./slash-command";

/** Legacy notes stored {text}; newer ones store {doc} from the tiptap JSON. */
function toTiptapDoc(content: NoteRecord["content"]): JSONContent | "" {
  if (content?.doc && typeof content.doc === "object") return content.doc as JSONContent;
  const text = typeof content?.text === "string" ? content.text : "";
  if (!text.trim()) return "";
  return {
    type: "doc",
    content: text.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph.replace(/\n/g, " ") }] : [],
    })),
  };
}

/** Tiptap-backed editor for one note with debounced autosave of {doc} + preview. */
export function useNoteEditor(note: NoteRecord, update: NotesViewHook["updateNote"]) {
  const slash = useSlashCommand();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");

  const persist = (editor: Editor) => {
    const doc = editor.getJSON();
    const json = JSON.stringify(doc);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    update.mutate({
      noteId: note.noteId,
      content: { doc },
      preview: editor.getText().trim().slice(0, 120),
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Write something… type / for blocks" }),
      ResizableImage,
      slash.extension,
    ],
    content: toTiptapDoc(note.content),
    editorProps: { attributes: { class: "tiptap-prose", spellcheck: "true" } },
    onUpdate: ({ editor: current }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(current), 800);
    },
  });

  // flush pending text when switching notes or leaving the editor
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note.noteId]);

  const saveNow = () => {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persist(editor);
  };

  const setProp = (propId: string, value: unknown) => {
    saveNow();
    update.mutate({ noteId: note.noteId, props: { [propId]: value } });
  };

  return { editor, slashPopup: slash.popup, saveNow, setProp, saving: update.isPending };
}
