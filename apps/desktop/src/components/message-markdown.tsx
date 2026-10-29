import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Paperclip } from "lucide-react";
import { CodeSnippet } from "@/components/ui/code-snippet";
import { assetUrl } from "@/lib/native";

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

/**
 * Shared message markdown renderer — streaming-tolerant.
 * "mono" (code chat) is set at 13px; "plain" (assistant) at body size. Both use
 * the app's default font; only inline code and code blocks are monospaced.
 */
export function MessageMarkdown({
  text,
  variant = "mono",
  resolveAssetUrl,
}: {
  text: string;
  variant?: "mono" | "plain";
  /** Maps a twodb:// asset uri to a fetchable URL — enables image previews and attachment chips. */
  resolveAssetUrl?: (uri: string) => string | undefined;
}) {
  return (
    <div className={variant === "mono" ? "text-[15px] leading-relaxed font-light" : "text-base font-light leading-relaxed tracking-[0.01em]"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-4 last:mb-0 text-base">{children}</p>,
          h1: ({ children }) => <h1 className="text-foreground mt-3 mb-1 text-[16px] font-medium">{children}</h1>,
          h2: ({ children }) => <h2 className="text-foreground mt-3 mb-2 text-[16px] font-medium">{children}</h2>,
          h3: ({ children }) => <h3 className="text-foreground mt-2 mb-2 text-[15px] font-medium">{children}</h3>,
          ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ms-1 list-decimal pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="my-1 text-base">{children}</li>,
          strong: ({ children }) => <strong className="font-medium">{children}</strong>,
          a: ({ href, children }) => {
            // Uploaded-asset links render as chips (images inline) — the label
            // carries filename.ext so both the user and the model know the file.
            const isAsset = href?.startsWith("twodb://") || href?.includes("/api/storage/resolve/");
            if (href && isAsset) {
              const label = nodeText(children) || href;
              const url = resolveAssetUrl?.(href) ?? (href.startsWith("/api/") ? assetUrl(href) : undefined);
              if (url && /\.(png|jpe?g|gif|webp|bmp)$/i.test(label)) {
                return <img src={url} alt={label} title={label} loading="lazy" className="max-h-56 rounded-lg border" />;
              }
              return (
                <span className="bg-muted/60 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs">
                  <Paperclip size={11} aria-hidden="true" /> {label}
                </span>
              );
            }
            return (
              <a className="text-primary underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="bg-muted/80 text-muted-foreground py-2 mb-4 mt-4 border-l-4 border-info pl-3 last:mb-0">{children}</blockquote>
          ),
          pre: ({ children }) => {
            const first = Children.toArray(children)[0];
            const className = isValidElement<{ className?: string }>(first) ? (first.props.className as string | undefined) : undefined;
            const match = /language-(\w+)/.exec(className ?? "");
            const code = nodeText(children).replace(/\n$/, "");

            if (!match) {
              return <pre className="bg-muted mb-2 overflow-x-auto rounded-sm border p-3 font-mono text-[13px] last:mb-0">{code}</pre>;
            }

            return <CodeSnippet code={code} language={match?.[1] ?? ""} />;
          },
          code: ({ children }) => <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs whitespace-pre-wrap break-all">{children}</code>,
          hr: () => <hr className="my-3" />,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-3 py-1.5 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border px-3 py-1.5 align-top">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
