import type { ReactNode } from "react";
import { CodeChatThreadRow } from "./code-chat-thread";

export function Row({ children, dimmed }: { children: ReactNode; dimmed?: boolean }) {
  return <CodeChatThreadRow dimmed={dimmed}>{children}</CodeChatThreadRow>;
}
