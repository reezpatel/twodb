import { useEffect } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

interface CanvasArtifact {
  id: string;
  content: string;
}

/** Read-only tiptap preview bound to the active canvas artifact — replaces its content as the assistant streams updates. */
export function useCanvasPreview(artifact: CanvasArtifact | null) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Markdown],
    content: artifact?.content ?? "",
    contentType: "markdown",
    editable: false,
    editorProps: { attributes: { class: "tiptap-prose", "aria-label": "Canvas preview" } },
  });

  useEffect(() => {
    if (!editor || !artifact) return;
    // contentType must be passed per-call — the editor-level option only
    // applies to the initial content.
    editor.commands.setContent(artifact.content, { emitUpdate: false, contentType: "markdown" } as Parameters<typeof editor.commands.setContent>[1]);
  }, [editor, artifact?.id, artifact?.content]);

  return editor;
}
