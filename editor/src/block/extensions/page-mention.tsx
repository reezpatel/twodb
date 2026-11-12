import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { FileText, Plus } from "lucide-react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { SuggestionList, type SuggestionEntry } from "../partials/SuggestionList";
import { suggestionPopup } from "../lib/suggestion-popup";
import type { BlockEditorHost, PageRef } from "../types";

type HostGetter = () => BlockEditorHost;

interface MentionItem extends PageRef {
  create?: boolean;
}

function PageMentionView({ node, extension }: ReactNodeViewProps) {
  const host = (extension.options as { getHost: HostGetter }).getHost();
  const id = node.attrs.id as string;
  const title = (node.attrs.title as string) || "Untitled";
  const Custom = host.PageMention;
  return (
    <NodeViewWrapper
      as="span"
      className="twodb-page-mention"
      data-page-id={id}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault();
        host.openPage?.(id);
      }}
    >
      {Custom ? (
        <Custom id={id} title={title} />
      ) : (
        <>
          <FileText size={14} className="twodb-page-mention-icon" />
          <span>{title}</span>
        </>
      )}
    </NodeViewWrapper>
  );
}

function suggestion(char: string, key: string, getHost: HostGetter): Omit<SuggestionOptions<any, any>, "editor"> {
  return {
    char,
    pluginKey: new PluginKey(key),
    allowSpaces: true,
    items: async ({ query }) => {
      const host = getHost();
      const pages = (await host.searchPages?.(query).catch(() => [])) ?? [];
      const items: MentionItem[] = pages.slice(0, 8);
      if (host.createPage && query.trim()) items.push({ id: `__create__${query}`, title: query.trim(), create: true });
      return items;
    },
    command: ({ editor, range, props }) => {
      const insert = (page: PageRef) =>
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "pageMention", attrs: { id: page.id, title: page.title } },
            { type: "text", text: " " },
          ])
          .run();
      const item = props as unknown as MentionItem;
      if (item.create) {
        void getHost()
          .createPage?.(item.title)
          .then(insert);
      } else insert(item);
    },
    render: suggestionPopup(SuggestionList as never, (p) => ({
      editor: p.editor,
      items: (p.items as MentionItem[]).map<SuggestionEntry>((i) => ({
        id: i.id,
        title: i.create ? `Create “${i.title}”` : i.title || "Untitled",
        icon: i.create ? <Plus size={15} /> : i.icon ? <span>{i.icon}</span> : <FileText size={15} />,
        group: i.create ? "New" : "Link to page",
      })),
      onSelect: (entry: SuggestionEntry) => {
        const item = (p.items as MentionItem[]).find((i) => i.id === entry.id);
        if (item) p.command(item as never);
      },
      emptyText: "No pages found",
    })),
  };
}

/** Inline atom `pageMention {id, title}` — powers backlinks on the server. */
export function createPageMention(getHost: HostGetter) {
  return Mention.extend({
    name: "pageMention",
    addOptions() {
      return { ...this.parent!(), getHost };
    },
    addAttributes() {
      return {
        id: { default: null, parseHTML: (el) => el.getAttribute("data-page-id"), renderHTML: (a) => ({ "data-page-id": a.id }) },
        title: { default: "", parseHTML: (el) => el.textContent ?? "", renderHTML: () => ({}) },
      };
    },
    parseHTML() {
      return [{ tag: "span[data-page-id]" }];
    },
    renderHTML({ node, HTMLAttributes }) {
      return ["span", { ...HTMLAttributes, class: "twodb-page-mention" }, node.attrs.title || "Untitled"];
    },
    renderText({ node }) {
      return node.attrs.title || "Untitled";
    },
    addNodeView() {
      return ReactNodeViewRenderer(PageMentionView);
    },
  }).configure({
    suggestions: [suggestion("@", "pageMentionAt", getHost), suggestion("[[", "pageMentionBrackets", getHost)],
  });
}
