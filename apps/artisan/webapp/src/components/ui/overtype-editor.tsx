import { useEffect, useRef } from "react";
import OverType, { type Theme } from "overtype";

/** OverType palette driven by the app's CSS tokens, so light/dark follow the theme. */
const THEME: Theme = {
  name: "artisan",
  colors: {
    bgPrimary: "transparent",
    bgSecondary: "transparent",
    text: "var(--ink)",
    textPrimary: "var(--ink)",
    textSecondary: "var(--ink-muted)",
    placeholder: "var(--ink-muted)",
    primary: "var(--ion-deep)",
    h1: "var(--ion-deep)",
    h2: "var(--ion-deep)",
    h3: "var(--ion-deep)",
    strong: "var(--ink)",
    em: "var(--ink)",
    del: "var(--ink-muted)",
    link: "var(--ion-deep)",
    code: "var(--ink)",
    codeBg: "color-mix(in oklab, var(--ink) 8%, transparent)",
    blockquote: "var(--ink-muted)",
    hr: "var(--ink-muted)",
    listMarker: "var(--ink-muted)",
    rawLine: "var(--ink-muted)",
    syntax: "var(--ink-muted)",
    syntaxMarker: "var(--ink-muted)",
    cursor: "var(--ink)",
    selection: "color-mix(in oklab, var(--ion-deep) 30%, transparent)",
    border: "var(--outline)",
    hoverBg: "var(--surface-muted)",
    toolbarBg: "var(--paper)",
    toolbarIcon: "var(--ink)",
    toolbarHover: "var(--surface-muted)",
    toolbarActive: "var(--ion-deep)",
    toolbarBorder: "var(--outline)",
  },
};

export interface OvertypeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Called on ⌘/Ctrl+S inside the editor. */
  onSave?: () => void;
}

/** OverType markdown source editor. Uncontrolled — remount via `key` to swap documents. */
export function OvertypeEditor({ value, onChange, placeholder, ariaLabel, className, onSave }: OvertypeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const [editor] = OverType.init(host, {
      value,
      placeholder,
      theme: THEME,
      fontSize: "13px",
      lineHeight: 1.65,
      padding: "16px",
      spellcheck: false,
      textareaProps: ariaLabel ? { "aria-label": ariaLabel } : undefined,
      onChange: (next: string) => onChangeRef.current(next),
    });
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSaveRef.current?.();
      }
    };
    host.addEventListener("keydown", onKey);
    return () => {
      host.removeEventListener("keydown", onKey);
      editor.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className={className} />;
}
