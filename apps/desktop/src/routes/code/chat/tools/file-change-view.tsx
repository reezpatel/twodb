import type { ReactNode } from "react";
import { CodeChatFileChange } from "@/components/blocks/code/code-chat/code-chat-file-change";
import { CodeChatFileContent } from "@/components/blocks/code/code-chat/code-chat-file-content";
import { CodeChatCopyButton } from "@/components/blocks/code/code-chat/code-chat-copy-button";
import { CodeChatDiff, CodeChatDiffContent, CodeChatDiffCopyButton, CodeChatDiffViewToggle } from "@/components/blocks/code/code-chat/code-chat-diff";
import { diffStats, parseUnifiedDiff } from "@/components/blocks/code/code-chat/code-chat-diff-utils";
import { languageFromPath } from "@/lib/syntax-highlight";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ToolViewProps } from "./tool-block";

const NEW_FILE_PATH = /^\+\+\+ b\/(.+)$/m;

function countLines(content: string) {
  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.length;
}

/** write_file's content: the call's argument when present, else the added lines of its new-file diff (committed rows carry no arguments). */
function writtenContent({ args, diff }: Pick<ToolViewProps, "args" | "diff">) {
  if (typeof args?.content === "string") return args.content;
  if (!diff) return undefined;
  return parseUnifiedDiff(diff)
    .filter((line) => line.type === "added")
    .map((line) => line.content)
    .join("\n");
}

/** Path from the call's arguments, else from the diff header. */
function filePath({ args, diff }: Pick<ToolViewProps, "args" | "diff">) {
  if (typeof args?.path === "string") return args.path;
  return diff ? NEW_FILE_PATH.exec(diff)?.[1] : undefined;
}

/** write_file — not collapsible; the global Cmd/Ctrl+O toggle switches the row between "wrote <file> +N" and the full path with the file content. */
function WriteFileView(props: ToolViewProps) {
  const content = writtenContent(props);
  const text = content ?? (props.running ? props.output : undefined);

  return (
    <CodeChatFileChange
      kind="written"
      open={props.defaultOpen ?? false}
      path={filePath(props)}
      additions={content === undefined ? null : countLines(content)}
      running={props.running}
      failed={props.failed}
      error={props.output}
      actions={text ? <CodeChatCopyButton value={text} label="Copy file content" /> : undefined}
    >
      {text !== undefined ? <CodeChatFileContent content={text} language={languageFromPath(filePath(props))} className="max-h-80" /> : null}
    </CodeChatFileChange>
  );
}

const STDOUT = /^exit code: -?\d+\n\nstdout:\n([\s\S]*?)\n\nstderr:\n/;

/** read_file's text: the stdout section of the tool result, without the model-facing wrapper. */
function readContent(output: string | undefined) {
  if (output === undefined) return undefined;
  const match = STDOUT.exec(output);
  return match ? match[1] : output;
}

/** read_file — same row with no change metric; expanded it shows the lines that were read, numbered from the call's offset. */
function ReadFileView(props: ToolViewProps) {
  const path = filePath(props);
  const content = props.failed ? undefined : readContent(props.output);
  const offset = Number(props.args?.offset);

  return (
    <CodeChatFileChange
      kind="read"
      open={props.defaultOpen ?? false}
      path={path}
      running={props.running}
      failed={props.failed}
      error={props.output}
      actions={content ? <CodeChatCopyButton value={content} label="Copy file content" /> : undefined}
    >
      {content !== undefined ? (
        <CodeChatFileContent
          content={content}
          language={languageFromPath(path)}
          startLine={Number.isFinite(offset) && offset > 0 ? offset : 1}
          className="max-h-80"
        />
      ) : null}
    </CodeChatFileChange>
  );
}

/** update_file — same row, with the unified diff under it. The layout toggle and copy button sit on the row's first line. */
function UpdateFileView(props: ToolViewProps) {
  const wide = useMediaQuery("(min-width: 1280px)");
  const diff = props.diff && props.diff.trim().length > 0 ? props.diff : undefined;
  const stats = diff ? diffStats(parseUnifiedDiff(diff)) : { additions: null, deletions: null };

  const row = (actions?: ReactNode, body?: ReactNode) => (
    <CodeChatFileChange
      kind="updated"
      open={props.defaultOpen ?? false}
      path={filePath(props)}
      additions={stats.additions}
      deletions={stats.deletions}
      running={props.running}
      failed={props.failed}
      error={props.output}
      actions={actions}
    >
      {body}
    </CodeChatFileChange>
  );

  if (!diff) return row();

  return (
    <CodeChatDiff diff={diff} language={languageFromPath(filePath(props))} defaultView={wide ? "split" : "unified"}>
      {row(
        <>
          <CodeChatDiffViewToggle />
          <CodeChatDiffCopyButton />
        </>,
        <CodeChatDiffContent className="max-h-80 overflow-y-auto" />,
      )}
    </CodeChatDiff>
  );
}

export function FileChangeView(props: ToolViewProps) {
  if (props.name === "write_file") return <WriteFileView {...props} />;
  if (props.name === "read_file") return <ReadFileView {...props} />;
  return <UpdateFileView {...props} />;
}
