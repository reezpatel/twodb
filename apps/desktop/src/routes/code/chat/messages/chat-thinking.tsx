import { MessageMarkdown } from "@/components/message-markdown";
import {
  CodeChatThinking,
  CodeChatThinkingBlock,
  CodeChatThinkingContent,
  CodeChatThinkingHeader,
} from "@/components/blocks/code/code-chat/code-chat-thinking";
import { fmtDuration, useElapsed } from "./use-elapsed";

interface ChatThinkingProps {
  text: string;
  live: boolean;
  durationMs?: number;
  startedAt?: number;
  /** Show the reasoning inline; hidden renders a collapsed header instead. */
  visible: boolean;
}

export function ChatThinking({ text, live, durationMs, startedAt, visible }: ChatThinkingProps) {
  const elapsed = useElapsed(live ? startedAt : undefined);
  const duration = live ? elapsed : durationMs ? `took ${fmtDuration(durationMs)}` : undefined;

  if (visible) {
    return (
      <CodeChatThinking>
        <MessageMarkdown text={text} />
      </CodeChatThinking>
    );
  }

  return (
    <CodeChatThinkingBlock>
      <CodeChatThinkingHeader live={live} duration={duration} />
      <CodeChatThinkingContent>
        <MessageMarkdown text={text} />
      </CodeChatThinkingContent>
    </CodeChatThinkingBlock>
  );
}
