import { useEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { ResizableImage } from "./resizable-image";
import { DatabaseBlock } from "./database-block";
import { useSlashCommand, type SlashContext } from "./slash-command";

/** What the editor edits — a standalone page or a database row (also a page). */
export interface EditablePage {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  content: { doc?: unknown } | null;
  updatedAt: string;
  props?: Record<string, unknown>;
}

export interface PagePatch {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  content?: unknown;
  preview?: string;
  props?: Record<string, unknown>;
}

/** Where edits go: PATCH /nodes/:id for pages, the database rows endpoint for rows. */
export interface PageSaver {
  save: (patch: PagePatch) => Promise<unknown>;
  saving: boolean;
  remove?: () => void;
}

function toTiptapDoc(content: EditablePage["content"]): JSONContent | "" {
  const doc = content?.doc;
  return doc && typeof doc === "object" ? (doc as JSONContent) : "";
}

/** Inline database ids referenced by the doc — when this set changes the
 *  sidebar must refresh (a removed block turns its database dangling). */
function databaseIds(doc: JSONContent): string {
  const ids: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === "databaseBlock" && typeof n.attrs?.databaseId === "string") ids.push(n.attrs.databaseId);
    n.content?.forEach(walk);
  };
  walk(doc);
  return ids.sort().join(",");
}

/** Tiptap editor for one page with debounced autosave of {doc} + preview. */
export function useNoteEditor(page: EditablePage, saver: PageSaver, opts: { slash?: SlashContext; onEmbedsChanged?: () => void } = {}) {
  const slash = useSlashCommand(opts.slash);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(JSON.stringify(page.content?.doc ?? null));
  const lastEmbeds = useRef<string>(databaseIds((page.content?.doc as JSONContent) ?? { type: "doc" }));
  const [isEmpty, setIsEmpty] = useState(true);

  const persist = async (editor: Editor) => {
    const doc = editor.getJSON();
    const json = JSON.stringify(doc);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    await saver.save({ content: { doc }, preview: editor.getText().trim().slice(0, 120) });
    const embeds = databaseIds(doc);
    if (embeds !== lastEmbeds.current) {
      lastEmbeds.current = embeds;
      opts.onEmbedsChanged?.();
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Write something… type / for blocks" }),
      ResizableImage,
      DatabaseBlock,
      slash.extension,
    ],
    content: toTiptapDoc(page.content),
    editorProps: { attributes: { class: "tiptap-prose", spellcheck: "true" } },
    onCreate: ({ editor: current }) => setIsEmpty(current.isEmpty),
    onUpdate: ({ editor: current }) => {
      setIsEmpty(current.isEmpty);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(current), 800);
    },
  });

  // flush pending text when switching pages or unmounting
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor && !editor.isDestroyed) void persist(editor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, editor]);

  const saveNow = async () => {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist(editor);
  };

  const setProp = (propId: string, value: unknown) => {
    void saveNow();
    void saver.save({ props: { [propId]: value } });
  };

  return { editor, slashPopup: slash.popup, saveNow, setProp, isEmpty, saving: saver.saving };
}
