import { createContext, useContext } from "react";
import type { CodeChatDiffLine, CodeChatDiffView } from "./code-chat-diff-utils";

export interface CodeChatDiffContextValue {
  text: string;
  lines: CodeChatDiffLine[];
  view: CodeChatDiffView;
  setView: (view: CodeChatDiffView) => void;
}

export const CodeChatDiffContext = createContext<CodeChatDiffContextValue | null>(null);

export function useCodeChatDiff() {
  const context = useContext(CodeChatDiffContext);
  if (!context) throw new Error("CodeChatDiff parts must be used within <CodeChatDiff>");
  return context;
}
