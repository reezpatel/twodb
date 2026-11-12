import { Children, isValidElement, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";

/** GitHub-flavoured markdown; ```mermaid fences render as diagrams. */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="pa-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => {
            const el = Children.toArray(children)[0];
            const cls = isValidElement(el) ? (el as ReactElement<{ className?: string }>).props.className : "";
            return cls?.includes("language-mermaid") ? <>{children}</> : <pre>{children}</pre>;
          },
          code: ({ className, children }) =>
            className?.includes("language-mermaid") ? <MermaidBlock source={String(children).replace(/\n$/, "")} /> : <code className={className}>{children}</code>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
