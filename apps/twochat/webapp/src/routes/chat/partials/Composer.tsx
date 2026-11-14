import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CornerUpLeft, Paperclip, Send, X } from "lucide-react";
import { Button } from "@twodb/blocks";
import type { Asset, Member, Message } from "../../../lib/chat-client";
import { parseRichMentionValue, useRichMentionComposer } from "../hooks/useRichMentionComposer";
import { RichMentionEditor } from "./RichMentionEditor";

/** Rich message composer: structured mentions, attachments, replies, drafts. */
export interface ComposerProps {
  channelId: string;
  members: Member[];
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
  const [serialized, setSerialized] = useState(props.initialDraft ?? "");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Asset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef(0);

  const onRichValueChanged = useCallback((value: string) => {
    setSerialized(value);
    props.onDraftChange(value);
    const now = Date.now();
    if (now - typingRef.current > 2000) {
      typingRef.current = now;
      props.onTyping();
    }
  }, [props.onDraftChange, props.onTyping]);

  const rich = useRichMentionComposer(props.members, onRichValueChanged);

  // Reinitialize the contentEditable when switching conversations. setValue
  // is necessary because RichMentionsInput's defaultValue is intentionally
  // mount-only in the upstream library.
  useEffect(() => {
    const next = props.initialDraft ?? "";
    setSerialized(next);
    setAttachments([]);
    queueMicrotask(() => rich.setValue(next));
  }, [props.channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft loading is asynchronous. Apply it only while the new editor is
  // still empty, never over text the user has already started entering.
  useEffect(() => {
    if (!serialized && props.initialDraft) {
      setSerialized(props.initialDraft);
      rich.setValue(props.initialDraft);
    }
  }, [props.initialDraft, rich.setValue, serialized]);

  const submit = async () => {
    const source = rich.readValue() || serialized;
    const parsed = parseRichMentionValue(source);
    const plainText = parsed.plainText.trim();
    if ((!plainText && !attachments.length) || sending || props.disabled) return;
    setSending(true);
    try {
      const blocks: unknown[] = [];
      if (parsed.mentions.length) {
        blocks.push({ type: "rich-text", elements: parsed.elements });
      } else if (plainText && attachments.length) {
        blocks.push({ type: "markdown", text: plainText });
      }
      blocks.push(...attachments.map((asset) => ({ type: "attachment", assetId: asset.id, filename: asset.filename })));
      await props.onSend({
        text: plainText || undefined,
        blocks: blocks.length ? blocks : undefined,
        replyToId: props.replyTo?.id,
      });
      setSerialized("");
      rich.setValue("");
      setAttachments([]);
      props.onDraftChange("");
      rich.focus();
    } finally {
      setSending(false);
    }
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // react-rich-mentions handles Enter/Tab first while its suggestions are
    // open and marks the event prevented. Shift+Enter keeps the browser's
    // contentEditable newline behavior; an unmodified Enter sends.
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const assets = await props.onUpload([...files]);
      setAttachments((current) => [...current, ...assets]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasContent = !!parseRichMentionValue(serialized).plainText.trim() || attachments.length > 0;

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card p-3">
      {props.replyTo ? (
        <div className="flex items-center gap-2 rounded-md border-l-2 border-primary/50 bg-muted/50 px-2 py-1 text-xs">
          <CornerUpLeft size={12} className="shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-medium text-primary">@{props.replyTo.authorName}</span>
          <span className="truncate text-muted-foreground">{props.replyTo.text.slice(0, 100) || "(attachments)"}</span>
          <button type="button" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground" onClick={props.onCancelReply} aria-label="Cancel reply"><X size={13} /></button>
        </div>
      ) : null}

      {attachments.length ? (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((asset) => (
            <span key={asset.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
              📎 {asset.filename}
              <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== asset.id))} aria-label={`Remove ${asset.filename}`}><X size={11} /></button>
            </span>
          ))}
        </div>
      ) : null}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => void pickFiles(event.target.files)} aria-label="Attach files" />
      <div className="rounded-xl border border-border bg-background shadow-sm transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
        <div className="flex min-w-0 items-end gap-1 px-1.5 py-1">
          <Button
            variant="ghost"
            size="sm"
            className="mb-0.5 shrink-0 text-muted-foreground"
            aria-label="Attach files"
            title="Attach files"
            disabled={uploading || props.disabled}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={16} className={uploading ? "animate-pulse" : undefined} />
          </Button>
          <RichMentionEditor
            configs={rich.configs}
            contextRef={rich.contextRef}
            defaultValue={serialized}
            disabled={props.disabled}
            onInput={rich.handleInput}
            onKeyDown={onEditorKeyDown}
          />
          <Button
            size="sm"
            className="mb-0.5 shrink-0"
            aria-label="Send message"
            title="Send message"
            disabled={props.disabled || sending || !hasContent}
            onClick={() => void submit()}
          >
            <Send size={16} />
          </Button>
        </div>
        <div className="flex items-center justify-end border-t border-border/50 px-3 py-1 text-[10px] text-muted-foreground">
          <span><kbd className="font-sans">Shift</kbd> + <kbd className="font-sans">Enter</kbd> for a new line</span>
        </div>
      </div>
    </div>
  );
}
