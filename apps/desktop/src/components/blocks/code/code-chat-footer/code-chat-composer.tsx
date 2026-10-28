import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ComposerEditor } from "../../composer/composer-editor";

type CodeChatComposerProps = ComponentProps<"div"> & {
  busy?: boolean;
};

export function CodeChatComposer({ busy = false, className, ...props }: CodeChatComposerProps) {
  return (
    <div
      data-slot="code-chat-composer"
      data-busy={busy || undefined}
      className={cn("bg-muted/60 flex flex-col rounded-2xl border p-2 shadow-sm transition-colors", busy && "border-primary/50", className)}
      {...props}
    />
  );
}

type CodeChatComposerInputProps = Omit<ComponentProps<typeof ComposerEditor>, "data-slot">;

/** The message editor. Always the real composer editor (from useComposer) — never custom children. */
export function CodeChatComposerInput({ className, ...props }: CodeChatComposerInputProps) {
  return <ComposerEditor data-slot="code-chat-composer-input" className={cn(className)} {...props} />;
}

export function CodeChatComposerActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-composer-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}

export function CodeChatComposerSpacer() {
  return <span data-slot="code-chat-composer-spacer" className="flex-1" aria-hidden="true" />;
}
