import type { ReactNode } from "react";
import { markdownStyles } from "./markdown.style";

const inline = (text: string): ReactNode[] => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="md__inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index}>{part.slice(2, -2)}</strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={index}>{part.slice(1, -1)}</em>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

const renderBlock = (block: string, key: number): ReactNode => {
  const lines = block.split("\n");

  if (block.startsWith("```")) {
    const first = lines[0]?.slice(3).trim() ?? "";
    const code = lines.slice(1, lines.at(-1)?.trim() === "" ? -1 : undefined).join("\n");
    return (
      <pre key={key} className="md__code" data-lang={first || undefined}>
        <code>{code}</code>
      </pre>
    );
  }

  if (/^#{1,6} /.test(block)) {
    const level = block.match(/^#+/)?.[0].length ?? 1;
    const Tag = (`h${Math.min(level + 1, 6)}`) as "h2" | "h3" | "h4" | "h5" | "h6";
    return <Tag key={key}>{inline(block.replace(/^#+\s*/, ""))}</Tag>;
  }

  if (lines.every((line) => line.trimStart().startsWith("- ") || line.trim() === "")) {
    return (
      <ul key={key}>
        {lines
          .filter((line) => line.trim() !== "")
          .map((line, i) => (
            <li key={i}>{inline(line.trimStart().slice(2))}</li>
          ))}
      </ul>
    );
  }

  if (lines.every((line) => /^\s*\d+[.)] /.test(line) || line.trim() === "")) {
    return (
      <ol key={key}>
        {lines
          .filter((line) => line.trim() !== "")
          .map((line, i) => (
            <li key={i}>{inline(line.replace(/^\s*\d+[.)]\s*/, ""))}</li>
          ))}
      </ol>
    );
  }

  return (
    <p key={key}>
      {inline(block)}
    </p>
  );
};

export function Markdown({ children }: { children: string }) {
  const blocks = children.split(/\n(?=```)|\n{2,}/).filter((block) => block.trim() !== "");
  return (
    <div className="md">
      <style jsx global>
        {markdownStyles}
      </style>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
