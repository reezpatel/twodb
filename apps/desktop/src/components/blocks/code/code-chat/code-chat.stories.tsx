import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Paperclip, Palette, Terminal } from "lucide-react";
import { MessageMarkdown } from "@/components/message-markdown";
import { CodeChatShell } from "./code-chat-shell";
import { CodeChatJumpButton, CodeChatThread, CodeChatThreadFooter, CodeChatThreadHeader, CodeChatThreadRow } from "./code-chat-thread";
import { CodeChatFooter, CodeChatReconnecting, CodeChatStatusBar } from "../code-chat-footer/code-chat-footer";
import { MockResources, MockUsage } from "../code-chat-footer/code-chat-footer.fixtures";
import { useMockComposer } from "../../composer/composer.fixtures";
import { CodeChatComposer, CodeChatComposerActions, CodeChatComposerInput, CodeChatComposerSpacer } from "../code-chat-footer/code-chat-composer";
import { CodeChatComposerAction } from "../code-chat-footer/code-chat-composer-action";
import { CodeChatComposerSend } from "../code-chat-footer/code-chat-composer-send";
import { CodeChatMessage, CodeChatSkill, CodeChatSkills } from "./code-chat-message";
import { CodeChatThinking, CodeChatThinkingBlock, CodeChatThinkingContent, CodeChatThinkingHeader } from "./code-chat-thinking";
import {
  CodeChatTool,
  CodeChatToolChip,
  CodeChatToolContent,
  CodeChatToolDiff,
  CodeChatToolHeader,
  CodeChatToolNote,
  CodeChatToolOutput,
} from "./code-chat-tool";
import { CodeChatCompaction, CodeChatCompactionContent, CodeChatCompactionHeader, CodeChatCompactionMeta } from "./code-chat-compaction";
import { CodeChatClear } from "./code-chat-clear";
import {
  CodeChatSystemPrompt,
  CodeChatSystemPromptContent,
  CodeChatSystemPromptHeader,
  CodeChatSystemPromptText,
  CodeChatSystemPromptWarning,
} from "./code-chat-system-prompt";
import { CodeChatDiff, CodeChatDiffContent } from "./code-chat-diff";
import { CodeChatError } from "./code-chat-error";
import { CodeChatSubagent } from "./code-chat-subagent";
import { CodeChatBtw, CodeChatBtwClosed } from "./code-chat-btw";
import { CodeChatLive, CodeChatProgress } from "./code-chat-live";

const meta = {
  title: "Blocks/Code/CodeChat",
  component: CodeChatShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CodeChatShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const DIFF = `--- a/src/lib/url-registry.ts
+++ b/src/lib/url-registry.ts
@@ -1,3 +1,4 @@
 const APPS_ROOT = "/apps";
+const SETTINGS_ROOT = \`\${APPS_ROOT}/settings\`;
 export const urls = {`;

function Frame({ children }: { children: ReactNode }) {
  return <div className="bg-background mx-auto flex h-screen max-w-5xl flex-col">{children}</div>;
}

function Row({ children, dimmed }: { children: ReactNode; dimmed?: boolean }) {
  return <CodeChatThreadRow dimmed={dimmed}>{children}</CodeChatThreadRow>;
}

function Messages() {
  return (
    <>
      <Row>
        <CodeChatMessage variant="user">
          <CodeChatSkills>
            <CodeChatSkill>review</CodeChatSkill>
            <CodeChatSkill>commit</CodeChatSkill>
          </CodeChatSkills>
          <MessageMarkdown text="Move the footer widgets into blocks and keep the routes free of styling." />
        </CodeChatMessage>
      </Row>
      <Row>
        <CodeChatMessage>
          <MessageMarkdown
            text={
              "Done. The widgets now live in `blocks/footer/`:\n\n- `footer-spaces.tsx`\n- `footer-usage.tsx`\n- `footer-runner-resources.tsx`\n\n```ts\nexport function FooterBar() {}\n```"
            }
          />
        </CodeChatMessage>
      </Row>
      <Row>
        <CodeChatMessage variant="user" label="Ada">
          <MessageMarkdown text="Custom label for another participant." />
        </CodeChatMessage>
      </Row>
    </>
  );
}

function Tools() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Row>
        <CodeChatTool>
          <CodeChatToolHeader label="$" preview="pnpm --filter @twodb/desktop exec tsc --noEmit" duration="took 4s" expandable />
          <CodeChatToolContent>
            <CodeChatToolOutput>{"No errors found.\nDone in 3.8s"}</CodeChatToolOutput>
          </CodeChatToolContent>
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatTool open={open} onOpenChange={setOpen}>
          <CodeChatToolHeader label="update_file" preview="src/lib/url-registry.ts" duration="took 1s" expandable />
          <CodeChatToolContent>
            <CodeChatToolDiff>
              <CodeChatDiff diff={DIFF}>
                <CodeChatDiffContent />
              </CodeChatDiff>
            </CodeChatToolDiff>
          </CodeChatToolContent>
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatTool failed>
          <CodeChatToolHeader label="$" preview="pnpm test" duration="took 12s" expandable />
          <CodeChatToolContent>
            <CodeChatToolOutput>{"FAIL  src/lib/url-registry.test.ts\n  ✕ builds settings urls (3 ms)"}</CodeChatToolOutput>
          </CodeChatToolContent>
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatTool>
          <CodeChatToolHeader label="$" preview="pnpm build" duration="0:07" running />
        </CodeChatTool>
      </Row>
      <Row>
        <CodeChatToolChip icon={<Palette />} label="update_canvas" detail="· Architecture sketch" />
      </Row>
      <Row>
        <CodeChatToolChip icon={<Paperclip />} label="read-asset" detail="read 3f9a1c2e… from storage" />
      </Row>
      <Row>
        <CodeChatToolNote icon={<Terminal />}>Plan Updated</CodeChatToolNote>
      </Row>
    </>
  );
}

function Notices() {
  return (
    <>
      <Row>
        <CodeChatThinking>
          <MessageMarkdown text="Looking at how the sidebar and the header share state before touching the layout." />
        </CodeChatThinking>
      </Row>
      <Row>
        <CodeChatThinkingBlock>
          <CodeChatThinkingHeader duration="took 8s" />
          <CodeChatThinkingContent>
            <MessageMarkdown text="Collapsed thinking, shown when thinking is hidden globally." />
          </CodeChatThinkingContent>
        </CodeChatThinkingBlock>
      </Row>
      <Row>
        <CodeChatThinkingBlock>
          <CodeChatThinkingHeader live duration="0:03" />
        </CodeChatThinkingBlock>
      </Row>
      <Row>
        <CodeChatCompaction>
          <CodeChatCompactionHeader tokens="84k → 12k tokens" model="claude-sonnet" />
          <CodeChatCompactionContent>
            <MessageMarkdown text="Summary of the earlier conversation: migrated the app shell, nav rail and side nav to blocks." />
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
        <CodeChatMessage>
          <MessageMarkdown text="A message from before the context was cleared (dimmed)." />
        </CodeChatMessage>
      </Row>
      <Row>
        <CodeChatSystemPrompt>
          <CodeChatSystemPromptHeader summary="3 skills · 2 instructions · 1 MCP server" />
          <CodeChatSystemPromptContent>
            <CodeChatSystemPromptWarning>MCP unreachable: github (connection refused)</CodeChatSystemPromptWarning>
            <CodeChatSystemPromptText>{"You are a coding agent working in /repo.\n\n[Skills]\n- review\n- commit"}</CodeChatSystemPromptText>
          </CodeChatSystemPromptContent>
        </CodeChatSystemPrompt>
      </Row>
      <Row>
        <CodeChatError tone="retrying" title="Request failed — retry 2/5 in 8s" time="10:42:07">
          429 rate_limit_exceeded
        </CodeChatError>
      </Row>
      <Row>
        <CodeChatError title="Agent run failed" time="10:43:30">
          provider returned 500: upstream timeout
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
    </>
  );
}

function Composer() {
  const { editor } = useMockComposer();
  return (
    <CodeChatComposer>
      <CodeChatComposerInput editor={editor} />
      <CodeChatComposerActions>
        <CodeChatComposerAction icon={<Paperclip />} label="Attach files" />
        <CodeChatComposerSpacer />
        <CodeChatComposerSend label="Send" />
      </CodeChatComposerActions>
    </CodeChatComposer>
  );
}

function StatusBar() {
  return (
    <CodeChatStatusBar>
      <MockUsage />
      <MockResources />
    </CodeChatStatusBar>
  );
}

function ConversationPreview() {
  const [showJump, setShowJump] = useState(true);
  return (
    <Frame>
      <CodeChatShell>
        <CodeChatThread>
          <div className="h-full overflow-y-auto">
            <CodeChatThreadHeader>scroll up for earlier messages</CodeChatThreadHeader>
            <Messages />
            <Tools />
            <Notices />
            <CodeChatThreadFooter>
              <CodeChatLive>Live · round 3</CodeChatLive>
              <CodeChatTool>
                <CodeChatToolHeader label="$" preview="pnpm build" duration="0:02" running />
              </CodeChatTool>
              <CodeChatMessage>
                <MessageMarkdown text="Building the desktop app now…" />
              </CodeChatMessage>
              <CodeChatProgress>compacting context…</CodeChatProgress>
            </CodeChatThreadFooter>
          </div>
          {showJump ? <CodeChatJumpButton onClick={() => setShowJump(false)} /> : null}
        </CodeChatThread>
        <CodeChatFooter>
          <CodeChatReconnecting />
          <Composer />
          <StatusBar />
        </CodeChatFooter>
      </CodeChatShell>
    </Frame>
  );
}

export const Conversation: Story = {
  render: () => <ConversationPreview />,
};

export const MessageTypes: Story = {
  render: () => (
    <Frame>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Messages />
      </div>
    </Frame>
  ),
};

export const ToolCalls: Story = {
  render: () => (
    <Frame>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tools />
      </div>
    </Frame>
  ),
};

export const NoticesAndLinks: Story = {
  render: () => (
    <Frame>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Notices />
      </div>
    </Frame>
  ),
};

export const Footer: Story = {
  render: () => (
    <Frame>
      <div className="flex-1" />
      <CodeChatFooter>
        <Composer />
        <StatusBar />
      </CodeChatFooter>
    </Frame>
  ),
};

export const FooterWithNotice: Story = {
  render: () => (
    <Frame>
      <div className="flex-1" />
      <CodeChatFooter>
        <CodeChatReconnecting />
        <Composer />
        <StatusBar />
      </CodeChatFooter>
    </Frame>
  ),
};

export const EmptyThread: Story = {
  render: () => (
    <Frame>
      <CodeChatShell>
        <CodeChatThread>
          <Row>
            <CodeChatSystemPrompt>
              <CodeChatSystemPromptHeader summary="2 skills" />
              <CodeChatSystemPromptContent>
                <CodeChatSystemPromptText>{"You are a coding agent working in /repo."}</CodeChatSystemPromptText>
              </CodeChatSystemPromptContent>
            </CodeChatSystemPrompt>
          </Row>
        </CodeChatThread>
        <CodeChatFooter>
          <Composer />
          <StatusBar />
        </CodeChatFooter>
      </CodeChatShell>
    </Frame>
  ),
};
