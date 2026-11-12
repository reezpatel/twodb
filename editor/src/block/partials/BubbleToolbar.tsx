import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Check, ChevronDown, Code, Highlighter, Italic, Link as LinkIcon, Strikethrough, Underline, X } from "lucide-react";

const TURN_INTO: { id: string; label: string; active: (e: Editor) => boolean; run: (e: Editor) => void }[] = [
  { id: "p", label: "Text", active: (e) => e.isActive("paragraph"), run: (e) => e.chain().focus().setParagraph().run() },
  { id: "h1", label: "Heading 1", active: (e) => e.isActive("heading", { level: 1 }), run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { id: "h2", label: "Heading 2", active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { id: "h3", label: "Heading 3", active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { id: "ul", label: "Bulleted list", active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: "ol", label: "Numbered list", active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: "todo", label: "To-do list", active: (e) => e.isActive("taskList"), run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: "quote", label: "Quote", active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: "code", label: "Code block", active: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

function Btn(p: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={p.label}
      aria-label={p.label}
      className={`twodb-bubble-btn ${p.active ? "is-active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={p.onClick}
    >
      {p.children}
    </button>
  );
}

/** Formatting toolbar shown over a text selection (AFFiNE format bar). */
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [mode, setMode] = useState<"tools" | "link" | "turn">("tools");
  const [href, setHref] = useState("");
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      block: TURN_INTO.find((t) => t.active(e))?.label ?? "Text",
    }),
  });
  const c = () => editor.chain().focus();
  const applyLink = () => {
    const url = href.trim();
    if (!url) c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run();
    setMode("tools");
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8, onHide: () => setMode("tools") }}
      shouldShow={({ editor: e, state, from, to }) => {
        if (!e.isEditable || from === to) return false;
        const sel = state.selection as { node?: unknown };
        if (sel.node) return false; // node selections (images, databases) have their own UI
        return !e.isActive("codeBlock");
      }}
      className="twodb-bubble"
    >
      {mode === "link" ? (
        <div className="twodb-bubble-link">
          <input
            autoFocus
            value={href}
            placeholder="Paste or type a link"
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setMode("tools");
            }}
          />
          <Btn label="Apply" onClick={applyLink}>
            <Check size={14} />
          </Btn>
          <Btn label="Cancel" onClick={() => setMode("tools")}>
            <X size={14} />
          </Btn>
        </div>
      ) : mode === "turn" ? (
        <div className="twodb-menu twodb-bubble-turn">
          {TURN_INTO.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`twodb-menu-item ${t.label === s.block ? "is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                t.run(editor);
                setMode("tools");
              }}
            >
              <span className="twodb-menu-title">{t.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="twodb-bubble-row">
          <button type="button" className="twodb-bubble-btn twodb-bubble-turn-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setMode("turn")}>
            {s.block} <ChevronDown size={12} />
          </button>
          <span className="twodb-bubble-sep" />
          <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
            <Bold size={14} />
          </Btn>
          <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
            <Italic size={14} />
          </Btn>
          <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}>
            <Underline size={14} />
          </Btn>
          <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
            <Strikethrough size={14} />
          </Btn>
          <Btn label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}>
            <Code size={14} />
          </Btn>
          <Btn label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()}>
            <Highlighter size={14} />
          </Btn>
          <span className="twodb-bubble-sep" />
          <Btn
            label="Link"
            active={s.link}
            onClick={() => {
              setHref((editor.getAttributes("link").href as string) ?? "");
              setMode("link");
            }}
          >
            <LinkIcon size={14} />
          </Btn>
        </div>
      )}
    </BubbleMenu>
  );
}
