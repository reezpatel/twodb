import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeSnippet } from "@/components/ui/code-snippet";

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

/**
 * Shared message markdown renderer — streaming-tolerant.
 * "mono" (code chat) uses the mono font at 13px; "plain" (assistant) uses the
 * app's default font at body size.
 */
export function MessageMarkdown({ text, variant = "mono" }: { text: string; variant?: "mono" | "plain" }) {
  return (
    <div className={variant === "mono" ? "font-mono text-[13px] leading-relaxed" : "text-sm leading-relaxed"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-foreground mt-3 mb-1 text-sm font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-foreground mt-3 mb-1 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-foreground mt-2 mb-1 text-[13px] font-semibold">{children}</h3>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          a: ({ href, children }) => (
            <a className="text-primary underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => <blockquote className="text-muted-foreground mb-2 border-l-2 pl-3 last:mb-0">{children}</blockquote>,
          pre: ({ children }) => {
            const first = Children.toArray(children)[0];
            const className = isValidElement<{ className?: string }>(first) ? (first.props.className as string | undefined) : undefined;
            const match = /language-(\w+)/.exec(className ?? "");
            const code = nodeText(children).replace(/\n$/, "");
            if (!match) {
              return <pre className="bg-muted mb-2 overflow-x-auto rounded-lg border p-3 font-mono text-xs last:mb-0">{code}</pre>;
            }
            return <CodeSnippet code={code} language={match[1]} />;
          },
          code: ({ children }) => <code className="bg-muted rounded px-1 py-0.5 text-xs whitespace-pre-wrap break-all">{children}</code>,
          hr: () => <hr className="my-3" />,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
