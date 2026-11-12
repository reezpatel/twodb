import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { SuggestionList, type SuggestionEntry } from "../partials/SuggestionList";
import { suggestionPopup } from "../lib/suggestion-popup";
import type { SlashItem } from "../types";

export const slashPluginKey = new PluginKey("twodbSlash");

function match(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.title.toLowerCase().includes(q) || i.keywords?.some((k) => k.toLowerCase().startsWith(q)));
}

/** "/" menu. Items come from a getter so the host can change them without rebuilding the editor. */
export const SlashCommand = Extension.create<{ getItems: () => SlashItem[] }>({
  name: "slashCommand",
  addOptions() {
    return { getItems: () => [] };
  },
  addProseMirrorPlugins() {
    const getItems = this.options.getItems;
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        allow: ({ state, range }) => {
          // not inside code blocks
          const $from = state.doc.resolve(range.from);
          return $from.parent.type.name !== "codeBlock";
        },
        items: ({ query }) => match(getItems(), query).slice(0, 40),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: suggestionPopup(SuggestionList as never, (p) => ({
          editor: p.editor,
          items: (p.items as SlashItem[]).map<SuggestionEntry>((i) => ({ id: i.id, title: i.title, description: i.description, icon: i.icon, group: i.group })),
          onSelect: (entry: SuggestionEntry) => {
            const item = (p.items as SlashItem[]).find((i) => i.id === entry.id);
            if (item) p.command(item);
          },
          emptyText: "No blocks match",
        })),
      }),
    ];
  },
});
