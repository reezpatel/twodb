import type { ComponentProps } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeChatAttachments({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-attachments" className={cn("flex flex-wrap gap-2 px-1 pb-2", className)} {...props} />;
}

type CodeChatAttachmentProps = ComponentProps<"div"> & {
  name: string;
  previewUrl?: string;
  onRemove?: () => void;
};

export function CodeChatAttachment({ name, previewUrl, onRemove, className, ...props }: CodeChatAttachmentProps) {
  return (
    <div
      data-slot="code-chat-attachment"
      className={cn("group bg-background/50 relative flex items-center gap-2 rounded-xl border p-1 pr-2 font-mono text-xs", className)}
      {...props}
    >
      {previewUrl ? (
        <img src={previewUrl} alt={name} className="size-10 rounded-lg object-cover" />
      ) : (
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
          <Paperclip className="size-4" aria-hidden="true" />
        </span>
      )}
      <span className="max-w-40 truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="bg-background text-muted-foreground hover:text-destructive focus-visible:ring-ring absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border outline-none focus-visible:ring-2"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export function CodeChatAttachmentUploading({ className, children = "uploading…", ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="code-chat-attachment-uploading" className={cn("text-muted-foreground flex items-center gap-1.5 px-1 py-1 text-xs", className)} {...props}>
      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      {children}
    </span>
  );
}
