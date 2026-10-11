import type { ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ToolbarButton({ editor, label, active, onClick, children }: { editor: Editor | null; label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" aria-label={label} aria-pressed={active} disabled={!editor} className={active ? "bg-accent" : undefined} onClick={onClick}>
      {children}
    </Button>
  );
}

/** HTML email body editor (tiptap). Remount via key to swap drafts. */
export function RichEditor({ value, onChange, className }: { value: string; onChange: (html: string) => void; className?: string }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, link: { openOnClick: false } }), Placeholder.configure({ placeholder: "Write your message…" })],
    content: value,
    editorProps: { attributes: { class: "tiptap-prose min-h-40 outline-none", spellcheck: "true", "aria-label": "Message body" } },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  const is = (name: string) => editor?.isActive(name) ?? false;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-0.5">
        <ToolbarButton editor={editor} label="Bold" active={is("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Italic" active={is("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Strikethrough" active={is("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Bullet list" active={is("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Numbered list" active={is("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Quote" active={is("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
