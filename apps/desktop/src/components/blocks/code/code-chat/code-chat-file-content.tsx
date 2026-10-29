import { useMemo, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { tokenizeLines } from "@/lib/syntax-highlight";
import { CodeChatTokens } from "./code-chat-tokens";

type CodeChatFileContentProps = Omit<ComponentProps<"div">, "children"> & {
  content: string;
  /** Prism language for syntax highlighting; plain text when omitted or unsupported. */
  language?: string;
  /** Number of the first line, for a range read from the middle of a file. */
  startLine?: number;
  /** Shown instead of the lines when the content is empty. */
  emptyLabel?: string;
};

/** Numbered, read-only view of a file's text, for write_file where there is nothing to diff against. */
export function CodeChatFileContent({ content, language, startLine = 1, emptyLabel = "empty file", className, ...props }: CodeChatFileContentProps) {
  const text = content.endsWith("\n") ? content.slice(0, -1) : content;
  const lines = text === "" ? [] : text.split("\n");
  const tokens = useMemo(() => tokenizeLines(text, language), [text, language]);

  return (
    <div data-slot="code-chat-file-content" className={cn("overflow-auto", className)} {...props}>
      {lines.length === 0 ? (
        <p className="text-muted-foreground px-3 py-2 italic">{emptyLabel}</p>
      ) : (
        <table className="w-full min-w-max font-mono">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="text-muted-foreground/50 w-10 px-2 text-right text-[11px] leading-6 select-none">{startLine + index}</td>
                <td className="text-foreground/85 pr-3 leading-6 whitespace-pre">
                  <CodeChatTokens tokens={tokens?.[index]} fallback={line} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
