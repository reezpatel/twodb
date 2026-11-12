import { useEffect, useRef } from "react";

/** Textarea that appears over a node while editing. Enter commits (Shift+Enter = newline), Esc cancels. */
export function InlineText(props: { value: string; onCommit(v: string): void; onCancel(): void; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      defaultValue={props.value}
      className={`nodrag nopan nowheel resize-none rounded-sm border border-ion-deep bg-white p-1 text-center outline-none ${props.className ?? ""}`}
      style={props.style}
      onBlur={(e) => props.onCommit(e.currentTarget.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") props.onCancel();
        else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          props.onCommit(e.currentTarget.value);
        }
      }}
    />
  );
}
