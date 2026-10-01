import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/** Shared tiptap wrapper that edits a markdown string. Remount (via key) to swap documents. */
export function MarkdownEditor({ value, onChange, placeholder, ariaLabel, className }: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Markdown, Placeholder.configure({ placeholder })],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "tiptap-prose",
        spellcheck: "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getMarkdown()),
  });

  return <EditorContent editor={editor} className={cn("min-h-40", className)} />;
}
