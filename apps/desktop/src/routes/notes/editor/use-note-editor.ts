import { useEffect, useRef } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { NoteRecord, NotesViewHook } from "../view/use-notes-view";
import { ResizableImage } from "./resizable-image";
import { useSlashCommand } from "./slash-command";

/** Page decoration fields kept beside {doc} in the note's content JSON. */
export interface NoteDecorations {
  icon?: string | null;
  cover?: string | null;
}

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

export function readDecorations(content: NoteRecord["content"]): NoteDecorations {
  const icon = (content as Record<string, unknown>)?.icon;
  const cover = (content as Record<string, unknown>)?.cover;
  return { icon: typeof icon === "string" ? icon : null, cover: typeof cover === "string" ? cover : null };
}

/** Tiptap-backed editor for one note with debounced autosave of {doc} + preview. */
export function useNoteEditor(note: NoteRecord, update: NotesViewHook["updateNote"]) {
  const slash = useSlashCommand();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const decorations = useRef<NoteDecorations>(readDecorations(note.content));

  const persist = (editor: Editor) => {
    const doc = editor.getJSON();
    const content = { doc, ...decorations.current };
    const json = JSON.stringify(content);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    update.mutate({
      noteId: note.noteId,
      content,
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
    decorations.current = readDecorations(note.content);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note.noteId, note.content]);

  const saveNow = () => {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persist(editor);
  };

  /** Persist icon/cover immediately (they live outside the tiptap doc). */
  const setDecorations = (patch: NoteDecorations) => {
    decorations.current = { ...decorations.current, ...patch };
    if (editor) persist(editor);
  };

  const setProp = (propId: string, value: unknown) => {
    saveNow();
    update.mutate({ noteId: note.noteId, props: { [propId]: value } });
  };

  return { editor, slashPopup: slash.popup, saveNow, setProp, setDecorations, saving: update.isPending };
}
