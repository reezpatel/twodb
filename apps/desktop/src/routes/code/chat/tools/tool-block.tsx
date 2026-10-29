import { CodeChatTool, CodeChatToolContent, CodeChatToolDiff, CodeChatToolHeader, CodeChatToolOutput } from "@/components/blocks/code/code-chat/code-chat-tool";
import {
  CodeChatDiff,
  CodeChatDiffContent,
  CodeChatDiffCopyButton,
  CodeChatDiffHeader,
  CodeChatDiffSpacer,
  CodeChatDiffStats,
  CodeChatDiffViewToggle,
} from "@/components/blocks/code/code-chat/code-chat-diff";
import { useMediaQuery } from "@/lib/use-media-query";
import { useElapsed } from "../messages/use-elapsed";

/** Everything a tool view can know about one call — live or committed. */
export interface ToolViewProps {
  name: string;
  /** Call arguments. Absent for orphan tool rows (result with no matching call). */
  args?: Record<string, unknown>;
  output?: string;
  diff?: string;
  running?: boolean;
  startedAt?: number;
  completedAt?: number;
  failed?: boolean;
  /** Global Ctrl+O "tool outputs open" state, for views that aren't built on CodeChatTool. */
  defaultOpen?: boolean;
}

/** Common arg keys used as the one-line header preview, in priority order. */
const PREVIEW_KEYS = ["command", "path", "pattern", "url", "query"] as const;

export function defaultPreview(args?: Record<string, unknown>): string | undefined {
  for (const key of PREVIEW_KEYS) {
    const v = args?.[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

/**
 * Generic collapsible tool block — the catch-all view for any tool without a
 * custom entry in TOOL_VIEWS. `label` replaces the tool name in the header and
 * `preview` replaces the default arg preview. The global Ctrl+O state comes
 * from CodeChatToolsOpenProvider; diff-bearing blocks start open — the diff IS the result.
 */
export function ToolBlock({
  name,
  args,
  output,
  diff,
  running,
  startedAt,
  completedAt,
  failed,
  label,
  preview,
}: ToolViewProps & { label?: string; preview?: string }) {
  const wide = useMediaQuery("(min-width: 1280px)");
  const duration = useElapsed(startedAt, completedAt);
  const hasDiff = !!diff && diff.trim().length > 0;
  const hasOutput = output !== undefined && output !== "";

  return (
    <CodeChatTool failed={failed} defaultOpen={hasDiff}>
      <CodeChatToolHeader
        label={label ?? name}
        preview={preview ?? defaultPreview(args)}
        duration={duration}
        running={running}
        expandable={hasOutput || hasDiff}
      />
      <CodeChatToolContent>
        {hasDiff && (
          <CodeChatDiff diff={diff!} defaultView={wide ? "split" : "unified"}>
            <CodeChatDiffHeader>
              <CodeChatDiffStats />
              <CodeChatDiffSpacer />
              <CodeChatDiffViewToggle />
              <CodeChatDiffCopyButton />
            </CodeChatDiffHeader>
            <CodeChatToolDiff>
              <CodeChatDiffContent />
            </CodeChatToolDiff>
          </CodeChatDiff>
        )}
        {hasOutput && <CodeChatToolOutput>{output}</CodeChatToolOutput>}
      </CodeChatToolContent>
    </CodeChatTool>
  );
}
