import { useState } from "react";
import type { ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { Highlight } from "prism-react-renderer";
import { cn } from "cn";
import { syntaxTheme } from "@/lib/syntax-highlight";
import { Button } from "@/components/ui/button";

interface CodeSnippetProps extends Omit<ComponentProps<"figure">, "title"> {
  code: string;
  language?: string;
  /** Filename or label shown in the header; defaults to the language. */
  title?: string;
  highlightLines?: number[];
  showLineNumbers?: boolean;
}

/** Code block: header with filename and copy button, highlighted body with optional line numbers. */
export function CodeSnippet({ className, code, language = "text", title, highlightLines = [], showLineNumbers = true, ...props }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const highlighted = new Set(highlightLines);
  const syntaxLanguage = language === "shell" ? "bash" : language;
  const isTs = /\.tsx?$/i.test(title ?? "") || ["ts", "tsx", "typescript"].includes(language);

  function copyCode() {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <figure data-slot="agent-code-block" className={cn("bg-card text-muted-foreground my-3 overflow-hidden rounded-sm border text-sm", className)} {...props}>
      <figcaption className="flex h-10 items-center gap-2 px-3">
        {isTs && <TypeScriptIcon aria-hidden="true" className="size-4 shrink-0 text-[#3178c6]" />}
        <span className="min-w-0 truncate text-[13px]">{title ?? language}</span>
        <Button aria-label="Copy code" className="ml-auto" onClick={copyCode} size="icon-xs" type="button" variant="ghost">
          <span className="grid *:col-start-1 *:row-start-1 *:transition-[opacity,scale] *:duration-150 motion-reduce:*:transition-opacity">
            <Copy className={cn(copied && "scale-75 opacity-0")} />
            <Check className={cn(!copied && "scale-75 opacity-0")} />
          </span>
        </Button>
      </figcaption>
      <Highlight code={code.trim()} language={syntaxLanguage} theme={syntaxTheme}>
        {({ getLineProps, getTokenProps, style, tokens }) => (
          <pre className="overflow-x-auto pb-2.5 font-mono text-[13px] leading-6" style={style}>
            <code>
              {tokens.map((line, lineIndex) => {
                const lineNumber = lineIndex + 1;
                return (
                  <span
                    {...getLineProps({ line })}
                    className={cn("block min-w-max px-4", highlighted.has(lineNumber) && "bg-foreground/[0.045]")}
                    key={lineIndex}
                  >
                    {showLineNumbers && (
                      <span aria-hidden="true" className="text-muted-foreground/55 mr-5 inline-block w-4 text-right select-none">
                        {lineNumber}
                      </span>
                    )}
                    {line.map((token, tokenIndex) => (
                      <span {...getTokenProps({ token })} key={tokenIndex} />
                    ))}
                  </span>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
}

function TypeScriptIcon(props: ComponentProps<"svg">) {
  return (
    <svg fill="currentColor" height="1em" viewBox="0 0 24 24" width="1em" {...props}>
      <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75q.918 0 1.627.111a6.4 6.4 0 0 1 1.306.34v2.458a4 4 0 0 0-.643-.361a5 5 0 0 0-.717-.26a5.5 5.5 0 0 0-1.426-.2q-.45 0-.819.086a2.1 2.1 0 0 0-.623.242q-.254.156-.393.374a.9.9 0 0 0-.14.49q0 .294.156.529q.156.234.443.444c.287.21.423.276.696.41q.41.203.926.416q.705.296 1.266.628q.561.333.963.753q.402.418.614.957q.213.538.214 1.253q0 .986-.373 1.656a3 3 0 0 1-1.012 1.085a4.4 4.4 0 0 1-1.487.596q-.85.18-1.79.18a10 10 0 0 1-1.84-.164a5.5 5.5 0 0 1-1.512-.493v-2.63a5.03 5.03 0 0 0 3.237 1.2q.5 0 .872-.09q.373-.09.623-.25q.249-.162.373-.38a1.02 1.02 0 0 0-.074-1.089a2.1 2.1 0 0 0-.537-.5a5.6 5.6 0 0 0-.807-.444a28 28 0 0 0-1.007-.436q-1.377-.575-2.053-1.405t-.676-2.005q0-.92.369-1.582q.368-.662 1.004-1.089a4.5 4.5 0 0 1 1.47-.629a7.5 7.5 0 0 1 1.77-.201m-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
    </svg>
  );
}
