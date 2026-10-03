import { useEffect, useRef } from "react";
import type { CellDisplayProps, CellEditProps } from "./types";

/** Which HTML <input type> the text editor renders. Lets the same editor cover
 * text/url/phone/email/id/place with native keyboard hints / validation. */
export type TextInputType = "text" | "url" | "tel" | "email";

const INPUT_BASE_CLASSES = "border-input bg-popover border rounded-md px-2 py-1 text-xs shadow-md focus:outline-none";
const FLOATING_STYLE_BASE = { position: "fixed", zIndex: 50 } as const;

function useFloatingDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void, active = true, onBeforeClose?: () => void) {
  useEffect(() => {
    if (!active) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onBeforeClose?.();
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, active, onBeforeClose]);
}

function useAutofocus(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
}

export function TextCellDisplay({ value, onActivate }: CellDisplayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div
      ref={ref}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onActivate(rect);
      }}
      className="hover:bg-accent/40 -mx-2 flex h-full min-h-[24px] cursor-text items-center truncate rounded px-2 text-xs"
    >
      {!isEmpty && String(value)}
    </div>
  );
}

export function TextCellEdit({ value, position, size, onCommit, onClose, inputType = "text" }: CellEditProps & { inputType?: TextInputType }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // When the user outside-clicks, commit the input's current value (if any)
  // before closing — otherwise the typed text is lost.
  useFloatingDismiss(inputRef, onClose, true, () => {
    if (inputRef.current) {
      const v = inputRef.current.value;
      onCommit(v === "" ? null : v);
    }
  });
  useAutofocus(inputRef);
  const style = { ...FLOATING_STYLE_BASE, left: position.x, top: position.y, width: size.width, minHeight: size.minHeight };
  return (
    <input
      ref={inputRef}
      type={inputType}
      style={style}
      className={INPUT_BASE_CLASSES}
      defaultValue={typeof value === "string" ? value : ""}
      placeholder="—"
      onBlur={(e) => onCommit(e.target.value === "" ? null : e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}
