import { useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useMarkdownEditor, type UseMarkdownEditorOptions } from "./hooks/useMarkdownEditor";
import { EditorToolbar } from "./partials/EditorToolbar";

export interface MarkdownEditorProps extends UseMarkdownEditorOptions {
  /** Hide the formatting toolbar. */
  minimal?: boolean;
  /** Remove the outer border/background when the host supplies its own surface. */
  bare?: boolean;
  className?: string;
}

/** Rich TipTap editing while reading and emitting Markdown. */
export function MarkdownEditor({ minimal, bare, className, ...options }: MarkdownEditorProps) {
  const editor = useMarkdownEditor(options);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;
  const pickImage = options.onUploadImage ? () => fileRef.current?.click() : undefined;

  return (
    <div className={`twodb-editor ${bare ? "" : "rounded-md border border-outline bg-paper focus-within:border-ion-deep"} ${className ?? ""}`}>
      {!minimal && editor.isEditable ? <EditorToolbar editor={editor} onPickImage={pickImage} /> : null}
      <EditorContent editor={editor} />
      {pickImage ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !options.onUploadImage) return;
            editor.chain().focus().setImage({ src: await options.onUploadImage(file), alt: file.name }).run();
          }}
        />
      ) : null}
    </div>
  );
}
