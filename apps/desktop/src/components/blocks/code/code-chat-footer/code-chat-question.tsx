import type { ComponentProps, ReactNode } from "react";
import { Check, CircleHelp } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ComposerEditor } from "../../composer/composer-editor";

/** The footer's "question mode": replaces the composer while the agent waits for an answer. */
export function CodeChatQuestion({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="code-chat-question"
      role="group"
      aria-label="Agent question"
      className={cn("bg-muted/60 flex flex-col rounded-2xl border shadow-sm", className)}
      {...props}
    />
  );
}

type CodeChatQuestionHeaderProps = Omit<ComponentProps<"div">, "title"> & {
  title?: string;
  /** Right-aligned progress, e.g. "2 / 4" or "review". */
  progress?: string;
};

export function CodeChatQuestionHeader({ title = "Agent question", progress, className, ...props }: CodeChatQuestionHeaderProps) {
  return (
    <div data-slot="code-chat-question-header" className={cn("flex items-center gap-2 border-b px-3 py-2", className)} {...props}>
      <CircleHelp className="text-primary size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-semibold tracking-wide uppercase">{title}</span>
      {progress ? <span className="text-muted-foreground ml-auto font-mono text-[11px]">{progress}</span> : null}
    </div>
  );
}

export function CodeChatQuestionBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-question-body" className={cn("flex flex-col gap-3 px-3 py-3", className)} {...props} />;
}

export function CodeChatQuestionPrompt({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="code-chgat-question-prompt" className={cn("text-sm font-medium", className)} {...props} />;
}

export function CodeChatQuestionNote({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="code-chat-question-note" className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

export function CodeChatQuestionOptions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-question-options" role="group" className={cn("flex flex-col gap-0.5", className)} {...props} />;
}

type CodeChatQuestionOptionProps = Omit<ComponentProps<"button">, "children"> & {
  label: string;
  selected?: boolean;
};

export function CodeChatQuestionOption({ label, selected = false, className, type = "button", ...props }: CodeChatQuestionOptionProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      data-slot="code-chat-question-option"
      data-selected={selected || undefined}
      className={cn(
        "focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-2",
        selected ? "text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        className,
      )}
      {...props}
    >
      <Check className={cn("text-primary size-3.5 shrink-0", !selected && "invisible")} aria-hidden="true" />
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

type CodeChatQuestionInputProps = Omit<ComponentProps<typeof ComposerEditor>, "data-slot">;

/** The custom answer. Always the real composer editor (from useAnswerEditor) — @ file mentions work like in the chat footer. Grows with the text up to 4 lines, then scrolls. */
export function CodeChatQuestionInput({ className, ...props }: CodeChatQuestionInputProps) {
  return (
    <ComposerEditor
      data-slot="code-chat-question-input"
      className={cn(
        "bg-background/50 min-h-9 rounded-md border tracking-wide [&_.cp-composer]:max-h-[4.75rem] [&_.cp-composer]:min-h-9 [&_.cp-composer]:px-2.5 [&_.cp-composer]:py-2.5",
        className,
      )}
      {...props}
    />
  );
}

export function CodeChatQuestionReview({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-question-review" className={cn("flex flex-col gap-2 px-3 py-3", className)} {...props} />;
}

export function CodeChatQuestionReviewTitle({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="code-chat-question-review-title" className={cn("text-[11px] font-semibold tracking-wide uppercase", className)} {...props} />;
}

type CodeChatQuestionReviewItemProps = Omit<ComponentProps<"div">, "children"> & {
  question: string;
  answer: string;
};

export function CodeChatQuestionReviewItem({ question, answer, className, ...props }: CodeChatQuestionReviewItemProps) {
  return (
    <div data-slot="code-chat-question-review-item" className={cn("flex flex-col gap-0.5 border-t pt-2 first:border-t-0 first:pt-0", className)} {...props}>
      <span className="text-muted-foreground text-xs">{question}</span>
      <span className={cn("text-sm font-medium", !answer && "text-muted-foreground/60 italic")}>{answer || "no answer"}</span>
    </div>
  );
}

export function CodeChatQuestionActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-question-actions" className={cn("flex items-center gap-1 border-t px-1.5 py-1.5", className)} {...props} />;
}

const actionVariants = cva("rounded-full", {
  variants: {
    kind: {
      back: "",
      stop: "ml-auto",
      next: "",
    },
  },
  defaultVariants: { kind: "next" },
});

const ACTION_VARIANT = { back: "ghost", stop: "destructive", next: "default" } as const;

type CodeChatQuestionActionProps = Omit<ComponentProps<"button">, "children"> &
  VariantProps<typeof actionVariants> & {
    label: string;
    icon?: ReactNode;
    /** Puts the icon after the label (Next →). */
    iconAfter?: boolean;
  };

export function CodeChatQuestionAction({ kind = "next", label, icon, iconAfter = false, className, type = "button", ...props }: CodeChatQuestionActionProps) {
  const resolved = kind ?? "next";
  return (
    <Button
      type={type}
      size="sm"
      variant={ACTION_VARIANT[resolved]}
      data-slot="code-chat-question-action"
      data-kind={resolved}
      className={cn(actionVariants({ kind: resolved }), className)}
      {...props}
    >
      {!iconAfter ? icon : null}
      {label}
      {iconAfter ? icon : null}
    </Button>
  );
}

type CodeChatQuestionErrorProps = Omit<ComponentProps<"div">, "title"> & {
  title: string;
  message?: string;
};

/** Shown instead of the question when it can't be rendered. Actions (retry, stop) go in as children. */
export function CodeChatQuestionError({ title, message, className, children, ...props }: CodeChatQuestionErrorProps) {
  return (
    <div
      data-slot="code-chat-question-error"
      role="alert"
      className={cn("bg-card border-destructive/50 flex flex-col gap-2 rounded-2xl border px-3 py-2.5 text-xs", className)}
      {...props}
    >
      <p className="text-destructive font-semibold">{title}</p>
      {message ? <p className="text-muted-foreground font-mono break-words">{message}</p> : null}
      {children ? <div className="flex items-center gap-1.5">{children}</div> : null}
    </div>
  );
}
