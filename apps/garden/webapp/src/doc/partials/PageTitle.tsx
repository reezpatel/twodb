import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface PageTitleHandle {
  focus: (atEnd?: boolean) => void;
}

/** Big auto-growing title. Enter / ArrowDown at end → hand focus to the editor. */
export const PageTitle = forwardRef<
  PageTitleHandle,
  { value: string; placeholder?: string; readOnly?: boolean; autoFocus?: boolean; onChange: (v: string) => void; onEnter: () => void; size?: "page" | "peek" }
>(function PageTitle({ value, placeholder, readOnly, autoFocus, onChange, onEnter, size = "page" }, ref) {
    const [draft, setDraft] = useState(value);
    const el = useRef<HTMLTextAreaElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      if (document.activeElement !== el.current) setDraft(value);
    }, [value]);
    useEffect(() => {
      const t = el.current;
      if (!t) return;
      t.style.height = "0px";
      t.style.height = `${t.scrollHeight}px`;
    }, [draft]);
    useEffect(() => {
      if (autoFocus) el.current?.focus();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useImperativeHandle(ref, () => ({
      focus: (atEnd = true) => {
        el.current?.focus();
        if (atEnd && el.current) el.current.selectionStart = el.current.selectionEnd = el.current.value.length;
      },
    }));
    const commit = (v: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(v), 400);
    };
    return (
      <textarea
        ref={el}
        rows={1}
        value={draft}
        readOnly={readOnly}
        placeholder={placeholder ?? "Untitled"}
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, "");
          setDraft(v);
          commit(v);
        }}
        onBlur={() => draft !== value && (timer.current && clearTimeout(timer.current), onChange(draft))}
        onKeyDown={(e) => {
          const t = e.currentTarget;
          if (e.key === "Enter" || (e.key === "ArrowDown" && t.selectionStart === t.value.length)) {
            e.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            if (draft !== value) onChange(draft);
            onEnter();
          }
        }}
        className={`block w-full resize-none overflow-hidden bg-transparent font-bold leading-[1.2] tracking-[-0.02em] text-ink outline-none placeholder:text-ink-muted/40 ${size === "page" ? "text-[40px]" : "text-[30px]"}`}
      />
    );
});
