import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Paperclip, Send, X } from "lucide-react";
import { Button } from "@twodb/blocks";
import type { Asset, Message } from "../../../lib/chat-client";

/**
 * Message composer: text + file attachments (uploaded to storage, embedded as
 * attachment blocks), reply-to preview, typing events, draft persistence.
 */

export interface ComposerProps {
  channelId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: (input: { text?: string; blocks?: unknown[]; replyToId?: string }) => Promise<void>;
  onTyping: () => void;
  onUpload: (files: File[]) => Promise<Asset[]>;
  initialDraft?: string;
  onDraftChange: (text: string) => void;
  disabled?: boolean;
}

export function Composer(props: ComposerProps) {
  const [text, setText] = useState(props.initialDraft ?? "");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Asset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(0);

  // Draft restore when switching channels.
  useEffect(() => {
    setText(props.initialDraft ?? "");
    setAttachments([]);
  }, [props.channelId]);

  const submit = async () => {
    const value = text.trim();
    if ((!value && !attachments.length) || sending) return;
    setSending(true);
    try {
      const blocks = attachments.length
        ? [...(value ? [{ type: "markdown", text: value }] : []), ...attachments.map((a) => ({ type: "attachment", assetId: a.id, filename: a.filename }))]
        : undefined;
      await props.onSend({ text: value || undefined, blocks, replyToId: props.replyTo?.id });
      setText("");
      setAttachments([]);
      props.onDraftChange("");
    } finally {
      setSending(false);
    }
  };

  const onTextChanged = (value: string) => {
    setText(value);
    props.onDraftChange(value);
    const now = Date.now();
    if (now - typingRef.current > 2000) {
      typingRef.current = now;
      props.onTyping();
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const assets = await props.onUpload([...files]);
      setAttachments((prev) => [...prev, ...assets]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card p-3">
      {props.replyTo ? (
        <div className="flex items-center gap-2 rounded-md border-l-2 border-primary/50 bg-muted/50 px-2 py-1 text-xs">
          <CornerUpLeft size={12} className="shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-medium text-primary">@{props.replyTo.authorName}</span>
          <span className="truncate text-muted-foreground">{props.replyTo.text.slice(0, 100) || "(attachments)"}</span>
          <button type="button" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground" onClick={props.onCancelReply} aria-label="Cancel reply">
            <X size={13} />
          </button>
        </div>
      ) : null}

      {attachments.length ? (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
              📎 {a.filename}
              <button type="button" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.filename}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void pickFiles(e.target.files)}
          aria-label="Attach files"
        />
        <Button variant="ghost" size="sm" aria-label="Attach files" disabled={uploading || props.disabled} onClick={() => fileRef.current?.click()}>
          <Paperclip size={15} className={uploading ? "animate-pulse" : undefined} />
        </Button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onTextChanged(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={props.disabled ? "You're not a member of this channel" : "Message… (@ to mention)"}
          disabled={props.disabled}
          rows={1}
          className="max-h-40 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50"
        />
        <Button size="sm" aria-label="Send" disabled={props.disabled || sending || (!text.trim() && !attachments.length)} onClick={() => void submit()}>
          <Send size={15} />
        </Button>
      </div>
    </div>
  );
}
