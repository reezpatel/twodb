import type { Token } from "prism-react-renderer";
import { tokenStyle } from "@/lib/syntax-highlight";

type CodeChatTokensProps = {
  tokens?: Token[];
  /** Rendered as-is when there are no tokens, e.g. an unsupported language. */
  fallback: string;
};

export function CodeChatTokens({ tokens, fallback }: CodeChatTokensProps) {
  if (!tokens) return <>{fallback}</>;
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} style={tokenStyle(token.types)}>
          {token.content}
        </span>
      ))}
    </>
  );
}
