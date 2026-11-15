import { useEffect, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";

export interface UseMarkdownEditorOptions {
  value: string;
  onChange?: (markdown: string) => void;
  onBlur?: (markdown: string) => void;
  onSubmit?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  editable?: boolean;
  autofocus?: boolean;
}

/** TipTap editor whose public value remains Markdown for APIs, agents, and persistence. */
export function useMarkdownEditor(options: UseMarkdownEditorOptions): Editor | null {
  const callbacks = useRef(options);
  callbacks.current = options;
  const editorRef = useRef<Editor | null>(null);

  const insertFiles = async (editor: Editor, files: File[]) => {
    const upload = callbacks.current.onUploadImage;
    if (!upload) return false;
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) return false;
    for (const file of images) {
      const src = await upload(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    }
    return true;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      }),
      Placeholder.configure({ placeholder: options.placeholder ?? "" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      TableKit,
      Markdown,
    ],
    content: options.value,
    contentType: "markdown",
    editable: options.editable ?? true,
    autofocus: options.autofocus ? "end" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "twodb-editor-content", spellcheck: "true" },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && callbacks.current.onSubmit) {
          event.preventDefault();
          callbacks.current.onSubmit();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length || !callbacks.current.onUploadImage || !editorRef.current) return false;
        void insertFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!files.length || !callbacks.current.onUploadImage || !editorRef.current) return false;
        event.preventDefault();
        void insertFiles(editorRef.current, files);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => callbacks.current.onChange?.(current.getMarkdown()),
    onBlur: ({ editor: current }) => callbacks.current.onBlur?.(current.getMarkdown()),
  });
  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isFocused || editor.getMarkdown() === options.value) return;
    editor.commands.setContent(options.value || "", { emitUpdate: false, contentType: "markdown" });
  }, [options.value, editor]);

  useEffect(() => {
    editor?.setEditable(options.editable ?? true);
  }, [options.editable, editor]);

  return editor;
}
