import type { ComponentProps } from "react";
import { Bot, ChevronDown } from "lucide-react";
import { CodeChatSessionLink } from "./code-chat-session-link";

type CodeChatSubagentProps = Omit<ComponentProps<typeof CodeChatSessionLink>, "icon" | "title" | "meta" | "description" | "trailing"> & {
  name: string;
  agentType?: string;
  prompt?: string;
};

export function CodeChatSubagent({ name, agentType, prompt, ...props }: CodeChatSubagentProps) {
  return <CodeChatSessionLink icon={<Bot />} title={`subagent — ${name}`} meta={agentType} description={prompt} trailing={<ChevronDown />} {...props} />;
}
