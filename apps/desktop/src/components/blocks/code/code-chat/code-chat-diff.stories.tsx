import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import {
  CodeChatDiff,
  CodeChatDiffContent,
  CodeChatDiffCopyButton,
  CodeChatDiffHeader,
  CodeChatDiffSpacer,
  CodeChatDiffStats,
  CodeChatDiffViewToggle,
} from "./code-chat-diff";
import { CodeChatTool, CodeChatToolContent, CodeChatToolHeader } from "./code-chat-tool";
import { createUnifiedDiff, type CodeChatDiffView } from "./code-chat-diff-utils";

const SINGLE_HUNK = `--- a/src/routes/code/sidebar/sidebar.tsx
+++ b/src/routes/code/sidebar/sidebar.tsx
@@ -52,8 +52,10 @@
 function useSidebarGit() {
   const queryClient = useQueryClient();
-  const { directoryId } = useSessionDirectory();
-  const status = useGitStatus(directoryId);
+  const { directoryId } = useSessionDirectory();
+  const status = useGitStatus(directoryId);
+  const changes = useGitChanges(directoryId, status.data?.git === true);
+  const groups = useMemo(() => groupByFolder(changes.data?.files ?? []), [changes.data]);
   return {
     hasDirectory: !!directoryId,
   };
 }
`;

const MULTI_HUNK = `--- a/src/lib/url-registry.ts
+++ b/src/lib/url-registry.ts
@@ -1,4 +1,5 @@
 const APPS_ROOT = "/apps";
+const SETTINGS_ROOT = \`\${APPS_ROOT}/settings\`;
 
 export const urls = {
   code: \`\${APPS_ROOT}/code\`,
@@ -20,7 +21,7 @@
   },
   settings: {
-    root: "/apps/settings",
-    llm: "/apps/settings/llm",
+    root: SETTINGS_ROOT,
+    llm: \`\${SETTINGS_ROOT}/llm\`,
     runners: \`\${SETTINGS_ROOT}/runners\`,
   },
 };
@@ -48,3 +49,2 @@
 export function settingsPath(section: string) {
-  return \`/apps/settings/\${section}\`;
-}
+  return \`\${SETTINGS_ROOT}/\${section}\`; }
`;

const LONG_LINES = `@@ -1,3 +1,3 @@
 // context
-const message = "a very long line that keeps going and going so the table has to scroll horizontally instead of wrapping the code onto several lines and breaking alignment";
+const message = "a very long line that keeps going and going so the table has to scroll horizontally instead of wrapping the code onto several lines and breaking alignment, now longer still";
 // context
`;

const ADDED_ONLY = `@@ -0,0 +1,6 @@
+export function formatTokens(value: number) {
+  if (value >= 1_000_000) return \`\${(value / 1_000_000).toFixed(1)}M\`;
+  if (value >= 1_000) return \`\${(value / 1_000).toFixed(1)}k\`;
+  return String(value);
+}
+`;

const REMOVED_ONLY = `@@ -1,4 +1,0 @@
-export const LEGACY_FLAG = true;
-export function legacy() {
-  return LEGACY_FLAG;
-}
`;

const PYTHON_DIFF = `--- a/scripts/build.py
+++ b/scripts/build.py
@@ -1,6 +1,7 @@
 import json
-def load(path):
-    return json.load(open(path))
+def load(path: str) -> dict:
+    with open(path) as handle:
+        return json.load(handle)  # parsed config
 
 print(load("config.json"))
`;

const CSS_DIFF = `--- a/src/index.css
+++ b/src/index.css
@@ -10,5 +10,6 @@
 .cp-composer p {
-  letter-spacing: 0;
+  letter-spacing: -0.01em;
+  line-height: 1.55;
   color: var(--color-foreground);
 }
`;

const JSON_DIFF = `--- a/package.json
+++ b/package.json
@@ -3,5 +3,6 @@
   "name": "desktop",
-  "version": "0.2.45",
+  "version": "0.2.46",
+  "private": true,
   "scripts": { "dev": "vite" }
 }
`;

const UNKNOWN_DIFF = `--- a/Dockerfile
+++ b/Dockerfile
@@ -1,3 +1,3 @@
 FROM node:22-slim
-RUN npm install
+RUN pnpm install --frozen-lockfile
 CMD ["node", "server.js"]
`;

const BEFORE = `You are a helpful assistant.
Answer questions concisely.
Be friendly and professional.`;

const AFTER = `You are a senior software engineer assistant.
Answer questions with code examples when relevant.
Be friendly, professional, and thorough.
Always explain your reasoning.`;

function Card({ children }: { children: ReactNode }) {
  return <div className="bg-card w-[44rem] max-w-full overflow-hidden rounded-lg border">{children}</div>;
}

interface PreviewProps {
  diff: string;
  defaultView?: CodeChatDiffView;
  header?: boolean;
}

function Preview({ diff, defaultView, header = true }: PreviewProps) {
  return (
    <Card>
      <CodeChatDiff diff={diff} defaultView={defaultView}>
        {header ? (
          <CodeChatDiffHeader>
            <CodeChatDiffStats />
            <CodeChatDiffSpacer />
            <CodeChatDiffViewToggle />
            <CodeChatDiffCopyButton />
          </CodeChatDiffHeader>
        ) : null}
        <CodeChatDiffContent className="max-h-80 overflow-y-auto" />
      </CodeChatDiff>
    </Card>
  );
}

const meta = {
  title: "Blocks/Code/CodeChat/Diff",
  component: Preview,
  parameters: { layout: "centered" },
  args: { diff: SINGLE_HUNK },
} satisfies Meta<typeof Preview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unified: Story = {};

export const Split: Story = { args: { defaultView: "split" } };

export const MultipleHunks: Story = { args: { diff: MULTI_HUNK } };

export const MultipleHunksSplit: Story = { args: { diff: MULTI_HUNK, defaultView: "split" } };

export const FromBeforeAndAfter: Story = { args: { diff: createUnifiedDiff(BEFORE, AFTER) } };

export const FromBeforeAndAfterSplit: Story = { args: { diff: createUnifiedDiff(BEFORE, AFTER), defaultView: "split" } };

export const NewFile: Story = { args: { diff: ADDED_ONLY } };

export const DeletedFile: Story = { args: { diff: REMOVED_ONLY, defaultView: "split" } };

export const LongLines: Story = { args: { diff: LONG_LINES } };

export const WithoutHeader: Story = { args: { header: false } };

export const NotHunkShaped: Story = { args: { diff: "Binary files a/logo.png and b/logo.png differ" } };

export const PythonHighlighted: Story = { args: { diff: PYTHON_DIFF } };

export const CssHighlighted: Story = { args: { diff: CSS_DIFF, defaultView: "split" } };

export const JsonHighlighted: Story = { args: { diff: JSON_DIFF } };

export const UnknownLanguage: Story = { args: { diff: UNKNOWN_DIFF } };

export const Controlled: Story = {
  render: function ControlledStory() {
    const [view, setView] = useState<CodeChatDiffView>("split");
    return (
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs">view: {view}</span>
        <Card>
          <CodeChatDiff diff={MULTI_HUNK} view={view} onViewChange={setView}>
            <CodeChatDiffHeader>
              <CodeChatDiffStats />
              <CodeChatDiffSpacer />
              <CodeChatDiffViewToggle />
            </CodeChatDiffHeader>
            <CodeChatDiffContent className="max-h-80 overflow-y-auto" />
          </CodeChatDiff>
        </Card>
      </div>
    );
  },
};

export const InsideUpdateFileTool: Story = {
  render: () => (
    <div className="w-[44rem] max-w-full">
      <CodeChatTool defaultOpen>
        <CodeChatToolHeader label="update_file" preview="src/routes/code/sidebar/sidebar.tsx" duration="took 1s" expandable />
        <CodeChatToolContent>
          <CodeChatDiff diff={SINGLE_HUNK}>
            <CodeChatDiffHeader>
              <CodeChatDiffStats />
              <CodeChatDiffSpacer />
              <CodeChatDiffViewToggle />
              <CodeChatDiffCopyButton />
            </CodeChatDiffHeader>
            <CodeChatDiffContent className="max-h-80 overflow-y-auto" />
          </CodeChatDiff>
        </CodeChatToolContent>
      </CodeChatTool>
    </div>
  ),
};
