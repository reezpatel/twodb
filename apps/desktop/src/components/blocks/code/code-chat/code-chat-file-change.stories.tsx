import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import { CodeChatFileChange } from "./code-chat-file-change";
import { CodeChatFileContent } from "./code-chat-file-content";
import { CodeChatCopyButton } from "./code-chat-copy-button";
import { CodeChatDiff, CodeChatDiffContent, CodeChatDiffCopyButton, CodeChatDiffViewToggle } from "./code-chat-diff";

const UPDATE_DIFF = `--- a/src/lib/url-registry.ts
+++ b/src/lib/url-registry.ts
@@ -1,4 +1,5 @@
 const APPS_ROOT = "/apps";
+const SETTINGS_ROOT = \`\${APPS_ROOT}/settings\`;
 
 export const urls = {
   code: \`\${APPS_ROOT}/code\`,
@@ -20,5 +21,5 @@
   settings: {
-    root: "/apps/settings",
-    llm: "/apps/settings/llm",
+    root: SETTINGS_ROOT,
+    llm: \`\${SETTINGS_ROOT}/llm\`,
   },
`;

const NEW_FILE = `export function fmtTokens(n: number) {
  if (n >= 1_000_000) return \`\${(n / 1_000_000).toFixed(1)}M\`;
  if (n >= 1_000) return \`\${(n / 1_000).toFixed(1)}k\`;
  return String(n);
}
`;

function WithDiff({ diff, children }: { diff: string; children: (parts: { actions: ReactNode; body: ReactNode }) => ReactNode }) {
  return (
    <CodeChatDiff diff={diff}>
      {children({
        actions: (
          <>
            <CodeChatDiffViewToggle />
            <CodeChatDiffCopyButton />
          </>
        ),
        body: <CodeChatDiffContent className="max-h-80 overflow-y-auto" />,
      })}
    </CodeChatDiff>
  );
}

const meta = {
  title: "Blocks/Code/CodeChat/FileChange",
  component: CodeChatFileChange,
  parameters: { layout: "centered" },
  args: { path: "src/components/blocks/code/code-sidebar/code-commit.tsx", additions: 168 },
  decorators: [
    (Story) => (
      <div className="w-[34rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeChatFileChange>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = { args: { open: true } };

export const Updated: Story = { args: { kind: "updated", additions: 24, deletions: 9 } };

export const UpdatedExpanded: Story = { args: { kind: "updated", open: true, additions: 24, deletions: 9 } };

export const UpdatedRunning: Story = { args: { kind: "updated", running: true } };

export const UpdatedFailed: Story = {
  args: { kind: "updated", failed: true, open: true, additions: null, error: "error: old_string not found in src/lib/url-registry.ts" },
};

export const CountUnknown: Story = { args: { open: true, additions: null } };

export const LongPath: Story = {
  args: {
    open: true,
    path: "packages/very-long-package-name/src/components/deeply/nested/directory/structure/a-component-with-an-extremely-long-file-name.tsx",
    additions: 1204,
  },
};

export const Running: Story = { args: { running: true } };

export const RunningExpanded: Story = { args: { running: true, open: true, additions: null } };

export const Failed: Story = { args: { failed: true, error: "error: EACCES: permission denied, open '/etc/hosts'" } };

export const FailedExpanded: Story = { args: { failed: true, open: true, error: "error: EACCES: permission denied, open '/etc/hosts'", additions: null } };

export const UpdatedWithDiff: Story = {
  render: (args) => (
    <WithDiff diff={UPDATE_DIFF}>
      {({ actions, body }) => (
        <CodeChatFileChange {...args} kind={"updated"} open={true} path="src/lib/url-registry.ts" additions={3} deletions={2} actions={actions}>
          {body}
        </CodeChatFileChange>
      )}
    </WithDiff>
  ),
};

const READ_CONTENT = `export function fmtTokens(n: number) {
  if (n >= 1_000_000) return \`\${(n / 1_000_000).toFixed(1)}M\`;
  return String(n);
}
`;

export const Read: Story = { args: { kind: "read", path: "src/lib/format-tokens.ts", additions: null } };

export const ReadExpanded: Story = {
  render: (args) => (
    <CodeChatFileChange
      {...args}
      kind="read"
      open
      path="src/lib/format-tokens.ts"
      additions={null}
      actions={<CodeChatCopyButton value={READ_CONTENT} label="Copy file content" />}
    >
      <CodeChatFileContent content={READ_CONTENT} language="typescript" className="max-h-80" />
    </CodeChatFileChange>
  ),
};

export const ReadRange: Story = {
  render: (args) => (
    <CodeChatFileChange {...args} kind="read" open path="src/lib/format-tokens.ts" additions={null}>
      <CodeChatFileContent content={READ_CONTENT} language="typescript" startLine={41} />
    </CodeChatFileChange>
  ),
};

export const Reading: Story = { args: { kind: "read", running: true, path: "src/lib/format-tokens.ts", additions: null } };

export const ReadFailed: Story = {
  args: { kind: "read", failed: true, open: true, path: "src/lib/missing.ts", additions: null, error: "error: not a file: src/lib/missing.ts" },
};

export const AllCollapsed: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <CodeChatFileChange {...args} kind="written" path="src/components/blocks/code/code-sidebar/code-commit.tsx" additions={168} />
      <CodeChatFileChange {...args} kind="updated" path="src/routes/code/sidebar/sidebar.tsx" additions={24} deletions={62} />
      <CodeChatFileChange {...args} kind="read" path="src/lib/url-registry.ts" additions={null} />
      <CodeChatFileChange {...args} kind="written" running path="src/lib/new-file.ts" additions={null} />
      <CodeChatFileChange {...args} kind="updated" failed path="src/lib/url-registry.ts" additions={null} />
    </div>
  ),
};

export const WrittenWithContent: Story = {
  render: (args) => (
    <CodeChatFileChange
      {...args}
      open
      path="src/lib/format-tokens.ts"
      additions={5}
      actions={<CodeChatCopyButton value={NEW_FILE} label="Copy file content" />}
    >
      <CodeChatFileContent content={NEW_FILE} language="typescript" className="max-h-80" />
    </CodeChatFileChange>
  ),
};

export const WrittenWithContentCollapsed: Story = {
  render: (args) => (
    <CodeChatFileChange {...args} open={false} path="src/lib/format-tokens.ts" additions={5}>
      <CodeChatFileContent content={NEW_FILE} language="typescript" />
    </CodeChatFileChange>
  ),
};

export const WrittenLongFile: Story = {
  render: (args) => {
    const content = Array.from({ length: 120 }, (_, i) => `export const LINE_${i + 1} = ${i + 1}; // a line of generated content to make the file scroll`).join(
      "\n",
    );
    return (
      <CodeChatFileChange
        {...args}
        open
        path="src/generated/constants.ts"
        additions={120}
        actions={<CodeChatCopyButton value={content} label="Copy file content" />}
      >
        <CodeChatFileContent content={content} language="typescript" className="max-h-80" />
      </CodeChatFileChange>
    );
  },
};

const PY_FILE = `import json


def load(path: str) -> dict:
    """Read a JSON config."""
    with open(path) as handle:
        return json.load(handle)  # parsed
`;

const JSON_FILE = `{
  "name": "desktop",
  "version": "0.2.46",
  "private": true,
  "scripts": { "dev": "vite" }
}
`;

export const WrittenPython: Story = {
  render: (args) => (
    <CodeChatFileChange {...args} open path="scripts/build.py" additions={7}>
      <CodeChatFileContent content={PY_FILE} language="python" />
    </CodeChatFileChange>
  ),
};

export const WrittenJson: Story = {
  render: (args) => (
    <CodeChatFileChange {...args} open path="package.json" additions={5}>
      <CodeChatFileContent content={JSON_FILE} language="json" />
    </CodeChatFileChange>
  ),
};

export const WrittenUnknownLanguage: Story = {
  render: (args) => (
    <CodeChatFileChange {...args} open path="Dockerfile" additions={3}>
      <CodeChatFileContent content={'FROM node:22-slim\nRUN pnpm install\nCMD ["node", "server.js"]'} />
    </CodeChatFileChange>
  ),
};

export const WrittenEmptyFile: Story = {
  render: (args) => (
    <CodeChatFileChange {...args} open path="src/.gitkeep" additions={0}>
      <CodeChatFileContent content="" />
    </CodeChatFileChange>
  ),
};

export const DiffHiddenWhenCollapsed: Story = {
  render: (args) => (
    <WithDiff diff={UPDATE_DIFF}>
      {({ actions, body }) => (
        <CodeChatFileChange {...args} kind={"updated"} open={false} path="src/lib/url-registry.ts" additions={3} deletions={2} actions={actions}>
          {body}
        </CodeChatFileChange>
      )}
    </WithDiff>
  ),
};

export const WithoutPath: Story = { args: { open: true, path: undefined } };

export const ToggledWithShortcut: Story = {
  render: function ToggledStory(args) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
          event.preventDefault();
          setOpen((current) => !current);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          Press <Kbd>⌘</Kbd>
          <Kbd>O</Kbd> to toggle all tool outputs
        </span>
        <CodeChatFileChange {...args} open={open} />
        <CodeChatFileChange {...args} open={open} kind="updated" path="README.md" additions={4} deletions={1} />
        <CodeChatFileChange {...args} open={open} failed error="error: no such directory" path="docs/missing/guide.md" additions={null} />
      </div>
    );
  },
};
