import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailAttachment } from "../email-api";
import { useMessageHtml } from "./use-message-html";

/** Script-less sandboxed rendering of a message body; same-origin only so the parent can size it. */
export function MessageHtml({ html, attachments }: { html: string; attachments: EmailAttachment[] }) {
  const { frameRef, doc, height, remoteCount, allowRemote, setAllowRemote } = useMessageHtml(html, attachments);
  return (
    <div className="flex flex-col gap-2">
      {remoteCount > 0 && !allowRemote ? (
        <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
          <ImageOff size={13} /> Remote images are hidden to protect your privacy.
          <Button variant="link" size="xs" className="ml-auto h-auto p-0" onClick={() => setAllowRemote(true)}>
            Show images
          </Button>
        </div>
      ) : null}
      <iframe
        ref={frameRef}
        title="Message body"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={doc}
        className="w-full rounded-lg border bg-white"
        style={{ height }}
      />
    </div>
  );
}

export function MessageText({ text }: { text: string }) {
  return <pre className="text-foreground/90 m-0 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</pre>;
}
