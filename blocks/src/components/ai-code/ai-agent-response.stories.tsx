import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentWorkflow, ThinkingState, type AgentPhase, type TraceNode } from "./ai-agent-response";
import { Database, ShieldCheck } from "lucide-react";
import type { ToolDefinition } from "./ai-agent-response";

const meta = {
  title: "Blocks/AICode/AgentResponse",
  component: AgentWorkflow,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentWorkflow>;

export default meta;
type Story = StoryObj<typeof meta>;

const CUSTOM_TOOLS: Record<string, ToolDefinition> = {
  db_inspect: { name: "db_inspect", label: "Inspect Schema", icon: Database, monoChip: true },
  vuln_scan: { name: "vuln_scan", label: "Security Audit", icon: ShieldCheck },
};

const SIMPLE_TRACE: TraceNode[] = [
  { type: "reasoning", sentences: ["Reading the current tab implementation, then swapping in the Chrome-like design.", "The active tab needs an inverted-radius corner so it blends into the content below."], durationSeconds: 2.1 },
  { type: "tool", toolName: "read_file", args: { path: "packages/blocks/src/components/appshell/tabs/tabs.tsx" }, lineStart: 1, lineEnd: 12, code: `import * as React from "react";\nimport { Tabs as TabsPrimitive } from "radix-ui";\nimport { X } from "lucide-react";\n\nfunction TabsList({ className, ...props }) {\n  return <TabsPrimitive.List ... />;\n}` },
  { type: "tool", toolName: "edit_file", args: { path: "packages/blocks/src/components/appshell/tabs/tabs.tsx" }, add: 12, del: 4, diffFile: "tabs.tsx", diffRows: [
    { old: 1, cur: 1, type: "ctx", text: 'import * as React from "react";' },
    { old: 2, cur: null, type: "del", text: 'import { Tabs as TabsPrimitive } from "radix-ui";' },
    { old: null, cur: 2, type: "add", text: 'import { AnimatePresence, Reorder, motion } from "framer-motion";' },
    { old: 3, cur: 3, type: "ctx", text: 'import { X } from "lucide-react";' },
  ]},
  { type: "terminal", command: "pnpm --filter @twodb/blocks build", exitCode: 0, output: "$ tsc --noEmit\n\n✓ done in 1.2s" },
];

const WORKFLOW: AgentPhase[] = [
  { trace: SIMPLE_TRACE, message: "Replaced the tab strip with a Chrome-like one — drag to reorder, close on ✕, and the active tab blends into the content below." },
];

export const Default: Story = {
  args: { phases: WORKFLOW },
  render: (args) => (
    <div className="w-[560px] p-6">
      <AgentWorkflow {...args} />
    </div>
  ),
};

export const Settled: Story = {
  args: { phases: WORKFLOW },
  render: () => (
    <div className="w-[560px] p-6">
      <ThinkingState nodes={SIMPLE_TRACE} autoPlay={false} defaultExpanded />
    </div>
  ),
};

export const CustomTools: Story = {
  args: { phases: [
    { trace: [
      { type: "tool", toolName: "vuln_scan", primary: "Audit", secondary: "AST check · 3 files", details: [{ text: "✓ HIGH jwt.verify unpinned" }, { text: "✓ PASS JWT_SECRET never logged" }] },
      { type: "tool", toolName: "db_inspect", primary: "Query", secondary: "sessions.revoked_tokens", mono: true, details: [{ text: "✓ LRU TTL indexed" }] },
    ], message: "Audit complete — one high-severity finding." },
  ] },
  render: (args) => (
    <div className="w-[560px] p-6">
      <AgentWorkflow {...args} tools={CUSTOM_TOOLS} />
    </div>
  ),
};
