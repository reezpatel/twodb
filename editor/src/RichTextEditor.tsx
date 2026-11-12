import { useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useRichTextEditor, type UseRichTextEditorOptions } from "./hooks/useRichTextEditor";
import { EditorToolbar } from "./partials/EditorToolbar";

export interface RichTextEditorProps extends UseRichTextEditorOptions {
  /** Hide the toolbar (compact inline editing, e.g. comments in a dense list). */
  minimal?: boolean;
  /** Remove the outer border/background (the host provides its own surface). */
  bare?: boolean;
  className?: string;
}

export function RichTextEditor({ minimal, bare, className, ...opts }: RichTextEditorProps) {
  const editor = useRichTextEditor(opts);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;
  const pick = opts.onUploadImage ? () => fileRef.current?.click() : undefined;
  return (
    <div className={`twodb-editor ${bare ? "" : "rounded-md border border-outline bg-paper focus-within:border-ion-deep"} ${className ?? ""}`}>
      {!minimal && editor.isEditable ? <EditorToolbar editor={editor} onPickImage={pick} /> : null}
      <EditorContent editor={editor} />
      {pick ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || !opts.onUploadImage) return;
            editor.chain().focus().setImage({ src: await opts.onUploadImage(f), alt: f.name }).run();
          }}
        />
      ) : null}
    </div>
  );
}
