import { useEffect } from "react";
import { EditorContent } from "@tiptap/react";
import { useBlockEditor } from "./hooks/useBlockEditor";
import { BubbleToolbar } from "./partials/BubbleToolbar";
import type { BlockEditorProps } from "./types";

/**
 * Notion/AFFiNE-style block editor: slash menu, block gutter (add + drag),
 * selection toolbar, @ / [[ page mentions, callouts, toggles, tables, images
 * and host-rendered database blocks. Content is TipTap JSON.
 */
export function BlockEditor(props: BlockEditorProps) {
  const editor = useBlockEditor(props);

  useEffect(() => {
    const want = props.editable ?? true;
    // no "update" event: toggling editability must not look like a content change (autosave)
    if (editor && editor.isEditable !== want) editor.setEditable(want, false);
  }, [props.editable, editor]);

  if (!editor) return <div className={`twodb-block-editor ${props.className ?? ""}`} />;
  return (
    <div className={`twodb-block-editor ${props.className ?? ""}`}>
      <EditorContent editor={editor} />
      <BubbleToolbar editor={editor} />
    </div>
  );
}

