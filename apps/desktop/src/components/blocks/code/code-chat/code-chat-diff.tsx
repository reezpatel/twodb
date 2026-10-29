import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { AlignJustify, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeChatCopyButton } from "./code-chat-copy-button";
import { CodeChatDiffContext, useCodeChatDiff } from "./code-chat-diff-context";
import { CodeChatTokens } from "./code-chat-tokens";
import {
  diffStats,
  highlightDiffLines,
  languageFromDiff,
  parseUnifiedDiff,
  toSplitRows,
  type CodeChatDiffLine,
  type CodeChatDiffView,
} from "./code-chat-diff-utils";

type CodeChatDiffProps = Omit<ComponentProps<"div">, "children"> & {
  /** Unified diff text, as produced by update_file, write_file and apply_patch. */
  diff: string;
  /** Prism language for syntax highlighting. Defaults to the one implied by the diff's file header. */
  language?: string;
  view?: CodeChatDiffView;
  defaultView?: CodeChatDiffView;
  onViewChange?: (view: CodeChatDiffView) => void;
  children: ComponentProps<"div">["children"];
};

export function CodeChatDiff({
  diff,
  language,
  view: controlledView,
  defaultView = "unified",
  onViewChange,
  className,
  children,
  ...props
}: CodeChatDiffProps) {
  const [uncontrolledView, setUncontrolledView] = useState<CodeChatDiffView>(defaultView);
  const view = controlledView ?? uncontrolledView;

  const setView = useCallback(
    (next: CodeChatDiffView) => {
      if (controlledView === undefined) setUncontrolledView(next);
      onViewChange?.(next);
    },
    [controlledView, onViewChange],
  );

  const lines = useMemo(() => highlightDiffLines(parseUnifiedDiff(diff), language ?? languageFromDiff(diff)), [diff, language]);
  const value = useMemo(() => ({ text: diff, lines, view, setView }), [diff, lines, view, setView]);

  return (
    <CodeChatDiffContext.Provider value={value}>
      <div data-slot="code-chat-diff" className={cn("text-[13px]", className)} {...props}>
        {children}
      </div>
    </CodeChatDiffContext.Provider>
  );
}

export function CodeChatDiffHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-diff-header" className={cn("flex items-center gap-3 border-b px-3 py-1.5", className)} {...props} />;
}

export function CodeChatDiffStats({ className, ...props }: ComponentProps<"span">) {
  const { lines } = useCodeChatDiff();
  const { additions, deletions } = diffStats(lines);

  return (
    <span data-slot="code-chat-diff-stats" className={cn("flex gap-2 font-mono tabular-nums", className)} {...props}>
      <span className="text-success" aria-label={`${additions} additions`}>
        +{additions}
      </span>
      <span className="text-destructive" aria-label={`${deletions} deletions`}>
        −{deletions}
      </span>
    </span>
  );
}

export function CodeChatDiffSpacer() {
  return <span data-slot="code-chat-diff-spacer" className="flex-1" aria-hidden="true" />;
}

const VIEWS: { id: CodeChatDiffView; label: string; icon: typeof AlignJustify }[] = [
  { id: "unified", label: "Unified", icon: AlignJustify },
  { id: "split", label: "Split", icon: Columns2 },
];

export function CodeChatDiffViewToggle({ className, ...props }: ComponentProps<"div">) {
  const { view, setView } = useCodeChatDiff();

  return (
    <div data-slot="code-chat-diff-view-toggle" role="group" aria-label="Diff layout" className={cn("inline-flex items-center gap-0.5", className)} {...props}>
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={view === id}
          onClick={() => setView(id)}
          className={cn(
            "focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2",
            view === id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function CodeChatDiffCopyButton({ label = "Copy diff", ...props }: Omit<ComponentProps<typeof CodeChatCopyButton>, "value">) {
  const { text } = useCodeChatDiff();
  return <CodeChatCopyButton value={text} label={label} {...props} />;
}

const ROW_TONE = {
  added: "bg-success/10",
  removed: "bg-destructive/10",
  context: "",
  empty: "bg-muted/30",
} as const;

const MARK_TONE = {
  added: "text-success",
  removed: "text-destructive",
  context: "text-muted-foreground",
} as const;

const TEXT_TONE = {
  added: "text-foreground",
  removed: "text-foreground",
  context: "text-foreground/75",
} as const;

const GUTTER = "text-muted-foreground/50 w-10 select-none px-2 text-right text-[11px] leading-6";
const MARK = "w-4 select-none text-center leading-6";

function HunkRow({ content, span }: { content: string; span: number }) {
  return (
    <tr>
      <td colSpan={span} className="bg-muted text-muted-foreground px-3 py-0.5 font-mono text-[11px] whitespace-pre">
        {content}
      </td>
    </tr>
  );
}

function UnifiedTable({ lines }: { lines: CodeChatDiffLine[] }) {
  return (
    <table className="w-full min-w-max font-mono">
      <tbody>
        {lines.map((line, index) =>
          line.type === "hunk" ? (
            <HunkRow key={index} content={line.content} span={4} />
          ) : (
            <tr key={index} className={ROW_TONE[line.type]}>
              <td className={GUTTER}>{line.before ?? ""}</td>
              <td className={GUTTER}>{line.after ?? ""}</td>
              <td className={cn(MARK, MARK_TONE[line.type])} aria-hidden="true">
                {line.type === "added" ? "+" : line.type === "removed" ? "−" : ""}
              </td>
              <td className={cn("pr-3 leading-6 whitespace-pre", TEXT_TONE[line.type])}>
                <CodeChatTokens tokens={line.tokens} fallback={line.content} />
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function SplitTable({ lines }: { lines: CodeChatDiffLine[] }) {
  const rows = useMemo(() => toSplitRows(lines), [lines]);

  return (
    <table className="w-full min-w-max table-fixed font-mono">
      <colgroup>
        <col className="w-10" />
        <col />
        <col className="w-10" />
        <col />
      </colgroup>
      <tbody>
        {rows.map((row, index) =>
          row.type === "hunk" ? (
            <HunkRow key={index} content={row.content ?? ""} span={4} />
          ) : (
            <tr key={index}>
              <td className={cn(GUTTER, row.left ? ROW_TONE[row.left.type as "context" | "removed"] : ROW_TONE.empty)}>{row.left?.before ?? ""}</td>
              <td
                className={cn(
                  "px-2 leading-6 whitespace-pre",
                  row.left ? [ROW_TONE[row.left.type as "context" | "removed"], TEXT_TONE[row.left.type as "context" | "removed"]] : ROW_TONE.empty,
                )}
              >
                {row.left ? <CodeChatTokens tokens={row.left.tokens} fallback={row.left.content} /> : null}
              </td>
              <td className={cn(GUTTER, "border-l", row.right ? ROW_TONE[row.right.type as "context" | "added"] : ROW_TONE.empty)}>{row.right?.after ?? ""}</td>
              <td
                className={cn(
                  "px-2 leading-6 whitespace-pre",
                  row.right ? [ROW_TONE[row.right.type as "context" | "added"], TEXT_TONE[row.right.type as "context" | "added"]] : ROW_TONE.empty,
                )}
              >
                {row.right ? <CodeChatTokens tokens={row.right.tokens} fallback={row.right.content} /> : null}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

export function CodeChatDiffContent({ className, ...props }: ComponentProps<"div">) {
  const { lines, text, view } = useCodeChatDiff();

  return (
    <div data-slot="code-chat-diff-content" data-view={view} className={cn("overflow-x-auto", className)} {...props}>
      {lines.length === 0 ? (
        <pre className="text-muted-foreground px-3 py-2 font-mono whitespace-pre-wrap">{text}</pre>
      ) : view === "split" ? (
        <SplitTable lines={lines} />
      ) : (
        <UnifiedTable lines={lines} />
      )}
    </div>
  );
}
