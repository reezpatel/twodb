import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { icon?: string }) => ReturnType;
      toggleCallout: () => ReturnType;
    };
  }
}

/** Callout block: an emoji + any blocks inside a tinted box. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      icon: { default: "💡", parseHTML: (el) => el.getAttribute("data-icon") ?? "💡", renderHTML: (a) => ({ "data-icon": a.icon }) },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='callout']" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "twodb-callout" }),
      ["span", { class: "twodb-callout-icon", contenteditable: "false" }, node.attrs.icon],
      ["div", { class: "twodb-callout-body" }, 0],
    ];
  },
  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});
