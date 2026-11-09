import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputActions,
  PromptInputAttach,
  PromptInputAttachments,
  PromptInputModelSelect,
  PromptInputSubmit,
  PromptInputHint,
  usePromptInput,
  type PromptInputModel,
} from "./prompt-input";
import { cn } from "../../lib/utils";

const meta = {
  title: "Blocks/AICode/PromptInput",
  component: PromptInput,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof PromptInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const MODELS: PromptInputModel[] = [
  { id: "sonnet", label: "Claude Sonnet 4.5", hint: "Balanced — best for most tasks" },
  { id: "opus", label: "Claude Opus 4.5", hint: "Most capable — complex reasoning" },
  { id: "haiku", label: "Claude Haiku 4.5", hint: "Fastest — quick answers" },
];

const MAX_CHARS = 2000;

function CharacterCounter({ max }: { max: number }) {
  const { value } = usePromptInput();
  const over = value.length > max;
  return (
    <span aria-live="polite" className={cn("shrink-0 px-1 text-[11px] tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
      {value.length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
    </span>
  );
}

export const Default: Story = {
  args: { children: null },
  render: () => (
    <div className="w-[520px] p-6">
      <PromptInput onSubmit={(v, { attachments }) => console.log("submit", v, attachments.length)}>
        <PromptInputTextarea placeholder="Ask Claude anything…" />
        <PromptInputToolbar>
          <PromptInputActions>
            <PromptInputAttach accept="image/*,.pdf,.txt,.md,.csv" />
          </PromptInputActions>
          <PromptInputSubmit />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  ),
};

export const WithModelPicker: Story = {
  args: { children: null },
  render: () => {
    const [model, setModel] = React.useState(MODELS[0].id);
    return (
      <div className="w-[520px] p-6">
        <PromptInput onSubmit={(v, { attachments }) => console.log("submit", v, attachments.length)}>
          <PromptInputAttachments />
          <PromptInputTextarea placeholder="Ask Claude anything…" />
          <PromptInputToolbar>
            <PromptInputActions>
              <PromptInputAttach accept="image/*,.pdf,.txt,.md,.csv" />
            </PromptInputActions>
            <PromptInputModelSelect models={MODELS} value={model} onValueChange={setModel} />
            <PromptInputSubmit />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    );
  },
};

export const WithAttachments: Story = {
  args: { children: null },
  render: () => {
    const [model, setModel] = React.useState(MODELS[0].id);
    return (
      <div className="w-[520px] p-6">
        <PromptInput
          onSubmit={(v, { attachments }) => console.log("submit", v, attachments.length)}
          defaultAttachments={[{ id: "seed-1", name: "q3-latency-report.pdf", size: 248_320, type: "application/pdf" }]}
        >
          <PromptInputAttachments />
          <PromptInputTextarea placeholder="Ask about the report, or paste a stack trace…" />
          <PromptInputToolbar>
            <PromptInputActions>
              <PromptInputAttach accept="image/*,.pdf,.txt,.md,.csv" />
            </PromptInputActions>
            <PromptInputModelSelect models={MODELS} value={model} onValueChange={setModel} />
            <PromptInputSubmit />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    );
  },
};

export const WithCounter: Story = {
  args: { children: null },
  render: () => {
    const [model, setModel] = React.useState(MODELS[0].id);
    return (
      <div className="w-[520px] p-6">
        <PromptInput onSubmit={(v, { attachments }) => console.log("submit", v, attachments.length)}>
          <PromptInputTextarea placeholder="Ask Claude anything…" />
          <PromptInputToolbar>
            <PromptInputActions>
              <PromptInputAttach accept="image/*,.pdf,.txt,.md,.csv" />
            </PromptInputActions>
            <PromptInputModelSelect models={MODELS} value={model} onValueChange={setModel} />
            <PromptInputSubmit />
          </PromptInputToolbar>
          <div className="flex items-center justify-between gap-3">
            <PromptInputHint />
            <CharacterCounter max={MAX_CHARS} />
          </div>
        </PromptInput>
      </div>
    );
  },
};

export const Streaming: Story = {
  args: { children: null },
  render: () => {
    const [model, setModel] = React.useState(MODELS[0].id);
    const [streaming, setStreaming] = React.useState(true);
    return (
      <div className="w-[520px] p-6">
        <PromptInput isStreaming={streaming} onStop={() => setStreaming(false)} onSubmit={() => setStreaming(true)}>
          <PromptInputTextarea placeholder="Ask Claude anything…" />
          <PromptInputToolbar>
            <PromptInputActions>
              <PromptInputAttach accept="image/*,.pdf,.txt,.md,.csv" />
            </PromptInputActions>
            <PromptInputModelSelect models={MODELS} value={model} onValueChange={setModel} />
            <PromptInputSubmit />
          </PromptInputToolbar>
        </PromptInput>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">{streaming ? "Generating a reply, press Stop to cancel." : "Idle."}</p>
      </div>
    );
  },
};
