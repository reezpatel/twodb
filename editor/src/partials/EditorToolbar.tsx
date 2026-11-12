import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Bold, Code, Code2, Heading2, Heading3, ImagePlus, Italic, Link as LinkIcon, List, ListChecks, ListOrdered, Quote, Strikethrough, Underline } from "lucide-react";
import { ToolbarButton, ToolbarSeparator } from "./ToolbarButton";

export function EditorToolbar(props: { editor: Editor; onPickImage?: () => void }) {
  const { editor } = props;
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"), code: e.isActive("code"),
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }), ul: e.isActive("bulletList"), ol: e.isActive("orderedList"),
      task: e.isActive("taskList"), quote: e.isActive("blockquote"), codeBlock: e.isActive("codeBlock"), link: e.isActive("link"),
    }),
  });
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url }).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-outline px-1.5 py-1">
      <ToolbarButton label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><Bold className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><Italic className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}><Underline className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough className="size-3.5" /></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="size-3.5" /></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton label="Bullet list" active={s.ul} onClick={() => c().toggleBulletList().run()}><List className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={s.ol} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Task list" active={s.task} onClick={() => c().toggleTaskList().run()}><ListChecks className="size-3.5" /></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}><Code className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}><Code2 className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Link" active={s.link} onClick={setLink}><LinkIcon className="size-3.5" /></ToolbarButton>
      {props.onPickImage ? <ToolbarButton label="Insert image" onClick={props.onPickImage}><ImagePlus className="size-3.5" /></ToolbarButton> : null}
    </div>
  );
}
