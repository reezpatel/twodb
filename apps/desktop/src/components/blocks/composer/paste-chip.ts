import { Node, mergeAttributes } from "@tiptap/core";

export interface PasteRef {
  id: string;
  content: string;
  lines: number;
}

/**
 * Inline atom chip standing in for a large pasted block, e.g.
 * "Paste #1: 134 lines". The editor keeps only the chip; the content lives in
 * a per-composer store and expands back into the message on send.
 */
const PasteChip = Node.create({
  name: "pasteChip",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null as string | null },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-paste-chip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-paste-chip": "",
        "data-paste-id": node.attrs.id ?? "",
        class: "rounded-md py-[0.1rem] px-1.5 font-medium bg-primary/10 text-primary border border-primary/30 cursor-pointer",
      }),
      node.attrs.label,
    ];
  },

  renderText({ node }) {
    return node.attrs.label as string;
  },
});

export default PasteChip;
