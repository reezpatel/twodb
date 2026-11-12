export { RichTextEditor, type RichTextEditorProps } from "./RichTextEditor";
export { RichTextView } from "./RichTextView";
export { useRichTextEditor, type UseRichTextEditorOptions } from "./hooks/useRichTextEditor";
export { sanitizeHtml, isEmptyHtml } from "./lib/sanitize";

// Block editor (Notion/AFFiNE-style, TipTap JSON) — import "@twodb/editor/block.css" too.
export { BlockEditor } from "./block/BlockEditor";
export type { BlockEditorProps, BlockEditorHost, DatabaseBlockProps, PageMentionProps, PageRef, SlashItem } from "./block/types";
export type { Editor, JSONContent, Range } from "@tiptap/core";
