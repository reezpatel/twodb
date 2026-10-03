import type { Dispatch, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
// side-effect: registers the chain-command type augmentations used below
import "@tiptap/starter-kit";
import "@tiptap/extension-image";
import { Code2, GripVertical, Heading1, Heading2, Heading3, Image as ImageIcon, List, ListOrdered, Minus, Quote, Type } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashItem {
  title: string;
  description: string;
  icon: typeof Type;
  keywords: string[];
  command: ({ editor, range }: { editor: Editor; range: Range }) => void;
}

const pickImage = () =>
  new Promise<string | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    };
    input.click();
  });

function buildItems(): SlashItem[] {
  return [
    {
      title: "Text",
      description: "Plain paragraph",
      icon: Type,
      keywords: ["text", "paragraph", "plain"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      title: "Heading 1",
      description: "Big section heading",
      icon: Heading1,
      keywords: ["h1", "heading", "title"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
    },
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: Heading2,
      keywords: ["h2", "heading", "subtitle"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
    },
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: Heading3,
      keywords: ["h3", "heading"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
    },
    {
      title: "Bullet list",
      description: "Simple bulleted list",
      icon: List,
      keywords: ["bullet", "list", "unordered", "ul"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: "Numbered list",
      description: "List with numbering",
      icon: ListOrdered,
      keywords: ["numbered", "list", "ordered", "ol"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: "Code block",
      description: "Monospaced code",
      icon: Code2,
      keywords: ["code", "codeblock", "snippet"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: "Quote",
      description: "Capture a quote",
      icon: Quote,
      keywords: ["quote", "blockquote", "citation"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: "Divider",
      description: "Horizontal rule",
      icon: Minus,
      keywords: ["divider", "hr", "rule", "line"],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: "Image",
      description: "Upload from your device",
      icon: ImageIcon,
      keywords: ["image", "picture", "photo", "upload"],
      command: async ({ editor, range }) => {
        const src = await pickImage();
        if (src) editor.chain().focus().deleteRange(range).setImage({ src }).run();
        else editor.chain().focus().deleteRange(range).run();
      },
    },
  ];
}

export interface SlashMenuState {
  items: SlashItem[];
  index: number;
  execute: (item: SlashItem) => void;
  rect: { top: number; left: number; bottom: number };
}

interface SlashCallbacks {
  setMenu: Dispatch<SetStateAction<SlashMenuState | null>>;
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const buildSlashExtension = () =>
  Extension.create<{ callbacks: SlashCallbacks | null }>({
    name: "slashCommand",

    addOptions() {
      return { callbacks: null };
    },

    addProseMirrorPlugins() {
      const { callbacks } = this.options;
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          startOfLine: true,
          allowSpaces: true,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return buildItems().filter((item) => item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q)));
          },
          command: ({ editor, range, props }) => {
            (props as SlashItem).command({ editor, range });
          },
          render: () => ({
            onStart: (props) => {
              const rect = props.clientRect?.();
              if (!rect || !callbacks) return;
              callbacks.setMenu({
                items: props.items as SlashItem[],
                index: 0,
                execute: (item) => props.command(item),
                rect: { top: rect.top, left: rect.left, bottom: rect.bottom },
              });
            },
            onUpdate: (props) => {
              const rect = props.clientRect?.();
              if (!rect || !callbacks) return;
              callbacks.setMenu((prev) =>
                prev ? { ...prev, items: props.items as SlashItem[], index: 0, rect: { top: rect.top, left: rect.left, bottom: rect.bottom } } : prev,
              );
            },
            onExit: () => {
              callbacks?.setMenu(null);
            },
            onKeyDown: ({ event }) => {
              return callbacks ? callbacks.onKeyDown(event) : false;
            },
          }),
        }),
      ];
    },
  });

/** Wires the suggestion plugin to React state and renders the popup. */
export function useSlashCommand() {
  const [menu, setMenu] = useState<SlashMenuState | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;

  const extension = useMemo(() => {
    const callbacks: SlashCallbacks = {
      setMenu,
      onKeyDown: (event) => {
        const state = menuRef.current;
        if (!state) return false;
        if (event.key === "ArrowDown") {
          setMenu({ ...state, index: (state.index + 1) % state.items.length });
          return true;
        }
        if (event.key === "ArrowUp") {
          setMenu({ ...state, index: (state.index - 1 + state.items.length) % state.items.length });
          return true;
        }
        if (event.key === "Enter") {
          state.execute(state.items[state.index]);
          return true;
        }
        if (event.key === "Escape") {
          setMenu(null);
          return true;
        }
        return false;
      },
    };
    return buildSlashExtension().configure({ callbacks });
  }, []);

  const popup = menu ? (
    <SlashMenuPopup key="slash-menu" menu={menu} onSelect={(item) => menu.execute(item)} onHover={(index) => setMenu({ ...menu, index })} />
  ) : null;

  return { extension, popup };
}

function SlashMenuPopup({ menu, onSelect, onHover }: { menu: SlashMenuState; onSelect: (item: SlashItem) => void; onHover: (index: number) => void }) {
  const style = { top: `${menu.rect.bottom + 6}px`, left: `${menu.rect.left}px` };
  return (
    <div className="slash-menu bg-popover text-popover-foreground" style={style}>
      <div className="slash-menu-heading">Blocks</div>
      {menu.items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            className={cn("slash-menu-item", index === menu.index && "is-active")}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(item)}
          >
            <span className="slash-menu-icon">
              <Icon size={14} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-medium">{item.title}</span>
              <span className="text-muted-foreground block truncate text-[10px]">{item.description}</span>
            </span>
            <GripVertical size={12} className="text-muted-foreground/30 shrink-0" aria-hidden="true" />
          </button>
        );
      })}
      {menu.items.length === 0 && <div className="slash-menu-empty">No matching blocks</div>}
    </div>
  );
}
