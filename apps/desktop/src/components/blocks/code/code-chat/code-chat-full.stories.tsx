import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageMarkdown } from "@/components/message-markdown";
import { CodeChatShell } from "./code-chat-shell";
import { CodeChatJumpButton, CodeChatThread, CodeChatThreadFooter, CodeChatThreadHeader } from "./code-chat-thread";
import { CodeChatMessage, CodeChatSkill, CodeChatSkills } from "./code-chat-message";
import { CodeChatThinking, CodeChatThinkingBlock, CodeChatThinkingContent, CodeChatThinkingHeader } from "./code-chat-thinking";
import { CodeChatTool, CodeChatToolContent, CodeChatToolHeader, CodeChatToolOutput } from "./code-chat-tool";
import { CodeChatError } from "./code-chat-error";
import { CodeChatLive, CodeChatProgress } from "./code-chat-live";
import { CodeChatFooter, CodeChatReconnecting, CodeChatStatusBar } from "../code-chat-footer/code-chat-footer";
import { MockResources, MockUsage } from "../code-chat-footer/code-chat-footer.fixtures";
import { CodeChatComposer, CodeChatComposerActions, CodeChatComposerInput, CodeChatComposerSpacer } from "../code-chat-footer/code-chat-composer";
import { CodeChatComposerAction } from "../code-chat-footer/code-chat-composer-action";
import { CodeChatComposerSend } from "../code-chat-footer/code-chat-composer-send";
import { CodeChatComposerStop } from "../code-chat-footer/code-chat-composer-stop";
import { CodeChatQueue } from "../code-chat-footer/code-chat-queue";
import { useMockComposer } from "../../composer/composer.fixtures";
import { LIVE_MESSAGE, LONG_MESSAGE, LONG_THINKING, MARKDOWN_SHOWCASE, useLiveRound } from "./code-chat-full.fixtures";
import { Row } from "./code-chat-full.parts";
import { CompactionAndClear, RoundOne, SystemPromptRow } from "./code-chat-full.history";
import { LiveTail, RoundTwo } from "./code-chat-full.rounds";

const meta = {
  title: "Blocks/Code/CodeChat/Full",
  component: CodeChatShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CodeChatShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function Frame({ children }: { children: ReactNode }) {
  return <div className="bg-background mx-auto flex h-screen max-w-5xl flex-col">{children}</div>;
}

function Composer({ running = false }: { running?: boolean }) {
  const { editor } = useMockComposer();
  return (
    <CodeChatComposer>
      <CodeChatComposerInput editor={editor} />
      <CodeChatComposerActions>
        <CodeChatComposerAction icon={<Paperclip />} label="Attach files" />
        <CodeChatComposerSpacer />
        {running ? <CodeChatComposerStop /> : <CodeChatComposerSend label="Send" />}
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

function Scroller({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto pb-6">{children}</div>;
}

export const FullSession: Story = {
  render: function FullSessionStory() {
    const [showJump, setShowJump] = useState(true);
    return (
      <Frame>
        <CodeChatShell>
          <CodeChatThread>
            <Scroller>
              <CodeChatThreadHeader>scroll up for earlier messages</CodeChatThreadHeader>
              <SystemPromptRow />
              <RoundOne />
              <CompactionAndClear />
              <RoundTwo />
              <CodeChatThreadFooter>
                <LiveTail />
              </CodeChatThreadFooter>
            </Scroller>
            {showJump ? <CodeChatJumpButton onClick={() => setShowJump(false)} /> : null}
          </CodeChatThread>
          <CodeChatFooter>
            <CodeChatReconnecting />
            <CodeChatQueue items={[{ id: "q1", content: "also add stories for the empty state" }]} onRemove={() => {}} onSendNow={() => {}} />
            <Composer running />
            <StatusBar />
          </CodeChatFooter>
        </CodeChatShell>
      </Frame>
    );
  },
};

function LiveRoundPreview() {
  const round = useLiveRound();
  const [thinkingOpen, setThinkingOpen] = useState(true);

  useEffect(() => {
    if (round.phase === "tool-one") setThinkingOpen(false);
    if (round.phase === "idle") setThinkingOpen(true);
  }, [round.phase]);

  const started = round.phase !== "idle";
  const thinkingDone = started && round.phase !== "thinking";
  const toolOneShown = ["tool-one", "tool-two", "message", "done"].includes(round.phase);
  const toolTwoShown = ["tool-two", "message", "done"].includes(round.phase);
  const messageShown = round.phase === "message" || round.phase === "done";

  return (
    <Frame>
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button size="sm" variant="outline" onClick={round.running ? round.pause : round.start}>
          {round.running ? "Pause" : round.phase === "done" ? "Done" : "Resume"}
        </Button>
        <Button size="sm" variant="outline" onClick={round.restart}>
          Restart round
        </Button>
        <span className="text-muted-foreground text-xs">phase: {round.phase}</span>
      </div>
      <CodeChatShell>
        <CodeChatThread>
          <Scroller>
            <Row>
              <CodeChatMessage variant="user">
                <MessageMarkdown text="Turn the git summary into a block and run the type-check." />
              </CodeChatMessage>
            </Row>
            {started ? (
              <Row>
                <CodeChatThinkingBlock open={thinkingOpen} onOpenChange={setThinkingOpen}>
                  <CodeChatThinkingHeader live={!thinkingDone} duration={thinkingDone ? "took 4s" : undefined} />
                  <CodeChatThinkingContent>
                    <MessageMarkdown text={round.thinking} />
                  </CodeChatThinkingContent>
                </CodeChatThinkingBlock>
              </Row>
            ) : null}
            {toolOneShown ? (
              <Row>
                <CodeChatTool>
                  <CodeChatToolHeader
                    label="update_file"
                    preview="src/routes/code/sidebar/sidebar.tsx"
                    duration={round.phase === "tool-one" ? round.toolOneSeconds : "took 2s"}
                    running={round.phase === "tool-one"}
                    expandable={round.phase !== "tool-one"}
                  />
                  <CodeChatToolContent>
                    <CodeChatToolOutput>{"updated src/routes/code/sidebar/sidebar.tsx"}</CodeChatToolOutput>
                  </CodeChatToolContent>
                </CodeChatTool>
              </Row>
            ) : null}
            {toolTwoShown ? (
              <Row>
                <CodeChatTool>
                  <CodeChatToolHeader
                    label="$"
                    preview="pnpm exec tsc --noEmit"
                    duration={round.phase === "tool-two" ? round.toolTwoSeconds : "took 3s"}
                    running={round.phase === "tool-two"}
                    expandable={round.phase !== "tool-two"}
                  />
                  <CodeChatToolContent>
                    <CodeChatToolOutput>{"No errors found.\nDone in 2.9s"}</CodeChatToolOutput>
                  </CodeChatToolContent>
                </CodeChatTool>
              </Row>
            ) : null}
            {messageShown ? (
              <Row>
                <CodeChatMessage>
                  <MessageMarkdown text={round.message} />
                </CodeChatMessage>
              </Row>
            ) : null}
            {round.running ? (
              <CodeChatThreadFooter>
                <CodeChatLive>Live · round 1</CodeChatLive>
              </CodeChatThreadFooter>
            ) : null}
          </Scroller>
        </CodeChatThread>
        <CodeChatFooter>
          <Composer running={round.running} />
          <StatusBar />
        </CodeChatFooter>
      </CodeChatShell>
    </Frame>
  );
}

export const LiveRound: Story = {
  render: () => <LiveRoundPreview />,
};

export const LiveStates: Story = {
  render: () => (
    <Frame>
      <Scroller>
        <CodeChatThreadHeader>thinking, streaming</CodeChatThreadHeader>
        <Row>
          <CodeChatLive>Live · thinking</CodeChatLive>
        </Row>
        <Row>
          <CodeChatThinkingBlock defaultOpen>
            <CodeChatThinkingHeader live duration="0:07" />
            <CodeChatThinkingContent>
              <MessageMarkdown text={LONG_THINKING.slice(0, 520)} />
            </CodeChatThinkingContent>
          </CodeChatThinkingBlock>
        </Row>
        <CodeChatThreadHeader>tool running</CodeChatThreadHeader>
        <Row>
          <CodeChatTool>
            <CodeChatToolHeader label="$" preview="pnpm build" duration="0:12" running />
          </CodeChatTool>
        </Row>
        <CodeChatThreadHeader>message streaming</CodeChatThreadHeader>
        <Row>
          <CodeChatMessage>
            <MessageMarkdown text={LIVE_MESSAGE.slice(0, 160)} />
          </CodeChatMessage>
        </Row>
        <CodeChatThreadHeader>compaction in progress</CodeChatThreadHeader>
        <Row>
          <CodeChatProgress>compacting context…</CodeChatProgress>
        </Row>
        <CodeChatThreadHeader>retrying after an error</CodeChatThreadHeader>
        <Row>
          <CodeChatError tone="retrying" title="Request failed — retry 3/5 in 16s" time="10:44:02">
            overloaded_error: the model is overloaded, try again later
          </CodeChatError>
        </Row>
        <CodeChatThreadHeader>run failed</CodeChatThreadHeader>
        <Row>
          <CodeChatError title="Agent run failed" time="10:46:10">
            provider returned 500: upstream timeout
          </CodeChatError>
        </Row>
      </Scroller>
    </Frame>
  ),
};

export const LongThinking: Story = {
  render: () => (
    <Frame>
      <Scroller>
        <Row>
          <CodeChatThinkingBlock defaultOpen>
            <CodeChatThinkingHeader duration="took 38s" />
            <CodeChatThinkingContent>
              <MessageMarkdown text={LONG_THINKING} />
            </CodeChatThinkingContent>
          </CodeChatThinkingBlock>
        </Row>
        <Row>
          <CodeChatThinking>
            <MessageMarkdown text={LONG_THINKING} />
          </CodeChatThinking>
        </Row>
      </Scroller>
    </Frame>
  ),
};

export const LongMessage: Story = {
  render: () => (
    <Frame>
      <Scroller>
        <Row>
          <CodeChatMessage variant="user">
            <CodeChatSkills>
              <CodeChatSkill>review</CodeChatSkill>
            </CodeChatSkills>
            <MessageMarkdown text={MARKDOWN_SHOWCASE} />
          </CodeChatMessage>
        </Row>
        <Row>
          <CodeChatMessage>
            <MessageMarkdown text={LONG_MESSAGE} />
          </CodeChatMessage>
        </Row>
      </Scroller>
    </Frame>
  ),
};

export const MarkdownShowcase: Story = {
  render: () => (
    <Frame>
      <Scroller>
        <Row>
          <CodeChatMessage>
            <MessageMarkdown text={MARKDOWN_SHOWCASE} />
          </CodeChatMessage>
        </Row>
        <Row>
          <CodeChatMessage label="Plain variant">
            <MessageMarkdown variant="plain" text={MARKDOWN_SHOWCASE} />
          </CodeChatMessage>
        </Row>
      </Scroller>
    </Frame>
  ),
};
