import { Code2, History, Terminal, GitCommitHorizontal, SquarePen, Braces } from "lucide-react";

export type ScreenId = "code" | "editor" | "terminal" | "checkpoints" | "changes" | "canvas";

export const TOOL_SCREENS: { id: ScreenId; label: string; icon: typeof Code2 }[] = [
  { id: "code", label: "Chat", icon: Code2 },
  { id: "editor", label: "Editor", icon: Braces },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "checkpoints", label: "Checkpoints", icon: History },
  { id: "changes", label: "Changes", icon: GitCommitHorizontal },
  { id: "canvas", label: "Canvas", icon: SquarePen },
];
