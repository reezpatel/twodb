import { useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type CodeChatCopyButtonProps = Omit<ComponentProps<typeof Button>, "children" | "value"> & {
  value: string;
  label?: string;
};

export function CodeChatCopyButton({ value, label = "Copy", ...props }: CodeChatCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      data-slot="code-chat-copy-button"
      variant="ghost"
      size="icon-sm"
      title={copied ? "Copied" : label}
      aria-label={label}
      onClick={() => void copy()}
      {...props}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </Button>
  );
}
