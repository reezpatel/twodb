import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { BrainCog, Globe, Paperclip } from "lucide-react";
import { MockResources, MockUsage } from "./code-chat-footer.fixtures";
import { useMockComposer } from "../../composer/composer.fixtures";
import { CodeChatFooter, CodeChatFooterNotice, CodeChatReconnecting, CodeChatStatusBar } from "./code-chat-footer";
import { CodeChatComposer, CodeChatComposerActions, CodeChatComposerInput, CodeChatComposerSpacer } from "./code-chat-composer";
import { CodeChatComposerAction } from "./code-chat-composer-action";
import { CodeChatComposerDivider, CodeChatComposerToggle } from "./code-chat-composer-toggle";
import { CodeChatComposerSend } from "./code-chat-composer-send";
import { CodeChatComposerStop } from "./code-chat-composer-stop";
import { CodeChatAttachment, CodeChatAttachments, CodeChatAttachmentUploading } from "./code-chat-attachments";
import { CodeChatQueue } from "./code-chat-queue";

const meta = {
  title: "Blocks/Code/CodeChatFooter",
  component: CodeChatFooter,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CodeChatFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

const PREVIEW = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=160&q=60";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background mx-auto flex h-screen max-w-5xl flex-col">
      <div className="flex-1" />
      {children}
    </div>
  );
}

function StatusBar({ resources = "online" }: { resources?: "online" | "offline" | "none" }) {
  return (
    <CodeChatStatusBar>
      <MockUsage />
      <MockResources state={resources} />
    </CodeChatStatusBar>
  );
}

type ComposerPreviewProps = {
  resources?: "online" | "offline" | "none";
  running?: boolean;
  attachments?: boolean;
  uploading?: boolean;
  queued?: boolean;
  notice?: string;
  reconnecting?: boolean;
};

function ComposerPreview({ resources, running = false, attachments = false, uploading = false, queued = false, notice, reconnecting = false }: ComposerPreviewProps) {
  const { editor } = useMockComposer({ placeholder: running ? "Steering — message queues until this round finishes" : undefined });
  const [search, setSearch] = useState(false);
  const [think, setThink] = useState(true);

  return (
    <Frame>
      <CodeChatFooter>
        {notice ? <CodeChatFooterNotice>{notice}</CodeChatFooterNotice> : null}
        {reconnecting ? <CodeChatReconnecting /> : null}
        {queued ? (
          <CodeChatQueue items={[{ id: "q1", content: "also add a story for the empty state" }]} onRemove={() => {}} onSendNow={() => {}} />
        ) : null}
        <CodeChatComposer busy={running}>
          {attachments || uploading ? (
            <CodeChatAttachments>
              {attachments ? (
                <>
                  <CodeChatAttachment name="architecture.png" previewUrl={PREVIEW} onRemove={() => {}} />
                  <CodeChatAttachment name="notes.md" onRemove={() => {}} />
                </>
              ) : null}
              {uploading ? <CodeChatAttachmentUploading /> : null}
            </CodeChatAttachments>
          ) : null}
          <CodeChatComposerInput editor={editor} />
          <CodeChatComposerActions>
            <CodeChatComposerAction icon={<Paperclip />} label="Attach files" shortcut={["⌘", "U"]} loading={uploading} />
            <CodeChatComposerToggle icon={<Globe />} label="Search" tone="info" active={search} onClick={() => setSearch((v) => !v)} />
            <CodeChatComposerDivider />
            <CodeChatComposerToggle icon={<BrainCog />} label="Think" tone="primary" active={think} onClick={() => setThink((v) => !v)} />
            <CodeChatComposerSpacer />
            {running ? <CodeChatComposerStop /> : null}
            <CodeChatComposerSend label={running ? "Queue message — sent when this round finishes" : "Send"} />
          </CodeChatComposerActions>
        </CodeChatComposer>
        <StatusBar resources={resources} />
      </CodeChatFooter>
    </Frame>
  );
}

export const Idle: Story = {
  render: () => <ComposerPreview />,
};

export const Running: Story = {
  render: () => <ComposerPreview running />,
};

export const WithAttachments: Story = {
  render: () => <ComposerPreview attachments />,
};

export const Uploading: Story = {
  render: () => <ComposerPreview attachments uploading />,
};

export const WithQueue: Story = {
  render: () => <ComposerPreview running queued />,
};

export const Disconnected: Story = {
  render: () => <ComposerPreview reconnecting />,
};

export const MachineOffline: Story = {
  render: () => <ComposerPreview resources="offline" />,
};

export const NoMachine: Story = {
  render: () => <ComposerPreview resources="none" />,
};

export const SendButtonStates: Story = {
  render: () => (
    <div className="bg-background flex items-center gap-4 p-8">
      <CodeChatComposerSend label="Send" />
      <CodeChatComposerSend label="Send (disabled)" disabled />
      <CodeChatComposerStop />
    </div>
  ),
};
