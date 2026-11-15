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
  // The mention input is uncontrolled: it reads `defaultValue` at mount only. Feeding it live state made React
  // rewrite the editor DOM (dangerouslySetInnerHTML) on every keystroke — losing characters and resetting the
  // caret to the start. Later value changes must go through rich.setValue, which preserves the caret.
  const [mountValue] = useState(props.initialDraft ?? "");
  // Latest parent callbacks without re-creating handlers: new handler identities would re-render the editor.
  const parentRef = useRef({ draft: props.onDraftChange, typing: props.onTyping });
  parentRef.current = { draft: props.onDraftChange, typing: props.onTyping };
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Asset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef(0);

  const onRichValueChanged = useCallback((value: string) => {
    setSerialized(value);
    parentRef.current.draft(value);
    const now = Date.now();
    if (now - typingRef.current > 2000) {
      typingRef.current = now;
      parentRef.current.typing();
    }
  }, []);

  const rich = useRichMentionComposer(props.members, onRichValueChanged);

  // Draft loading is asynchronous (the composer itself is keyed per channel). Apply the loaded draft exactly
  // once — before the user has typed anything — by tracking which draft value was already applied.
  const appliedDraftRef = useRef<string | null>(null);
  useEffect(() => {
    if (!props.initialDraft || appliedDraftRef.current === props.initialDraft) return;
    if (serialized) return; // user already typed; never overwrite
    appliedDraftRef.current = props.initialDraft;
    setSerialized(props.initialDraft);
    rich.setValue(props.initialDraft);
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

  // submit reads live state, but the key handler itself must keep a stable identity for the memoized editor.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const onEditorKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    // react-rich-mentions handles Enter/Tab first while its suggestions are
    // open and marks the event prevented. Shift+Enter keeps the browser's
    // contentEditable newline behavior; an unmodified Enter sends.
    // (nativeEvent is absent when this is a raw DOM event from RichMentionEditor's listener)
    const native = (event as unknown as { nativeEvent?: { isComposing?: boolean } }).nativeEvent;
    if (event.defaultPrevented || native?.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitRef.current();
    }
  }, []);

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
            key={rich.editorKey}
            defaultValue={serialized || mountValue}
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
