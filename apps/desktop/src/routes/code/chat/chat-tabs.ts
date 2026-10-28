import { Braces, GitBranch, MessageSquare, Palette, Terminal, type LucideIcon } from "lucide-react";
import type { CodePanel } from "@/lib/url-registry";

export type ChatTabId = "chat" | CodePanel;

export const CHAT_TABS: { id: ChatTabId; label: string; icon: LucideIcon }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "editor", label: "Editor", icon: Braces },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "checkpoints", label: "Checkpoints", icon: GitBranch },
  { id: "canvas", label: "Canvas", icon: Palette },
];
