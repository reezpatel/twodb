import { useEffect, useState } from "react";

const COPIED_RESET_MS = 1600;

/** Business state for MessageBubble's copy + feedback affordances. */
export function useMessageBubbleActions(copyText?: string, onVote?: (vote: "up" | "down") => void) {
  const [hasCopied, setHasCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!hasCopied) return;
    const timeout = setTimeout(() => setHasCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timeout);
  }, [hasCopied]);

  const copy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setHasCopied(true);
    } catch {
      // Clipboard permission failures should not interrupt the conversation.
    }
  };

  const castVote = (next: "up" | "down") => {
    setVote(next);
    onVote?.(next);
  };

  return { hasCopied, vote, copy, castVote };
}
