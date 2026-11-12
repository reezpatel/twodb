import { useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { SlashCommand } from "../extensions/slash-command";
import { createPageMention } from "../extensions/page-mention";
import { Callout } from "../extensions/callout";
import { createDatabaseView } from "../extensions/database-view";
import { BlockHandle } from "../extensions/block-handle";
import { defaultSlashItems } from "../lib/default-slash-items";
import type { BlockEditorProps } from "../types";

/** Holding hook: builds the TipTap editor once; host callbacks are read through a ref so they can change freely. */
export function useBlockEditor(props: BlockEditorProps): Editor | null {
  const ref = useRef(props);
  ref.current = props;
  const getHost = () => ref.current;

  const uploadFiles = async (editor: Editor, files: File[], pos?: number) => {
    const upload = ref.current.uploadImage;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!upload || !images.length) return false;
    for (const file of images) {
      const src = await upload(file);
      const chain = editor.chain().focus();
      (pos !== undefined ? chain.insertContentAt(pos, { type: "image", attrs: { src, alt: file.name } }) : chain.setImage({ src, alt: file.name })).run();
    }
    return true;
  };

  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
        dropcursor: { color: "var(--ion-deep)", width: 2 },
      }),
      Placeholder.configure({
        includeChildren: false,
        placeholder: ({ node, editor: e }) => {
          if (node.type.name === "heading") return `Heading ${node.attrs.level}`;
          if (node.type.name === "detailsSummary") return "Toggle";
          return e.isEmpty ? (ref.current.placeholder ?? "Type '/' for commands") : "Type '/' for commands";
        },
        showOnlyCurrent: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Highlight,
      TableKit.configure({ table: { resizable: true } }),
      Details.configure({ persist: true, HTMLAttributes: { class: "twodb-toggle" } }),
      DetailsSummary,
      DetailsContent,
      Callout,
      SlashCommand.configure({ getItems: () => [...defaultSlashItems(ref.current), ...(ref.current.slashItems ?? [])] }),
      createPageMention(getHost),
      createDatabaseView(getHost),
      BlockHandle,
    ],
    content: props.initialContent ?? undefined,
    editable: props.editable ?? true,
    autofocus: props.autofocus ? "end" : false,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "twodb-block-content" },
      handleKeyDown: (view, e) => {
        if (e.key === "ArrowUp" && ref.current.onExitTop) {
          const { $from, empty } = view.state.selection;
          if (empty && $from.pos <= 1) {
            ref.current.onExitTop();
            return true;
          }
        }
        return false;
      },
      handlePaste: (_view, e) => {
        const files = Array.from(e.clipboardData?.files ?? []);
        if (!files.length || !ref.current.uploadImage || !editorRef.current) return false;
        void uploadFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (view, e, _slice, moved) => {
        if (moved) return false;
        const files = Array.from((e as DragEvent).dataTransfer?.files ?? []);
        if (!files.length || !ref.current.uploadImage || !editorRef.current) return false;
        e.preventDefault();
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos;
        void uploadFiles(editorRef.current, files, pos);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => ref.current.onChange?.(e.getJSON(), e),
    onCreate: ({ editor: e }) => ref.current.onReady?.(e),
  });
  editorRef.current = editor;
  return editor;
}
