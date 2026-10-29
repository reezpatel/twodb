import { MessageMarkdown } from "@/components/message-markdown";
import { CodeChatClear } from "@/components/blocks/code/code-chat/code-chat-clear";
import {
  CodeChatCompaction,
  CodeChatCompactionContent,
  CodeChatCompactionHeader,
  CodeChatCompactionMeta,
} from "@/components/blocks/code/code-chat/code-chat-compaction";
import { CodeChatError } from "@/components/blocks/code/code-chat/code-chat-error";
import { CodeChatBtw, CodeChatBtwClosed } from "@/components/blocks/code/code-chat/code-chat-btw";
import { CodeChatSubagent } from "@/components/blocks/code/code-chat/code-chat-subagent";
import { fmtTokens } from "@/lib/format-tokens";

export interface CompactionMeta {
  summary: string;
  firstKeptMessageId: string;
  tokensBefore: number;
  estimatedTokensAfter: number;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  costUsd: number | null;
  model: string;
  connectionId: string;
  instructions: string | null;
}

export interface ClearMeta {
  clearedMessages?: number;
}

export interface ErrorMeta {
  attempt?: number;
  maxRetries?: number;
  delayMs?: number;
  status?: number;
  final?: boolean;
}

/** A persisted compaction: everything above was summarized away and the summary is replayed as context from here on. */
export function ChatCompaction({ meta }: { meta: CompactionMeta }) {
  const cost = meta.costUsd !== null && meta.costUsd > 0 ? (meta.costUsd < 0.01 ? `$${meta.costUsd.toFixed(4)}` : `$${meta.costUsd.toFixed(2)}`) : null;
  return (
    <CodeChatCompaction>
      <CodeChatCompactionHeader tokens={`${fmtTokens(meta.tokensBefore)} → ${fmtTokens(meta.estimatedTokensAfter)} tokens`} model={meta.model} />
      <CodeChatCompactionContent>
        <MessageMarkdown text={meta.summary} />
        <CodeChatCompactionMeta>
          <span title="Summarization call input tokens">↑ {fmtTokens(meta.usage.inputTokens)}</span>
          <span title="Summarization call output tokens (summary size)">↓ {fmtTokens(meta.usage.outputTokens)}</span>
          <span title="Cached input tokens">⚡ {fmtTokens(meta.usage.cachedTokens)}</span>
          {cost && <span title="Summarization call cost">{cost}</span>}
        </CodeChatCompactionMeta>
      </CodeChatCompactionContent>
    </CodeChatCompaction>
  );
}

/** A persisted clear: a hard context cutoff — the transcript above stays visible but is never sent to the model again. */
export function ChatClear({ meta }: { meta: ClearMeta | null }) {
  const dropped = typeof meta?.clearedMessages === "number" && meta.clearedMessages > 0 ? ` — ${meta.clearedMessages} messages dropped from context` : "";
  return <CodeChatClear>{`cleared${dropped}`}</CodeChatClear>;
}

/** Provider failure / retry attempt — UI-only, never sent to the model. */
export function ChatError({ meta, content, createdAt }: { meta: ErrorMeta | null; content: string; createdAt: string | number | Date }) {
  const retrying = !meta?.final && meta?.attempt != null;
  const title = retrying
    ? `Request failed — retry ${meta!.attempt}/${meta!.maxRetries ?? "?"}${meta?.delayMs != null ? ` in ${Math.max(1, Math.round(meta.delayMs / 1000))}s` : ""}`
    : "Agent run failed";
  return (
    <CodeChatError tone={retrying ? "retrying" : "failed"} title={title} time={new Date(createdAt).toLocaleTimeString()}>
      {content}
    </CodeChatError>
  );
}

export function ChatBtw({ agentName, closed, preview, onOpen }: { agentName?: string; closed?: boolean; preview?: string; onOpen?: () => void }) {
  return <CodeChatBtw agentName={agentName ?? "Agent"} closed={closed} preview={preview} onClick={onOpen} />;
}

export function ChatBtwDone({ sendToMain }: { sendToMain?: boolean }) {
  return <CodeChatBtwClosed>thread closed{sendToMain ? " — summary sent to main" : ""}</CodeChatBtwClosed>;
}

export function ChatSubagent({ name, agentType, prompt, onOpen }: { name?: string; agentType?: string; prompt?: string; onOpen?: () => void }) {
  return <CodeChatSubagent name={name ?? "agent"} agentType={agentType} prompt={prompt} onClick={onOpen} />;
}
