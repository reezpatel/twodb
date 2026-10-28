import { Node, mergeAttributes } from "@tiptap/core";

export interface SkillRef {
  id: string;
  /** Display name — the chip label. */
  name: string;
  /** Full skill content; expands into the message on send. */
  content: string;
}

/**
 * Inline atom chip standing in for a skill, e.g. "/deploy-guide". The editor
 * keeps only the chip; the content expands back into the wire message on
 * send, and the transcript renders the same chip (content in meta.skills).
 */
const SkillChip = Node.create({
  name: "skillChip",
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
    return [{ tag: "span[data-skill-chip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-skill-chip": "",
        "data-skill-id": node.attrs.id ?? "",
        class: "rounded-md py-[0.1rem] px-1.5 font-medium bg-primary/10 text-primary border border-primary/30 cursor-pointer",
      }),
      node.attrs.label,
    ];
  },

  // getText() uses this — keeps the "/name" form so the send path can expand
  // it against the chip store and the transcript renders the same label.
  renderText({ node }) {
    const label = (node.attrs.label as string | undefined) ?? "";
    return label.startsWith("/") ? label : `/${label}`;
  },
});

export default SkillChip;
