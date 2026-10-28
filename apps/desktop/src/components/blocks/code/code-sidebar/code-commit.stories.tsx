import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import {
  CodeCommit,
  CodeCommitActions,
  CodeCommitBranch,
  CodeCommitContent,
  CodeCommitCounts,
  CodeCommitFile,
  CodeCommitFolder,
  CodeCommitHeader,
  CodeCommitMessage,
  CodeCommitRefreshAction,
  CodeCommitTitle,
  CodeCommitTrigger,
  type CodeCommitFileStatus,
} from "./code-commit";

interface MockFile {
  path: string;
  status: CodeCommitFileStatus;
  additions: number | null;
  deletions: number | null;
}

const FILES: MockFile[] = [
  { path: "src/components/blocks/code/code-sidebar/code-commit.tsx", status: "added", additions: 168, deletions: 0 },
  { path: "src/components/blocks/code/code-sidebar/code-plan.tsx", status: "modified", additions: 12, deletions: 31 },
  { path: "src/routes/code/sidebar/sidebar.tsx", status: "modified", additions: 24, deletions: 62 },
  { path: "src/routes/code/sidebar/use-sidebar-git.ts", status: "added", additions: 74, deletions: 0 },
  { path: "src/components/ui/claude-model-selector.tsx", status: "deleted", additions: 0, deletions: 1330 },
  { path: "src/assets/logo.png", status: "modified", additions: null, deletions: null },
  { path: "src/routes/code/old-name.ts", status: "renamed", additions: 3, deletions: 3 },
  { path: "README.md", status: "modified", additions: 4, deletions: 1 },
  { path: "notes.txt", status: "untracked", additions: null, deletions: null },
];

function group(files: MockFile[]) {
  const groups = new Map<string, MockFile[]>();
  for (const file of files) {
    const folder = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups];
}

const sum = (files: MockFile[], key: "additions" | "deletions") => files.reduce((total, file) => total + (file[key] ?? 0), 0);
const fileName = (path: string) => path.split("/").pop() ?? path;

interface PreviewProps {
  files?: MockFile[];
  grouped?: boolean;
  branch?: boolean;
  defaultOpen?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  children?: ReactNode;
}

function Preview({ files = FILES, grouped = true, branch = true, defaultOpen = true, refreshing = false, onRefresh, children }: PreviewProps) {
  return (
    <CodeCommit defaultOpen={defaultOpen}>
      <CodeCommitHeader>
        <CodeCommitTrigger>
          <CodeCommitTitle>
            {files.length} changed {files.length === 1 ? "file" : "files"}
          </CodeCommitTitle>
          <CodeCommitCounts additions={sum(files, "additions")} deletions={sum(files, "deletions")} className="ml-auto" />
        </CodeCommitTrigger>
        <CodeCommitActions>
          <CodeCommitRefreshAction spinning={refreshing} onClick={onRefresh} />
        </CodeCommitActions>
      </CodeCommitHeader>
      <CodeCommitContent>
        {branch ? <CodeCommitBranch name="feat/code-commit" ahead={2} behind={1} /> : null}
        {children ??
          (files.length === 0 ? (
            <CodeCommitMessage>No changes — working tree clean.</CodeCommitMessage>
          ) : grouped ? (
            group(files).map(([folder, folderFiles]) =>
              folder ? (
                <CodeCommitFolder key={folder} name={folder} additions={sum(folderFiles, "additions")} deletions={sum(folderFiles, "deletions")}>
                  {folderFiles.map((file) => (
                    <CodeCommitFile
                      key={file.path}
                      nested
                      name={fileName(file.path)}
                      path={file.path}
                      status={file.status}
                      additions={file.additions}
                      deletions={file.deletions}
                    />
                  ))}
                </CodeCommitFolder>
              ) : (
                folderFiles.map((file) => (
                  <CodeCommitFile
                    key={file.path}
                    name={fileName(file.path)}
                    path={file.path}
                    status={file.status}
                    additions={file.additions}
                    deletions={file.deletions}
                  />
                ))
              ),
            )
          ) : (
            files.map((file) => (
              <CodeCommitFile key={file.path} name={file.path} path={file.path} status={file.status} additions={file.additions} deletions={file.deletions} />
            ))
          ))}
      </CodeCommitContent>
    </CodeCommit>
  );
}

const meta = {
  title: "Blocks/Code/CodeSidebar/Commit",
  component: Preview,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="bg-background w-72 rounded-md border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Preview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {};

export const Flat: Story = { args: { grouped: false } };

export const Collapsed: Story = { args: { defaultOpen: false } };

export const SingleFile: Story = { args: { files: FILES.slice(2, 3) } };

export const Clean: Story = { args: { files: [] } };

export const Refreshing: Story = { args: { refreshing: true } };

export const WithoutBranch: Story = { args: { branch: false } };

export const LongPaths: Story = {
  args: {
    files: [
      {
        path: "packages/very-long-package-name/src/components/deeply/nested/directory/structure/a-component-with-an-extremely-long-file-name.tsx",
        status: "modified",
        additions: 1204,
        deletions: 988,
      },
      { path: "packages/very-long-package-name/src/index.ts", status: "added", additions: 3, deletions: 0 },
    ],
  },
};

export const NotARepository: Story = {
  args: {
    files: [],
    branch: false,
    children: <CodeCommitMessage>not a git repository</CodeCommitMessage>,
  },
};

export const Loading: Story = {
  args: { files: [], branch: false, children: <CodeCommitMessage>loading…</CodeCommitMessage> },
};

export const LoadError: Story = {
  args: { files: [], branch: false, children: <CodeCommitMessage tone="destructive">failed to load changes</CodeCommitMessage> },
};

export const Interactive: Story = {
  render: function InteractiveStory() {
    const [refreshing, setRefreshing] = useState(false);
    const [files, setFiles] = useState(FILES.slice(0, 4));
    const refresh = () => {
      setRefreshing(true);
      setTimeout(() => {
        setFiles(FILES.slice(0, 3 + Math.floor(Math.random() * (FILES.length - 3))));
        setRefreshing(false);
      }, 900);
    };
    return <Preview files={files} refreshing={refreshing} onRefresh={refresh} />;
  },
};
