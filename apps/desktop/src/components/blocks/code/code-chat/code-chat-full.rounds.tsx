import { MessageMarkdown } from "@/components/message-markdown";
import { CodeChatMessage } from "./code-chat-message";
import { CodeChatThinking, CodeChatThinkingBlock, CodeChatThinkingContent, CodeChatThinkingHeader } from "./code-chat-thinking";
import { CodeChatTool, CodeChatToolContent, CodeChatToolHeader, CodeChatToolOutput } from "./code-chat-tool";
import { CodeChatError } from "./code-chat-error";
import { CodeChatSubagent } from "./code-chat-subagent";
import { CodeChatBtw, CodeChatBtwClosed } from "./code-chat-btw";
import { CodeChatLive, CodeChatProgress } from "./code-chat-live";
import { LIVE_MESSAGE, LIVE_THINKING, MARKDOWN_SHOWCASE } from "./code-chat-full.fixtures";
import { Row } from "./code-chat-full.parts";

export function RoundTwo() {
  return (
    <>
      <Row>
        <CodeChatMessage variant="user">
          <MessageMarkdown text="Now run the type-check and the tests, and have a reviewer look at the accessibility of the new blocks." />
        </CodeChatMessage>
      </Row>
      <Row>
        <CodeChatThinking>
          <MessageMarkdown text={LIVE_THINKING} />
        </CodeChatThinking>
      </Row>
      <Row>
        <CodeChatTool>
          <CodeChatToolHeader label="$" preview="pnpm --filter @twodb/desktop exec tsc --noEmit" duration="took 4s" expandable />
          <CodeChatToolContent>
            <CodeChatToolOutput>{"No errors found.\nDone in 3.8s"}</CodeChatToolOutput>
          </CodeChatToolContent>
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatTool failed defaultOpen>
          <CodeChatToolHeader label="$" preview="pnpm test" duration="took 12s" expandable />
          <CodeChatToolContent>
            <CodeChatToolOutput>
              {'FAIL  src/lib/url-registry.test.ts\n  ✕ builds settings urls (3 ms)\n\n  Expected: "/apps/settings/llm"\n  Received: "/apps/settings//llm"'}
            </CodeChatToolOutput>
          </CodeChatToolContent>
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatError tone="retrying" title="Request failed — retry 2/5 in 8s" time="10:42:07">
          429 rate_limit_exceeded
        </CodeChatError>
      </Row>
      <Row>
        <CodeChatSubagent name="reviewer" agentType="persona" prompt="Review the diff for accessibility regressions" />
      </Row>
      <Row>
        <CodeChatBtw agentName="Planner" preview="Can we split the shell into smaller blocks?" />
      </Row>
      <Row>
        <CodeChatBtw agentName="Planner" closed preview="Can we split the shell into smaller blocks?" />
      </Row>
      <Row>
        <CodeChatBtwClosed>thread closed — summary sent to main</CodeChatBtwClosed>
      </Row>
      <Row>
        <CodeChatError title="Agent run failed" time="10:43:30">
          provider returned 500: upstream timeout
        </CodeChatError>
      </Row>
      <Row>
        <CodeChatMessage>
          <MessageMarkdown text={MARKDOWN_SHOWCASE} />
        </CodeChatMessage>
      </Row>
    </>
  );
}

export function LiveTail() {
  return (
    <>
      <Row>
        <CodeChatLive>Live · round 3</CodeChatLive>
      </Row>
      <Row>
        <CodeChatThinkingBlock defaultOpen>
          <CodeChatThinkingHeader live duration="0:04" />
          <CodeChatThinkingContent>
            <MessageMarkdown text={LIVE_THINKING} />
          </CodeChatThinkingContent>
        </CodeChatThinkingBlock>
      </Row>
      <Row>
        <CodeChatTool>
          <CodeChatToolHeader label="$" preview="pnpm build" duration="0:02" running />
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatMessage>
          <MessageMarkdown text={LIVE_MESSAGE.slice(0, 120)} />
        </CodeChatMessage>
      </Row>
      <Row>
        <CodeChatProgress>compacting context…</CodeChatProgress>
      </Row>
    </>
  );
}
