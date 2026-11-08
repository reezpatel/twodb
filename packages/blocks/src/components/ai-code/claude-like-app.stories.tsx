import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell, AppShellBody, AppShellMain } from "../appshell/shell/shell";
import { StatusBar, StatusBarGroup, StatusBarItem } from "../appshell/status-bar/status-bar";
import { GitBranch, CircleAlert, Bot, Sparkles, Zap } from "lucide-react";
import { AgentWorkflow, type AgentPhase } from "./ai-agent-response";
import { MessageQueue, type QueuedMessage } from "./message-queue";
import { FolderTree, type FolderNode } from "./folder-tree";
import { ModelPicker } from "./model-picker";
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
  type PromptInputModel,
} from "./prompt-input";
import { CanvasSidebar } from "./canvas-sidebar";
import { Chip } from "../ui/chip/chip";

const meta = {
  title: "Blocks/AICode/Claude Like App",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const FILE_TREE: FolderNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "components",
        type: "folder",
        children: [
          {
            name: "appshell",
            type: "folder",
            children: [
              { name: "shell", type: "folder", children: [{ name: "shell.tsx", type: "file" }] },
              { name: "tabs", type: "folder", children: [{ name: "tabs.tsx", type: "file" }, { name: "tabs.stories.tsx", type: "file" }] },
              { name: "status-bar", type: "folder", children: [{ name: "status-bar.tsx", type: "file" }] },
            ],
          },
          { name: "ui", type: "folder", children: [{ name: "button.tsx", type: "file" }, { name: "chip.tsx", type: "file" }] },
        ],
      },
      { name: "styles", type: "folder", children: [{ name: "index.css", type: "file" }] },
    ],
  },
  { name: "THEME.MD", type: "file" },
  { name: "package.json", type: "file" },
];

const MODEL_PROVIDERS = [
  { id: "anthropic", title: "Anthropic", icon: Sparkles, models: [
    { id: "opus-4.5", label: "Claude Opus 4.5", context: "200k", thinking: true },
    { id: "sonnet-4.5", label: "Claude Sonnet 4.5", context: "200k", thinking: true },
    { id: "haiku-4.5", label: "Claude Haiku 4.5", context: "200k" },
  ]},
  { id: "openai", title: "OpenAI", icon: Bot, models: [
    { id: "gpt-5.2", label: "GPT-5.2", context: "256k", thinking: true },
    { id: "gpt-5-mini", label: "GPT-5 mini", context: "128k" },
  ]},
  { id: "google", title: "Google", icon: Zap, models: [
    { id: "gemini-3-pro", label: "Gemini 3 Pro", context: "1M", thinking: true },
    { id: "gemini-3-flash", label: "Gemini 3 Flash", context: "1M" },
  ]},
];
const PROMPT_MODELS: PromptInputModel[] = MODEL_PROVIDERS.flatMap((p) => p.models.map((m) => ({ id: m.id, label: m.label ?? m.id })));

const PHASES: AgentPhase[] = [
  {
    trace: [
      {
        type: "reasoning",
        sentences: [
          "Reading the current tab implementation, then swapping in the Chrome-like design.",
          "The active tab needs an inverted-radius corner so it blends into the content below.",
        ],
        durationSeconds: 2.1,
      },
      { type: "tool", toolName: "read_file", args: { path: "packages/blocks/src/components/appshell/tabs/tabs.tsx" }, lineStart: 1, lineEnd: 6, code: `import * as React from "react";\nimport { Tabs as TabsPrimitive } from "radix-ui";\nimport { X } from "lucide-react";` },
      { type: "tool", toolName: "read_file", args: { path: "packages/blocks/THEME.MD" } },
    ],
    message: "First I'll read the existing tabs implementation and the theme spec.",
  },
  {
    trace: [
      {
        type: "tool",
        toolName: "edit_file",
        args: { path: "packages/blocks/src/components/appshell/tabs/tabs.tsx" },
        add: 12,
        del: 4,
        diffFile: "tabs.tsx",
        diffRows: [
          { old: 1, cur: 1, type: "ctx", text: 'import * as React from "react";' },
          { old: 2, cur: null, type: "del", text: 'import { Tabs as TabsPrimitive } from "radix-ui";' },
          { old: null, cur: 2, type: "add", text: 'import { AnimatePresence, Reorder, motion } from "framer-motion";' },
          { old: 3, cur: 3, type: "ctx", text: 'import { X } from "lucide-react";' },
        ],
      },
      { type: "terminal", command: "pnpm --filter @twodb/blocks build", exitCode: 0, output: "$ tsc --noEmit\n\n✓ done in 1.2s" },
    ],
    message: "Done — replaced with a drag-to-reorder Chrome-like tab strip. The active tab blends into the content below.",
  },
];

/**
 * A composed AI-coding chat: file tree on the left, chat in the middle, a canvas on the right.
 * The chat mixes user/assistant messages, a thinking block, and tool calls (bash, edit, read, search).
 */
export const Default: Story = {
  render: () => {
    const [selectedFile, setSelectedFile] = React.useState<string | undefined>("src/components/appshell/tabs/tabs.tsx");
    const [model, setModel] = React.useState("sonnet-4.5");
    const [canvasOpen, setCanvasOpen] = React.useState(true);
    const [queue, setQueue] = React.useState<QueuedMessage[]>([
      { id: "q1", content: "Add a test for the tab reorder." },
      { id: "q2", content: "Update the docs with the new tab API.", attachments: 1 },
    ]);

    return (
      <AppShell style={{ height: 720 }}>
        <AppShellBody>
          {/* Left: file tree */}
          <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-outline bg-paper">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline px-3">
              <span className="font-sans text-[13px] font-bold text-ink">twodb</span>
              <Chip zone="ion">ion</Chip>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <FolderTree nodes={FILE_TREE} selected={selectedFile} onSelect={setSelectedFile} />
            </div>
          </aside>

          {/* Center: chat */}
          <AppShellMain>
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline bg-paper px-3">
              <span className="font-sans text-[13px] font-bold text-ink">New chat</span>
              <ModelPicker providers={MODEL_PROVIDERS} value={model} onChange={setModel} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              {/* User prompt — right-aligned bubble */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-[14px] rounded-tr-[4px] bg-stone px-4 py-2.5 font-sans text-[14px] leading-relaxed text-ink text-balance">
                  Can you replace the tab strip with a Chrome-like one? Close on ✕, attention dot, and a + button.
                </div>
              </div>

              {/* Assistant response — rail-tree of thinking + tool calls */}
              <AgentWorkflow phases={PHASES} />
            </div>

            <div className="flex shrink-0 flex-col gap-2 bg-paper p-3">
              {queue.length > 0 ? (
                <MessageQueue
                  items={queue}
                  onReorder={setQueue}
                  onRemove={(id) => setQueue((c) => c.filter((i) => i.id !== id))}
                  onSendNow={(id) => setQueue((c) => c.filter((i) => i.id !== id))}
                  onMoveToTop={(id) =>
                    setQueue((c) => {
                      const sel = c.find((i) => i.id === id);
                      return sel ? [sel, ...c.filter((i) => i.id !== id)] : c;
                    })
                  }
                />
              ) : null}
              <PromptInput onSubmit={(value, { attachments }) => console.log("send", value, attachments.length)}>
                <PromptInputAttachments />
                <PromptInputTextarea placeholder="Ask Claude anything…" />
                <PromptInputToolbar className="justify-between">
                  <PromptInputActions>
                    <PromptInputAttach accept="image/*,.pdf,.txt,.md,.csv" />
                  </PromptInputActions>
                  <div className="flex items-center gap-1">
                    <PromptInputModelSelect models={PROMPT_MODELS} value={model} onValueChange={setModel} />
                    <PromptInputSubmit />
                  </div>
                </PromptInputToolbar>
                <PromptInputHint />
              </PromptInput>
            </div>
          </AppShellMain>

          {/* Right: canvas */}
          <CanvasSidebar open={canvasOpen} onClose={() => setCanvasOpen(false)} title={selectedFile?.split("/").pop() ?? "Preview"} width={360}>
            {selectedFile ? (
              <div className="rounded-[8px] border border-outline bg-stone p-4">
                <div className="font-mono text-[11px] text-muted-foreground">{selectedFile}</div>
                <div className="mt-3 rounded-[6px] bg-ink p-3 font-mono text-[12px] leading-relaxed text-paper/90">
                  {selectedFile.endsWith(".tsx")
                    ? `export function ${selectedFile.split("/").pop()?.replace(".tsx", "")}() {\n  return (\n    <div>...</div>\n  );\n}`
                    : selectedFile.endsWith(".css")
                      ? `:root {\n  --paper: #f2efe8;\n}`
                      : `# ${selectedFile.split("/").pop()}`}
                </div>
              </div>
            ) : (
              <p className="text-ink-muted">Select a file on the left to preview it here.</p>
            )}
          </CanvasSidebar>
        </AppShellBody>

        <StatusBar tone="neutral">
          <StatusBarGroup>
            <StatusBarItem icon={<GitBranch />}>main</StatusBarItem>
            <StatusBarItem icon={<CircleAlert />}>0 problems</StatusBarItem>
          </StatusBarGroup>
          <StatusBarGroup>
            <StatusBarItem>{model}</StatusBarItem>
          </StatusBarGroup>
        </StatusBar>
      </AppShell>
    );
  },
};
