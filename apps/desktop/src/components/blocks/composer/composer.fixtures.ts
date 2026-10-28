import { useState } from "react";
import type { ComposerCommand } from "./composer-commands";
import { useComposer } from "./use-composer";

export const MOCK_FILES = [
  "src/",
  "src/components/",
  "src/components/blocks/",
  "src/components/blocks/composer/use-composer.ts",
  "src/components/blocks/composer/composer-editor.tsx",
  "src/components/blocks/code/code-chat-footer/code-chat-footer.tsx",
  "src/components/blocks/model-picker/model-picker.tsx",
  "src/lib/url-registry.ts",
  "src/lib/shortcut-keys.ts",
  "src/routes/code/code-scene.tsx",
  "src/routes/code/chat/chat-panel.tsx",
  "package.json",
  "README.md",
];

export const MOCK_COMMANDS: ComposerCommand[] = [
  {
    id: "skill:review",
    label: "review",
    description: "Review the current diff",
    group: "Skills",
    kind: "skill",
    content: "Review the diff for bugs, style and missing tests.",
  },
  {
    id: "skill:commit",
    label: "commit",
    description: "Write a conventional commit message",
    group: "Skills",
    kind: "skill",
    content: "Write a conventional commit message for the staged changes.",
  },
  { id: "cmd:compact", label: "compact", description: "Summarize older history — keeps recent context", group: "Commands" },
  { id: "cmd:clear", label: "clear", description: "Drop prior context — fresh start without a new session", group: "Commands" },
  { id: "cmd:btw", label: "btw", description: "Side question to another agent — opens a /btw thread", group: "Commands" },
];

type MockComposerOptions = {
  placeholder?: string;
  disabled?: boolean;
  files?: string[] | null;
  /** Return false to keep the draft. Defaults to accepting every message. */
  onSend?: (content: string, skills: { name: string; content: string }[]) => boolean;
  onSkillClick?: (skill: { name: string; content: string }) => void;
};

/** Story helper: a real Tiptap composer wired to the mock files and commands. */
export function useMockComposer({
  placeholder = "Ask the agent… — @ files, / commands",
  disabled = false,
  files = MOCK_FILES,
  onSend,
  onSkillClick,
}: MockComposerOptions = {}) {
  const [draft, setDraft] = useState("");
  const composer = useComposer({
    files,
    commands: MOCK_COMMANDS,
    disabled,
    placeholder,
    onDraft: setDraft,
    onSkillClick,
    onSend: (content, skills) => onSend?.(content, skills) ?? true,
  });
  return { ...composer, draft };
}
