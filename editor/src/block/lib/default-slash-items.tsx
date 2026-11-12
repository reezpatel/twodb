import { CheckSquare, ChevronRight, Code2, Heading1, Heading2, Heading3, ImageIcon, List, ListOrdered, Minus, Quote, Table2, Text, Lightbulb, Link2 } from "lucide-react";
import type { Editor, Range } from "@tiptap/core";
import type { BlockEditorHost, SlashItem } from "../types";

const S = 16;

function pickImage(editor: Editor, upload: (f: File) => Promise<string>) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const src = await upload(file);
    editor.chain().focus().setImage({ src, alt: file.name }).run();
  };
  input.click();
}

export function defaultSlashItems(host: BlockEditorHost): SlashItem[] {
  const del = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);
  const items: SlashItem[] = [
    { id: "text", group: "Basic", title: "Text", description: "Plain paragraph", icon: <Text size={S} />, keywords: ["p", "paragraph"], run: (e, r) => del(e, r).setParagraph().run() },
    { id: "h1", group: "Basic", title: "Heading 1", description: "Big section heading", icon: <Heading1 size={S} />, keywords: ["h1", "title"], run: (e, r) => del(e, r).setHeading({ level: 1 }).run() },
    { id: "h2", group: "Basic", title: "Heading 2", description: "Medium heading", icon: <Heading2 size={S} />, keywords: ["h2"], run: (e, r) => del(e, r).setHeading({ level: 2 }).run() },
    { id: "h3", group: "Basic", title: "Heading 3", description: "Small heading", icon: <Heading3 size={S} />, keywords: ["h3"], run: (e, r) => del(e, r).setHeading({ level: 3 }).run() },
    { id: "quote", group: "Basic", title: "Quote", icon: <Quote size={S} />, keywords: ["blockquote"], run: (e, r) => del(e, r).toggleBlockquote().run() },
    { id: "callout", group: "Basic", title: "Callout", description: "Highlighted note", icon: <Lightbulb size={S} />, keywords: ["note", "info"], run: (e, r) => del(e, r).setCallout().run() },
    { id: "divider", group: "Basic", title: "Divider", icon: <Minus size={S} />, keywords: ["hr", "line", "separator"], run: (e, r) => del(e, r).setHorizontalRule().run() },
    { id: "bullet", group: "List", title: "Bulleted list", icon: <List size={S} />, keywords: ["ul", "-"], run: (e, r) => del(e, r).toggleBulletList().run() },
    { id: "numbered", group: "List", title: "Numbered list", icon: <ListOrdered size={S} />, keywords: ["ol", "1."], run: (e, r) => del(e, r).toggleOrderedList().run() },
    { id: "todo", group: "List", title: "To-do list", icon: <CheckSquare size={S} />, keywords: ["task", "checkbox", "[]"], run: (e, r) => del(e, r).toggleTaskList().run() },
    { id: "toggle", group: "List", title: "Toggle", description: "Collapsible section", icon: <ChevronRight size={S} />, keywords: ["details", "collapse"], run: (e, r) => del(e, r).setDetails().run() },
    { id: "code", group: "Advanced", title: "Code block", icon: <Code2 size={S} />, keywords: ["```", "snippet"], run: (e, r) => del(e, r).toggleCodeBlock().run() },
    {
      id: "table",
      group: "Advanced",
      title: "Table",
      description: "Simple grid (not a database)",
      icon: <Table2 size={S} />,
      keywords: ["grid"],
      run: (e, r) => del(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
  ];
  if (host.searchPages)
    items.push({
      id: "link-page",
      group: "Advanced",
      title: "Link to page",
      description: "Mention another page",
      icon: <Link2 size={S} />,
      keywords: ["mention", "@", "[["],
      run: (e, r) => del(e, r).insertContent("@").run(),
    });
  if (host.uploadImage) {
    const upload = host.uploadImage;
    items.push({ id: "image", group: "Media", title: "Image", description: "Upload an image", icon: <ImageIcon size={S} />, keywords: ["picture", "photo"], run: (e, r) => (del(e, r).run(), pickImage(e, upload)) });
  }
  return items;
}
