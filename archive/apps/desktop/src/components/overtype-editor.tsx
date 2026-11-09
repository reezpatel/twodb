import { useEffect, useImperativeHandle, useRef, useState } from "react";
import OverType, { type OverTypeInstance } from "overtype";
import { OLDWORLD_OVERTYPE_THEME } from "./overtype-theme";

interface OvertypeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  ref?: React.Ref<OverTypeInstance | null>;
}

/** OverType (markdown source editor) wrapper. Uncontrolled — remount via key to swap documents. */
export function OvertypeEditor({ value, onChange, placeholder, ariaLabel, className, ref }: OvertypeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [instance, setInstance] = useState<OverTypeInstance | null>(null);
  useImperativeHandle<OverTypeInstance | null, OverTypeInstance | null>(ref, () => instance, [instance]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const [editor] = OverType.init(host, {
      value,
      placeholder,
      theme: OLDWORLD_OVERTYPE_THEME,
      fontSize: "13px",
      lineHeight: 1.65,
      padding: "24px",
      spellcheck: false,
      textareaProps: ariaLabel ? { "aria-label": ariaLabel } : undefined,
      onChange: (next) => onChangeRef.current(next),
    });
    setInstance(editor);
    return () => {
      editor.destroy();
      setInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className={className} />;
}
