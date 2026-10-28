import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCog, Globe, Paperclip, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEscapeKey } from "@/lib/use-escape-key";
import { MOCK_COMMANDS, MOCK_FILES } from "../../composer/composer.fixtures";
import { useComposer } from "../../composer/use-composer";
import { CodeChatFooter, CodeChatFooterNotice, CodeChatStatusBar } from "./code-chat-footer";
import { CodeChatComposer, CodeChatComposerActions, CodeChatComposerInput, CodeChatComposerSpacer } from "./code-chat-composer";
import { CodeChatComposerAction } from "./code-chat-composer-action";
import { CodeChatComposerDivider, CodeChatComposerToggle } from "./code-chat-composer-toggle";
import { CodeChatComposerSend } from "./code-chat-composer-send";
import { CodeChatComposerStop } from "./code-chat-composer-stop";
import { CodeChatAttachment, CodeChatAttachments, CodeChatAttachmentUploading } from "./code-chat-attachments";
import { CodeChatQueue, CodeChatQueueActions, CodeChatQueueItem, CodeChatQueueText } from "./code-chat-queue";
import { MockResources, MockUsage } from "./code-chat-footer.fixtures";
import { MockQuestionWizard } from "./code-chat-question.fixtures";

const meta = {
  title: "Blocks/Code/CodeChatFooter/Functional",
  component: CodeChatFooter,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CodeChatFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

const RUN_MS = 4000;

type Queued = { id: number; text: string };
type Attachment = { id: number; name: string };

function FunctionalFooter() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [asking, setAsking] = useState(false);
  const [search, setSearch] = useState(false);
  const [think, setThink] = useState(false);
  const [tokens, setTokens] = useState({ input: 12_400, output: 3_100 });
  const [sent, setSent] = useState<string[]>([]);
  const nextId = useRef(1);
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishRun = useCallback(() => {
    setRunning(false);
    setQueue((current) => {
      const [next, ...rest] = current;
      if (next) startRun(next.text);
      return rest;
    });
  }, []);

  function startRun(message: string) {
    setSent((current) => [...current, message]);
    setRunning(true);
    if (runTimer.current) clearTimeout(runTimer.current);
    runTimer.current = setTimeout(finishRun, RUN_MS);
  }

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setTokens((current) => ({ input: current.input + 180, output: current.output + 95 })), 400);
    return () => clearInterval(tick);
  }, [running]);

  useEffect(() => () => void (runTimer.current && clearTimeout(runTimer.current)), []);

  const draft = text.trim();
  const canSend = draft.length > 0 && !disconnected;

  const handleSend = (content: string) => {
    if (disconnected) return false;
    setAttachments([]);
    if (running) setQueue((current) => [...current, { id: nextId.current++, text: content }]);
    else startRun(content);
    return true;
  };

  const { editor, submit } = useComposer({
    files: MOCK_FILES,
    commands: MOCK_COMMANDS,
    disabled: disconnected,
    placeholder: running ? "Steering — message queues until this round finishes" : "Ask the agent… — @ files, / commands",
    onDraft: setText,
    onSend: handleSend,
  });

  const stop = () => {
    if (runTimer.current) clearTimeout(runTimer.current);
    setRunning(false);
  };

  useEscapeKey(stop, running);

  const sendQueueNow = () => {
    if (runTimer.current) clearTimeout(runTimer.current);
    setRunning(false);
    setQueue((current) => {
      const [next, ...rest] = current;
      if (next) startRun(next.text);
      return rest;
    });
  };

  const attach = () => {
    setUploading(true);
    setTimeout(() => {
      setAttachments((current) => [...current, { id: nextId.current++, name: `screenshot-${current.length + 1}.png` }]);
      setUploading(false);
    }, 800);
  };

  return (
    <div className="bg-background mx-auto flex h-screen max-w-5xl flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
          <span>Story controls:</span>
          <Button size="xs" variant="outline" onClick={() => setDisconnected((value) => !value)}>
            {disconnected ? "Reconnect" : "Simulate disconnect"}
          </Button>
          <Button size="xs" variant="outline" onClick={() => setAsking((value) => !value)}>
            {asking ? "Dismiss question" : "Simulate agent question"}
          </Button>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {sent.map((message, index) => (
            <li key={index} className="bg-primary/15 w-fit max-w-md rounded-sm px-3 py-2">
              {message}
            </li>
          ))}
          {running ? <li className="text-muted-foreground text-xs">agent is working…</li> : null}
        </ul>
      </div>

      <CodeChatFooter>
        {disconnected ? <CodeChatFooterNotice>Connection lost — retrying</CodeChatFooterNotice> : null}
        {asking ? (
          <MockQuestionWizard onSubmit={() => setAsking(false)} onStop={() => setAsking(false)} />
        ) : (
          <>
            {queue.length > 0 ? (
              <CodeChatQueue>
                {queue.map((item) => (
                  <CodeChatQueueItem key={item.id}>
                    <CodeChatQueueText>{item.text}</CodeChatQueueText>
                    <CodeChatQueueActions>
                      <CodeChatComposerAction icon={<Send />} label="Send now — stops the run and dispatches" className="size-6" onClick={sendQueueNow} />
                      <CodeChatComposerAction
                        icon={<Trash2 />}
                        label="Delete"
                        className="hover:text-destructive size-6"
                        onClick={() => setQueue((current) => current.filter((queued) => queued.id !== item.id))}
                      />
                    </CodeChatQueueActions>
                  </CodeChatQueueItem>
                ))}
              </CodeChatQueue>
            ) : null}

            <CodeChatComposer busy={running}>
              {attachments.length > 0 || uploading ? (
                <CodeChatAttachments>
                  {attachments.map((attachment) => (
                    <CodeChatAttachment
                      key={attachment.id}
                      name={attachment.name}
                      onRemove={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                    />
                  ))}
                  {uploading ? <CodeChatAttachmentUploading /> : null}
                </CodeChatAttachments>
              ) : null}
              <CodeChatComposerInput editor={editor} />
              <CodeChatComposerActions>
                <CodeChatComposerAction
                  icon={<Paperclip />}
                  label="Attach files"
                  shortcut={["⌘", "U"]}
                  loading={uploading}
                  onClick={attach}
                  disabled={disconnected}
                />
                <CodeChatComposerToggle icon={<Globe />} label="Search" tone="info" active={search} onClick={() => setSearch((value) => !value)} />
                <CodeChatComposerDivider />
                <CodeChatComposerToggle icon={<BrainCog />} label="Think" tone="primary" active={think} onClick={() => setThink((value) => !value)} />
                <CodeChatComposerSpacer />
                {running ? <CodeChatComposerStop onClick={stop} /> : null}
                <CodeChatComposerSend
                  label={running ? "Queue message — sent when this round finishes" : "Send"}
                  disabled={!canSend}
                  onClick={queue.length > 0 && running && !draft ? sendQueueNow : submit}
                />
              </CodeChatComposerActions>
            </CodeChatComposer>
          </>
        )}

        <CodeChatStatusBar>
          <MockUsage input={tokens.input} output={tokens.output} context={tokens.input + tokens.output} tokensPerSecond={running ? 48 : null} />
          <MockResources />
        </CodeChatStatusBar>
      </CodeChatFooter>
    </div>
  );
}

export const Functional: Story = {
  render: () => <FunctionalFooter />,
};
