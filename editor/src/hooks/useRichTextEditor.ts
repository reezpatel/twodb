import { useEffect, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { isEmptyHtml } from "../lib/sanitize";

export interface UseRichTextEditorOptions {
  value: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  onSubmit?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  editable?: boolean;
  autofocus?: boolean;
}

/** Holding hook: wires TipTap extensions, controlled value sync and image paste/drop. */
export function useRichTextEditor(o: UseRichTextEditorOptions): Editor | null {
  const cb = useRef(o);
  cb.current = o;

  const insertFiles = async (editor: Editor, files: File[]) => {
    const upload = cb.current.onUploadImage;
    if (!upload) return false;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return false;
    for (const file of images) {
      const src = await upload(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    }
    return true;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } } }),
      Placeholder.configure({ placeholder: o.placeholder ?? "" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
    ],
    content: o.value,
    editable: o.editable ?? true,
    autofocus: o.autofocus ? "end" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "twodb-editor-content" },
      handleKeyDown: (_v, e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && cb.current.onSubmit) {
          e.preventDefault();
          cb.current.onSubmit();
          return true;
        }
        return false;
      },
      handlePaste: (view, e) => {
        const files = Array.from(e.clipboardData?.files ?? []);
        if (!files.length || !cb.current.onUploadImage) return false;
        void insertFiles((view as any).editor ?? editorRef.current!, files);
        return true;
      },
      handleDrop: (_view, e) => {
        const files = Array.from((e as DragEvent).dataTransfer?.files ?? []);
        if (!files.length || !cb.current.onUploadImage) return false;
        e.preventDefault();
        void insertFiles(editorRef.current!, files);
        return true;
      },
    },
    onUpdate: ({ editor }) => cb.current.onChange?.(isEmptyHtml(editor.getHTML()) ? "" : editor.getHTML()),
    onBlur: ({ editor }) => cb.current.onBlur?.(isEmptyHtml(editor.getHTML()) ? "" : editor.getHTML()),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // External value changes (e.g. switching tickets) — don't clobber what the user is typing.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = isEmptyHtml(editor.getHTML()) ? "" : editor.getHTML();
    if (current !== o.value) editor.commands.setContent(o.value || "", { emitUpdate: false });
  }, [o.value, editor]);

  useEffect(() => {
    editor?.setEditable(o.editable ?? true);
  }, [o.editable, editor]);

  return editor;
}
