import * as React from "react";
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./model-picker";

export interface PromptAttachment {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  type?: string;
  /** Present when the attachment came from the file picker or a paste. */
  file?: File;
}

export interface PromptInputModel {
  id: string;
  label: string;
  hint?: string;
}

interface PromptInputContextValue {
  value: string;
  setValue: (next: string) => void;
  attachments: PromptAttachment[];
  addFiles: (files: Iterable<File>) => void;
  removeAttachment: (id: string) => void;
  disabled: boolean;
  isStreaming: boolean;
  canSubmit: boolean;
  submit: () => void;
  stop: () => void;
  textareaId: string;
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null);

function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) {
    throw new Error("PromptInput parts must be rendered inside <PromptInput>.");
  }
  return context;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

let attachmentSeq = 0;

const toAttachment = (file: File): PromptAttachment => {
  attachmentSeq += 1;
  return {
    id: `${file.name}-${file.size}-${attachmentSeq}`,
    name: file.name,
    size: file.size,
    type: file.type,
    file,
  };
};

export interface PromptInputProps extends Omit<React.ComponentProps<"form">, "onSubmit" | "defaultValue" | "value" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  defaultAttachments?: PromptAttachment[];
  onAttachmentsChange?: (attachments: PromptAttachment[]) => void;
  /**
   * Called with the trimmed text and the current attachments. In uncontrolled mode
   * the text clears afterwards; when `value` is controlled, clear it yourself here.
   * Attachments always clear.
   */
  onSubmit?: (value: string, options: { attachments: PromptAttachment[] }) => void;
  disabled?: boolean;
  /** Turns the submit button into a Stop button that calls `onStop`. */
  isStreaming?: boolean;
  onStop?: () => void;
}

function PromptInput({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  defaultAttachments,
  onAttachmentsChange,
  onSubmit,
  disabled = false,
  isStreaming = false,
  onStop,
  className,
  children,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internalValue;
  const [attachments, setAttachments] = React.useState<PromptAttachment[]>(() => defaultAttachments ?? []);
  const textareaId = React.useId();

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const addFiles = React.useCallback(
    (files: Iterable<File>) => {
      const added = Array.from(files).map(toAttachment);
      if (added.length === 0) return;
      const next = [...attachments, ...added];
      setAttachments(next);
      onAttachmentsChange?.(next);
    },
    [attachments, onAttachmentsChange],
  );

  const removeAttachment = React.useCallback(
    (id: string) => {
      const next = attachments.filter((a) => a.id !== id);
      setAttachments(next);
      onAttachmentsChange?.(next);
    },
    [attachments, onAttachmentsChange],
  );

  const canSubmit = !disabled && (value.trim().length > 0 || attachments.length > 0);

  const submit = React.useCallback(() => {
    if (isStreaming || !canSubmit) return;
    onSubmit?.(value.trim(), { attachments });
    if (!isControlled) setInternalValue("");
    if (attachments.length > 0) {
      setAttachments([]);
      onAttachmentsChange?.([]);
    }
  }, [isStreaming, canSubmit, onSubmit, value, attachments, isControlled, onAttachmentsChange]);

  const stop = React.useCallback(() => onStop?.(), [onStop]);

  const context = React.useMemo<PromptInputContextValue>(
    () => ({ value, setValue, attachments, addFiles, removeAttachment, disabled, isStreaming, canSubmit, submit, stop, textareaId }),
    [value, setValue, attachments, addFiles, removeAttachment, disabled, isStreaming, canSubmit, submit, stop, textareaId],
  );

  return (
    <PromptInputContext.Provider value={context}>
      <form
        data-slot="prompt-input"
        data-streaming={isStreaming || undefined}
        data-disabled={disabled || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          "flex w-full flex-col gap-2 rounded-[14px] border border-outline bg-paper p-2 text-ink transition-[border-color,box-shadow] outline-none",
          "focus-within:outline-2 focus-within:outline-ion-deep focus-within:-outline-offset-1",
          "data-[disabled]:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
}

export interface PromptInputTextareaProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Grows with the text up to this many rows, then scrolls. */
  maxRows?: number;
  minRows?: number;
}

function PromptInputTextarea({ maxRows = 6, minRows = 1, placeholder = "Ask anything", className, onKeyDown, onPaste, ...props }: PromptInputTextareaProps) {
  const { value, setValue, submit, addFiles, disabled, textareaId } = usePromptInput();
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const styles = getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight) || 24;
    const padding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const min = lineHeight * minRows + padding;
    const max = lineHeight * maxRows + padding;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, min), max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, maxRows, minRows]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // Enter sends, Shift+Enter breaks the line. Leave IME composition alone.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented) return;
    const files = event.clipboardData?.files;
    if (files && files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  };

  return (
    <textarea
      ref={ref}
      id={textareaId}
      data-slot="prompt-input-textarea"
      rows={minRows}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn(
        "min-h-0 w-full resize-none rounded-none border-0 bg-transparent px-2 py-1.5 font-sans text-[14px] leading-6 text-ink shadow-none outline-none",
        "placeholder:text-muted-foreground/70 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export type PromptInputToolbarProps = React.ComponentProps<"div">;

function PromptInputToolbar({ className, ...props }: PromptInputToolbarProps) {
  return <div data-slot="prompt-input-toolbar" className={cn("flex items-center gap-1", className)} {...props} />;
}

export type PromptInputActionsProps = React.ComponentProps<"div">;

/** Start-side group in the toolbar; whatever follows it is pushed to the end. */
function PromptInputActions({ className, ...props }: PromptInputActionsProps) {
  return <div data-slot="prompt-input-actions" className={cn("me-auto flex items-center gap-1", className)} {...props} />;
}

export interface PromptInputAttachProps extends Omit<React.ComponentProps<"button">, "onChange" | "type" | "children"> {
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
}

function PromptInputAttach({ accept, multiple = true, className, children, ...props }: PromptInputAttachProps) {
  const { addFiles, disabled } = usePromptInput();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        data-slot="prompt-input-attach-input"
        className="hidden"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          // Reset so picking the same file twice still fires a change.
          event.target.value = "";
        }}
      />
      <button
        type="button"
        data-slot="prompt-input-attach"
        disabled={disabled}
        aria-label="Attach files"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground outline-none transition-colors",
          "hover:bg-paper-grid hover:text-ink focus-visible:outline-2 focus-visible:outline-ion-deep disabled:pointer-events-none disabled:opacity-45",
          className,
        )}
        {...props}
      >
        {children ?? <Paperclip className="size-4" strokeWidth={1.5} aria-hidden />}
      </button>
    </>
  );
}

export type PromptInputAttachmentsProps = React.ComponentProps<"div">;

/** Renders a chip per attachment; pass children to lay them out yourself. */
function PromptInputAttachments({ className, children, ...props }: PromptInputAttachmentsProps) {
  const { attachments, removeAttachment } = usePromptInput();
  if (children == null && attachments.length === 0) return null;

  return (
    <div data-slot="prompt-input-attachments" className={cn("flex flex-wrap gap-1.5 px-1 pt-1", className)} {...props}>
      {children ??
        attachments.map((attachment) => (
          <PromptInputAttachment key={attachment.id} name={attachment.name} size={attachment.size} onRemove={() => removeAttachment(attachment.id)} />
        ))}
    </div>
  );
}

export interface PromptInputAttachmentProps extends Omit<React.ComponentProps<"div">, "children"> {
  name: string;
  /** Bytes. */
  size?: number;
  icon?: React.ReactNode;
  onRemove?: () => void;
}

function PromptInputAttachment({ name, size, icon, onRemove, className, ...props }: PromptInputAttachmentProps) {
  return (
    <div
      data-slot="prompt-input-attachment"
      className={cn("inline-flex max-w-full items-center gap-1.5 rounded-[6px] border border-outline bg-stone py-1 ps-2 pe-1 text-[12px] text-ink", className)}
      {...props}
    >
      <span className="shrink-0 text-muted-foreground [&_svg]:size-3.5">{icon ?? <FileText strokeWidth={1.5} aria-hidden />}</span>
      <span className="max-w-40 truncate">{name}</span>
      {size != null ? <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{formatBytes(size)}</span> : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="ms-0.5 flex size-5 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground outline-none transition-colors hover:bg-paper-grid hover:text-ink focus-visible:outline-2 focus-visible:outline-ion-deep"
        >
          <X className="size-3" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export interface PromptInputModelSelectProps {
  models: PromptInputModel[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

function PromptInputModelSelect({ models, value: valueProp, defaultValue, onValueChange, className }: PromptInputModelSelectProps) {
  const { disabled } = usePromptInput();
  const [internalValue, setInternalValue] = React.useState(() => defaultValue ?? models[0]?.id ?? "");
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internalValue;
  const selected = models.find((m) => m.id === value) ?? models[0];

  const handleChange = (id: string) => {
    if (!isControlled) setInternalValue(id);
    onValueChange?.(id);
  };

  return (
    <div data-slot="prompt-input-model-select" className={className}>
      {/* Reuse the existing ModelPicker for consistent styling. */}
      <ModelPickerAdapter models={models} value={value} onChange={handleChange} disabled={disabled} label={selected?.label ?? "Select model"} />
    </div>
  );
}

/** Thin adapter from PromptInputModel[] to the existing ModelPicker props. */
function ModelPickerAdapter({
  models,
  value,
  onChange,
  disabled,
  label,
}: {
  models: PromptInputModel[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  label: string;
}) {
  const providers = React.useMemo(
    () => [{ id: "models", title: "Models", models: models.map((m) => ({ id: m.id, label: m.label })) }],
    [models],
  );
  return (
    <span aria-label={`Model: ${label}`} aria-disabled={disabled || undefined}>
      <ModelPicker providers={providers} value={value} onChange={onChange} />
    </span>
  );
}

export type PromptInputSubmitProps = Omit<React.ComponentProps<"button">, "type" | "children">;

function PromptInputSubmit({ className, ...props }: PromptInputSubmitProps) {
  const { canSubmit, isStreaming, stop } = usePromptInput();

  if (isStreaming) {
    return (
      <button
        type="button"
        data-slot="prompt-input-submit"
        data-state="streaming"
        aria-label="Stop generating"
        onClick={stop}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper outline-none transition-colors",
          "hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2",
          className,
        )}
        {...props}
      >
        <Square className="size-3 fill-current" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="submit"
      data-slot="prompt-input-submit"
      data-state="idle"
      aria-label="Send message"
      disabled={!canSubmit}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper outline-none transition-colors",
        "hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <ArrowUp className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}

export type PromptInputHintProps = React.ComponentProps<"p">;

function PromptInputHint({ className, children, ...props }: PromptInputHintProps) {
  return (
    <p data-slot="prompt-input-hint" className={cn("flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground", className)} {...props}>
      {children ?? (
        <>
          <span>Enter to send</span>
          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
          <span>Shift+Enter for a new line</span>
        </>
      )}
    </p>
  );
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputActions,
  PromptInputAttach,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputModelSelect,
  PromptInputSubmit,
  PromptInputHint,
  usePromptInput,
};
