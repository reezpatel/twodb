import { useEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import { useComposer } from "./use-composer";

/** Plain text → editor document: lines become hard breaks inside one paragraph, so getText() round-trips. */
function textToDoc(text: string): JSONContent {
  const content: JSONContent[] = [];
  text.split("\n").forEach((line, index) => {
    if (index > 0) content.push({ type: "hardBreak" });
    if (line) content.push({ type: "text", text: line });
  });
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

interface AnswerEditorOptions {
  /** The text the editor should show. Changes that didn't come from typing (picking an option, going back a step) replace the editor content. */
  value: string;
  onChange: (text: string) => void;
  /** Enter was pressed with text in the editor. */
  onEnter?: () => void;
  /** File paths for @ suggestions. */
  files: string[] | null;
  placeholder: string;
  disabled?: boolean;
}

/** A composer for short free-text answers: @ file mentions only — no / commands, no paste chips. */
export function useAnswerEditor({ value, onChange, onEnter, files, placeholder, disabled = false }: AnswerEditorOptions) {
  const typed = useRef("");

  const { editor } = useComposer({
    files,
    commands: null,
    pasteChips: false,
    disabled,
    placeholder,
    onDraft: (text) => {
      typed.current = text;
      onChange(text);
    },
    onSend: () => {
      onEnter?.();
      return false;
    },
  });

  useEffect(() => {
    if (!editor || value === typed.current) return;
    typed.current = value;
    editor.commands.setContent(textToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  return editor;
}
