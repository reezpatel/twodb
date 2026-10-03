import { useEffect, useRef } from "react";
import type { CellDisplayProps, CellEditProps } from "./types";

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

export function DateCellDisplay({ value, onActivate }: CellDisplayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = value === null || value === undefined || value === "";
  const display = !isEmpty ? new Date(String(value)).toLocaleDateString() : null;
  return (
    <div
      ref={ref}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onActivate(rect);
      }}
      className="hover:bg-accent/40 -mx-2 flex h-full min-h-[24px] cursor-text items-center truncate rounded px-2 text-xs"
    >
      {display}
    </div>
  );
}

export function DateCellEdit({ value, position, size, onCommit, onClose }: CellEditProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // When the user outside-clicks, commit the input's current value (if any)
  // before closing — otherwise the picked date is lost.
  useFloatingDismiss(inputRef, onClose, true, () => {
    if (inputRef.current) {
      const v = inputRef.current.value;
      onCommit(v === "" ? null : new Date(v).toISOString());
    }
  });
  useAutofocus(inputRef);
  const style = { ...FLOATING_STYLE_BASE, left: position.x, top: position.y, width: size.width, minHeight: size.minHeight };
  return (
    <input
      ref={inputRef}
      type="date"
      style={style}
      className={INPUT_BASE_CLASSES}
      defaultValue={typeof value === "string" ? value.slice(0, 10) : ""}
      onChange={(e) => onCommit(e.target.value === "" ? null : new Date(e.target.value).toISOString())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}
