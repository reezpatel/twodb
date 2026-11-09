import { normalizeTokens, Prism, type PrismTheme, type Token } from "prism-react-renderer";
import type { CSSProperties } from "react";

/** Syntax colors come from the theme's own tokens, so highlighting follows the palette automatically. */
export const syntaxTheme: PrismTheme = {
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

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "css",
  less: "css",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  vue: "markup",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  java: "clike",
  cs: "clike",
  php: "clike",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

/** Maps a file path to a bundled Prism grammar, or undefined when the file should render as plain text. */
export function languageFromPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return undefined;
  return LANGUAGE_BY_EXTENSION[name.slice(dot + 1).toLowerCase()];
}

/** Largest text that is tokenized; beyond this the text renders unhighlighted rather than blocking the UI. */
const MAX_HIGHLIGHT_CHARS = 200_000;

/** Tokenizes text into per-line tokens. Returns undefined when there is no grammar for the language. */
export function tokenizeLines(code: string, language: string | undefined): Token[][] | undefined {
  const grammar = language ? Prism.languages[language] : undefined;
  if (!grammar || code.length > MAX_HIGHLIGHT_CHARS) return undefined;
  return normalizeTokens(Prism.tokenize(code, grammar));
}

const styleByType = new Map<string, CSSProperties>();
for (const entry of syntaxTheme.styles) {
  for (const type of entry.types) styleByType.set(type, { ...styleByType.get(type), ...(entry.style as CSSProperties) });
}

/** Inline style for a token, merged from each of its types in the theme. */
export function tokenStyle(types: string[]): CSSProperties | undefined {
  let merged: CSSProperties | undefined;
  for (const type of types) {
    const style = styleByType.get(type);
    if (style) merged = { ...merged, ...style };
  }
  return merged;
}
