import { Palette, Paperclip } from "lucide-react";
import { MessageMarkdown } from "@/components/message-markdown";
import { CodeChatMessage, CodeChatSkill, CodeChatSkills } from "./code-chat-message";
import { CodeChatThinking, CodeChatThinkingBlock, CodeChatThinkingContent, CodeChatThinkingHeader } from "./code-chat-thinking";
import { CodeChatTool, CodeChatToolChip, CodeChatToolContent, CodeChatToolHeader, CodeChatToolNote, CodeChatToolOutput } from "./code-chat-tool";
import { CodeChatCompaction, CodeChatCompactionContent, CodeChatCompactionHeader, CodeChatCompactionMeta } from "./code-chat-compaction";
import { CodeChatFileChange } from "./code-chat-file-change";
import { CodeChatFileContent } from "./code-chat-file-content";
import { CodeChatCopyButton } from "./code-chat-copy-button";
import { CodeChatDiff, CodeChatDiffContent, CodeChatDiffViewToggle } from "./code-chat-diff";
import { CodeChatClear } from "./code-chat-clear";
import {
  CodeChatSystemPrompt,
  CodeChatSystemPromptContent,
  CodeChatSystemPromptHeader,
  CodeChatSystemPromptText,
  CodeChatSystemPromptWarning,
} from "./code-chat-system-prompt";
import { LONG_MESSAGE, LONG_THINKING } from "./code-chat-full.fixtures";
import { Row } from "./code-chat-full.parts";

const WRITTEN_FILE = `export function fmtTokens(n: number) {
  if (n >= 1_000_000) return \`\${(n / 1_000_000).toFixed(1)}M\`;
  if (n >= 1_000) return \`\${(n / 1_000).toFixed(1)}k\`;
  return String(n);
}
`;

export function SystemPromptRow() {
  return (
    <Row>
      <CodeChatSystemPrompt>
        <CodeChatSystemPromptHeader summary="3 skills · 2 instructions · 1 MCP server" />
        <CodeChatSystemPromptContent>
          <CodeChatSystemPromptWarning>MCP unreachable: github (connection refused)</CodeChatSystemPromptWarning>
          <CodeChatSystemPromptText>
            {
              "You are a coding agent working in /repo.\n\n[Skills]\n- review\n- commit\n- release\n\n[Instructions]\n- Keep routes free of styling.\n- Prefer compound components."
            }
          </CodeChatSystemPromptText>
        </CodeChatSystemPromptContent>
      </CodeChatSystemPrompt>
    </Row>
  );
}

export function RoundOne() {
  return (
    <>
      <Row>
        <CodeChatMessage variant="user">
          <CodeChatSkills>
            <CodeChatSkill>review</CodeChatSkill>
            <CodeChatSkill>commit</CodeChatSkill>
          </CodeChatSkills>
          <MessageMarkdown
            text={"Move the footer widgets into blocks and keep the routes free of styling. The spec is attached: [footer-spec.pdf](twodb://local/3f9a1c2e)"}
          />
        </CodeChatMessage>
      </Row>
      <Row>
        <CodeChatThinkingBlock defaultOpen={false}>
          <CodeChatThinkingHeader duration="took 12s" />
          <CodeChatThinkingContent>
            <MessageMarkdown text={LONG_THINKING} />
          </CodeChatThinkingContent>
        </CodeChatThinkingBlock>
      </Row>
      <Row>
        <CodeChatToolChip icon={<Paperclip />} label="read-asset" detail="read 3f9a1c2e… from local" />
      </Row>
      <Row>
        <CodeChatTool defaultOpen>
          <CodeChatToolHeader label="$" preview="rg -n 'ChatFooter' apps/desktop/src" duration="took 1s" expandable />
          <CodeChatToolContent>
            <CodeChatToolOutput>
              {
                "routes/code/chat/chat-conversation.tsx:805:  <ChatFooter stats={stats} />\nroutes/code/chat/footer/chat-footer.tsx:15:export function ChatFooter({"
              }
            </CodeChatToolOutput>
          </CodeChatToolContent>
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatDiff
          diff={
            "@@ -52,3 +52,4 @@\n function useSidebarGit() {\n-  const status = useGitStatus(directoryId);\n+  const status = useGitStatus(directoryId);\n+  const groups = groupByFolder(files);\n }\n"
          }
        >
          <CodeChatFileChange kind="updated" path="src/routes/code/sidebar/sidebar.tsx" additions={2} deletions={1} actions={<CodeChatDiffViewToggle />}>
            <CodeChatDiffContent />
          </CodeChatFileChange>
        </CodeChatDiff>
      </Row>
      <Row>
        <CodeChatFileChange path="src/lib/format-tokens.ts" additions={5} actions={<CodeChatCopyButton value={WRITTEN_FILE} label="Copy file content" />}>
          <CodeChatFileContent content={WRITTEN_FILE} language="typescript" />
        </CodeChatFileChange>
      </Row>
      <Row>
        <CodeChatFileChange open path="src/routes/code/sidebar/use-sidebar-git.ts" additions={74}>
          <CodeChatFileContent content={WRITTEN_FILE} language="typescript" />
        </CodeChatFileChange>
      </Row>
      <Row>
        <CodeChatToolChip icon={<Palette />} label="update_canvas" detail="· Footer architecture" />
      </Row>
      <Row>
        <CodeChatToolNote icon={<Paperclip />}>Plan Updated</CodeChatToolNote>
      </Row>
      <Row>
        <CodeChatMessage>
          <MessageMarkdown text={LONG_MESSAGE} />
        </CodeChatMessage>
      </Row>
    </>
  );
}

export function CompactionAndClear() {
  return (
    <>
      <Row>
        <CodeChatCompaction>
          <CodeChatCompactionHeader tokens="84k → 12k tokens" model="claude-sonnet" />
          <CodeChatCompactionContent>
            <MessageMarkdown
              text={
                "Summary of the earlier conversation:\n\n- migrated the app shell, nav rail and side nav to blocks\n- moved the footer widgets into `blocks/footer/`\n- the transcript is still on the old markup"
              }
            />
            <CodeChatCompactionMeta>
              <span title="Input tokens">↑ 84k</span>
              <span title="Output tokens">↓ 2k</span>
              <span title="Cost">$0.21</span>
            </CodeChatCompactionMeta>
          </CodeChatCompactionContent>
        </CodeChatCompaction>
      </Row>
      <Row>
        <CodeChatClear>cleared — 42 messages dropped from context</CodeChatClear>
      </Row>
      <Row dimmed>
        <CodeChatMessage variant="user">
          <MessageMarkdown text="A message from before the context was cleared (dimmed)." />
        </CodeChatMessage>
      </Row>
      <Row dimmed>
        <CodeChatThinking>
          <MessageMarkdown text="Thinking from before the clear, also dimmed." />
        </CodeChatThinking>
      </Row>
      <Row dimmed>
        <CodeChatMessage>
          <MessageMarkdown text="And the assistant reply that followed it." />
        </CodeChatMessage>
      </Row>
    </>
  );
}
