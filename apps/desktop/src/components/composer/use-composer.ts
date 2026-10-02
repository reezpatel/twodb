import { useEffect, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import Mention from "@tiptap/extension-mention";
import PasteChip, { type PasteRef } from "./paste-chip";
import { searchCommands } from "./composer-commands";
import { searchFiles } from "./search-files";
import { suggestionRenderer, type SuggestionItem } from "./suggestion-popup";

// Mention's default pluginKey is a single module-level instance shared by all
// Mention-derived extensions — distinct keys are required for two mentions.
const fileMentionKey = new PluginKey("fileMention");
const commandMentionKey = new PluginKey("commandMention");

interface ComposerOptions {
  /** File paths for @ suggestions — null disables the file mention entirely (assistant chats). */
  files: string[] | null;
  disabled: boolean;
  placeholder: string;
  onDraft: (text: string) => void;
  /** Returns true when the message was dispatched — the composer clears itself. */
  onSend: (content: string) => boolean;
}

export function useComposer({ files, disabled, placeholder, onDraft, onSend }: ComposerOptions) {
  const filesRef = useRef(files);
  filesRef.current = files;
  const sendRef = useRef(onSend);
  sendRef.current = onSend;
  const draftRef = useRef(onDraft);
  draftRef.current = onDraft;
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;
  const editorRef = useRef<Editor | null>(null);
  const popupOpenRef = useRef(false);
  const pastesRef = useRef(new Map<string, PasteRef>());
  const pasteCountRef = useRef(0);

  // Chips render as labels; the wire gets the full content expanded back in.
  const expandPastes = (text: string) =>
    text.replace(/Paste #(\d+): \d+ lines/g, (match, id: string) => {
      const paste = pastesRef.current.get(id);
      return paste ? `\n\n--- paste #${paste.id} (${paste.lines} lines) ---\n${paste.content}\n--- end paste ---` : match;
    });

  const submit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = editor.getText().trim();
    if (!text || sendRef.current(expandPastes(text))) editor.commands.clearContent(true);
  };

  const editor = useEditor({
    // Extension order matters: tiptap reverses declaration order into plugin
    // order, so the suggestion plugins (mentions, declared last) see keys
    // first, then composerSubmit's Enter, and StarterKit's own Enter last.
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
      PasteChip,
      Extension.create({
        name: "composerSubmit",
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (popupOpenRef.current) return true;
              submit();
              return true;
            },
          };
        },
      }),
      ...(files !== null
        ? [
            Mention.extend({
              name: "fileMention",
              renderText: ({ node }) => `@${(node.attrs.label as string | undefined) ?? node.attrs.id}`,
            }).configure({
              HTMLAttributes: { class: "rounded-md py-[0.1rem] px-1.5 font-medium bg-muted font-mono text-[13px] text-foreground" },
              suggestion: {
                char: "@",
                pluginKey: fileMentionKey,
                items: ({ query }) =>
                  searchFiles(filesRef.current ?? [], query).map((path) => ({ id: path, label: path, folder: path.endsWith("/") }) satisfies SuggestionItem),
                render: () => suggestionRenderer(popupOpenRef),
              },
            }),
          ]
        : []),
      Mention.extend({
        name: "commandMention",
        renderText: ({ node }) => `/${(node.attrs.label as string | undefined) ?? node.attrs.id}`,
      }).configure({
        HTMLAttributes: { class: "rounded-md py-[0.1rem] px-1.5 font-medium bg-primary/15 text-primary" },
        suggestion: {
          char: "/",
          pluginKey: commandMentionKey,
          startOfLine: true,
          items: ({ query }) => searchCommands(query).map((c) => ({ id: c.id, label: c.label, hint: c.description, group: c.group }) satisfies SuggestionItem),
          render: () => suggestionRenderer(popupOpenRef),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "cp-composer font-mono text-[0.775rem] leading-[1.55] outline-none min-h-11 max-h-[40vh] overflow-y-auto pt-2.5 px-3.5 pb-1.5 caret-foreground",
        "aria-label": "Message",
        spellcheck: "true",
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const lines = text ? text.split("\n").length : 0;
        if (lines <= 2) return false;
        event.preventDefault();
        const id = String((pasteCountRef.current += 1));
        pastesRef.current.set(id, { id, content: text, lines });
        editorRef.current?.commands.insertContent({ type: "pasteChip", attrs: { id, label: `Paste #${id}: ${lines} lines` } });
        return true;
      },
    },
    onUpdate: ({ editor: current }) => draftRef.current(current.getText()),
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return { editor, submit, pastes: pastesRef };
}
