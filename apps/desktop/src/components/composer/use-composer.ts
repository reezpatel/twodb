import { useEffect, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import Mention from "@tiptap/extension-mention";
import PasteChip, { type PasteRef } from "./paste-chip";
import SkillChip from "./skill-chip";
import { searchCommands, isSkillCommand, type ComposerCommand } from "./composer-commands";
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
  /** Slash-command palette — code chat passes its own list with /compact. */
  commands?: ComposerCommand[];
  /** Resolves skill content lazily (repo skills fetch on demand); returns null on failure. */
  loadSkillContent?: (label: string) => Promise<string | null>;
  /** Opens the skill-content dialog when a skill chip is clicked (composer + transcript share it). */
  onSkillClick?: (skill: { name: string; content: string }) => void;
  onDraft: (text: string) => void;
  /** Returns true when the message was dispatched — the composer clears itself. */
  onSend: (content: string, skills: { name: string; content: string }[]) => boolean;
}

export function useComposer({ files, disabled, placeholder, commands, onSkillClick, loadSkillContent, onDraft, onSend }: ComposerOptions) {
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
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
  const skillsRef = useRef(new Map<string, { name: string; content: string }>());
  const skillClickRef = useRef(onSkillClick);
  skillClickRef.current = onSkillClick;
  const loadSkillRef = useRef(loadSkillContent);
  loadSkillRef.current = loadSkillContent;

  // Chips render as labels; the wire gets the full content expanded back in.
  const expandPastes = (text: string) =>
    text.replace(/Paste #(\d+): \d+ lines/g, (match, id: string) => {
      const paste = pastesRef.current.get(id);
      return paste ? `\n\n--- paste #${paste.id} (${paste.lines} lines) ---\n${paste.content}\n--- end paste ---` : match;
    });

  // Skill chips expand to <skill> blocks in the wire message; the collected
  // refs ride meta.skills so the transcript can render chips again.
  const expandSkills = (text: string): { text: string; skills: { name: string; content: string }[] } => {
    const skills: { name: string; content: string }[] = [];
    const out = text.replace(/\/([\w][\w.-]*)/g, (match, name: string) => {
      const skill = skillsRef.current.get(name);
      if (!skill) return match;
      skills.push(skill);
      return `<skill name="${name}">\n${skill.content}\n</skill>`;
    });
    return { text: out, skills };
  };

  const submit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const raw = editor.getText().trim();
    if (!raw) return;
    const { text, skills } = expandSkills(expandPastes(raw));
    if (skills.some((s) => !s.content)) return; // repo skill still loading
    if (sendRef.current(text, skills)) editor.commands.clearContent(true);
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
      SkillChip,
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
                // Delete the typed @query before inserting, then place the
                // mention node on the cleaned range.
                command: ({ editor, range, props: item }) => {
                  if (!item) return;
                  editor
                    .chain()
                    .focus()
                    .deleteRange(range)
                    .insertContentAt(range.from, { type: "mention", attrs: { id: item.id, label: item.label } })
                    .run();
                },
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
          items: ({ query }) =>
            searchCommands(query, commandsRef.current).map((c) => ({
              id: c.id,
              label: c.label,
              hint: c.description,
              group: c.group,
              kind: c.kind,
            }) satisfies SuggestionItem),
          // Skill picks insert a chip; commands stay plain text. Both must
          // delete the typed query range first — otherwise "/com" + "/compact"
          // concatenates into "/com/compact".
          command: ({ editor, range, props: item }) => {
            const cmd = commandsRef.current?.find((c) => c.id === item?.id);
            const chain = editor.chain().focus().deleteRange(range);
            if (cmd && isSkillCommand(cmd)) {
              const store = skillsRef.current;
              if (cmd.content) {
                store.set(cmd.label, { name: cmd.label, content: cmd.content });
              } else {
                // Repo skill — content streams in from the runner; the chip is
                // placed immediately and expands with whatever loaded by send.
                store.set(cmd.label, { name: cmd.label, content: "" });
                void loadSkillRef.current?.(cmd.label).then((content) => {
                  if (content) store.set(cmd.label, { name: cmd.label, content });
                });
              }
              chain.insertContent({ type: "skillChip", attrs: { id: cmd.id, label: `/${cmd.label}` } }).run();
            } else if (item) {
              // Trailing space so the suggestion plugin doesn't re-fire on the
              // freshly inserted "/" text.
              chain.insertContent(`/${item.label} `).run();
            }
          },
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
      // Clicking a skill chip opens its content in a dialog (the raw content
      // never renders inline).
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-skill-chip]")) {
          const label = (target.closest("[data-skill-chip]") as HTMLElement).textContent ?? "";
          const name = label.replace(/^\//, "");
          const skill = skillsRef.current.get(name);
          if (skill) skillClickRef.current?.(skill);
          return true;
        }
        return false;
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

  // Live skill content refreshes (edit, directory switch) flow into chips
  // already placed in the draft — expansion always uses the current content.
  useEffect(() => {
    for (const cmd of commandsRef.current ?? []) {
      if (isSkillCommand(cmd)) skillsRef.current.set(cmd.label, { name: cmd.label, content: cmd.content ?? "" });
    }
  }, [commands]);

  return { editor, submit, pastes: pastesRef, skills: skillsRef };
}
