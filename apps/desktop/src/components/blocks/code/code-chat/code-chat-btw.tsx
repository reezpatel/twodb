import type { ComponentProps } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeChatSessionLink } from "./code-chat-session-link";

type CodeChatBtwProps = Omit<ComponentProps<typeof CodeChatSessionLink>, "icon" | "title" | "meta" | "description" | "trailing"> & {
  agentName: string;
  closed?: boolean;
  preview?: string;
};

export function CodeChatBtw({ agentName, closed = false, preview, ...props }: CodeChatBtwProps) {
  return <CodeChatSessionLink icon={<Lock />} title={`/btw — Agent ${agentName}`} meta={closed ? "closed" : "open"} description={preview} {...props} />;
}

export function CodeChatBtwClosed({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="code-chat-btw-closed" className={cn("text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm italic", className)} {...props}>
      <Lock className="size-3" aria-hidden="true" />
      {children}
    </div>
  );
}
