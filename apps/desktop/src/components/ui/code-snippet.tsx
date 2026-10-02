import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import { Button } from "@/components/ui/button";

// Syntax colors come from the theme's own tokens, so highlighting follows
// the palette automatically.
const oldworldTheme: PrismTheme = {
  plain: { color: "var(--color-foreground)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "cdata"], style: { color: "var(--color-muted-foreground)", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "var(--color-muted-foreground)" } },
    { types: ["keyword", "control", "directive", "atrule", "important"], style: { color: "var(--color-primary)" } },
    { types: ["tag", "selector", "deleted"], style: { color: "var(--color-destructive)" } },
    { types: ["string", "char", "attr-value", "inserted"], style: { color: "var(--color-success)" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "var(--color-warning)" } },
    { types: ["function", "method"], style: { color: "var(--color-foreground)", fontWeight: "600" } },
    { types: ["class-name", "builtin", "attr-name", "property"], style: { color: "var(--color-primary)" } },
    { types: ["variable", "entity"], style: { color: "var(--color-foreground)" } },
  ],
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-6 w-6"
      title={copied ? "Copied" : "Copy"}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={8} /> : <Copy size={8} />}
    </Button>
  );
}

interface CodeSnippetProps {
  code: string;
  language?: string;
  /** Filename or label shown in the header; defaults to the language. */
  title?: string;
}

/** Mac-shell code block: traffic-light header with copy button, highlighted body. */
export function CodeSnippet({ code, language, title }: CodeSnippetProps) {
  const lang = language ?? "text";
  return (
    <div className="relative my-3">
      <div className="bg-muted/50 rounded-t-lg flex w-full items-center justify-between border px-3 py-1.5 ">
        <div className="flex items-center gap-2">
          <div className="bg-destructive h-2.5 w-2.5 rounded-full" aria-hidden="true" />
          <div className="bg-warning h-2.5 w-2.5 rounded-full" aria-hidden="true" />
          <div className="bg-success h-2.5 w-2.5 rounded-full" aria-hidden="true" />
          <span className="text-muted-foreground ml-1 font-mono text-[10px]">{title ?? lang}</span>
        </div>
        <CopyButton value={code} />
      </div>
      <Highlight theme={oldworldTheme} code={code} language={lang}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="bg-muted rounded-b-lg overflow-x-auto border-x border-b p-3 font-mono text-xs">
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
