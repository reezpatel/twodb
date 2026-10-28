import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const MARKER_CLASS = "text-muted-foreground/60";

/** Inline markdown spans to highlight. `marker` is the length of the delimiter on each side. */
const SPANS = [
  { pattern: /`([^`\n]+)`/g, marker: 1, class: "rounded bg-muted px-0.5 py-[0.1rem] text-foreground" },
  { pattern: /(?<![\w*])\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*(?![\w*])/g, marker: 2, class: "font-semibold" },
  { pattern: /(?<![\w*])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![\w*])/g, marker: 1, class: "italic" },
  { pattern: /~~(?=\S)([^~\n]+?)(?<=\S)~~/g, marker: 2, class: "line-through" },
];

/**
 * Highlights inline markdown (`code`, **bold**, *italic*, ~~strike~~) while keeping
 * the markers in the text, so what is sent is exactly what was typed. (Formatting
 * marks would swallow the markers — getText() ignores marks — and the agent would
 * lose the formatting.) Decorations only: the document is never modified.
 */
const CodeHighlight = Extension.create({
  name: "codeHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("codeHighlight"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const span of SPANS) {
                for (const match of node.text.matchAll(span.pattern)) {
                  const from = pos + (match.index ?? 0);
                  const to = from + match[0].length;
                  decorations.push(Decoration.inline(from, to, { class: span.class }));
                  decorations.push(Decoration.inline(from, from + span.marker, { class: MARKER_CLASS }));
                  decorations.push(Decoration.inline(to - span.marker, to, { class: MARKER_CLASS }));
                }
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export default CodeHighlight;
