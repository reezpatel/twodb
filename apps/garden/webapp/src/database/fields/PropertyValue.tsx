import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from "react";
import type { Field, RecordRef } from "@shared/model";
import { cn } from "@twodb/blocks";
import { Popover } from "../../ui/Popover";
import { CellDisplay } from "./CellDisplay";
import { isEditable } from "./fieldMeta";
import { OptionSelect } from "./editors/OptionSelect";
import { DateEditor } from "./editors/DateEditor";
import { PersonEditor } from "./editors/PersonEditor";
import { RelationEditor } from "./editors/RelationEditor";

export interface PropertyValueProps {
  field: Field;
  value: unknown;
  relations?: Record<string, RecordRef>;
  onChange: (value: unknown) => void;
  variant: "cell" | "panel";
  wrap?: boolean;
  onOpenRecord?: (id: string) => void;
  readOnly?: boolean;
  /** start in edit mode (e.g. a freshly created row's title) */
  autoEdit?: boolean;
  placeholder?: string;
}

const INLINE = new Set(["text", "number", "url", "email", "phone", "title"]);

/** Displays a value and edits it in place (inline input or popover, by type). */
export function PropertyValue({ field, value, relations, onChange, variant, wrap, onOpenRecord, readOnly, autoEdit, placeholder: emptyText }: PropertyValueProps) {
  const [editing, setEditing] = useState(!!autoEdit);
  // the row may mount before it is marked as "just created" — react to the flag later too
  useEffect(() => {
    if (autoEdit) setEditing(true);
  }, [autoEdit]);
  const editable = !readOnly && isEditable(field.type);
  const box = cn(
    "flex w-full min-w-0 items-center text-left",
    variant === "cell" ? "min-h-[34px] px-2 py-1" : "min-h-[30px] rounded-md px-2 py-1 hover:bg-ink/[0.05]",
    editable && "cursor-pointer",
  );
  const display = <CellDisplay field={field} value={value} relations={relations} wrap={wrap || variant === "panel"} onOpenRecord={onOpenRecord} />;
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const placeholder =
    (variant === "panel" || emptyText) && isEmpty && field.type !== "checkbox" ? <span className="truncate text-[13.5px] text-ink-muted/70">{emptyText ?? (editable ? "Empty" : "—")}</span> : null;

  if (!editable) return <div className={box}>{placeholder ?? display}</div>;

  if (field.type === "checkbox")
    return (
      <Clickable className={box} onClick={() => onChange(!value)}>
        {display}
      </Clickable>
    );

  if (INLINE.has(field.type)) {
    if (editing) return <InlineInput field={field} value={value} variant={variant} onDone={(v) => (setEditing(false), v !== undefined && onChange(v))} />;
    return (
      <Clickable className={box} onClick={() => setEditing(true)}>
        {placeholder ?? display}
      </Clickable>
    );
  }

  const editor = (() => {
    switch (field.type) {
      case "select":
      case "status":
        return <OptionSelect field={field} value={value} onChange={onChange} multi={false} />;
      case "multi_select":
        return <OptionSelect field={field} value={value} onChange={onChange} multi />;
      case "date":
        return <DateEditor field={field} value={value} onChange={onChange} />;
      case "person":
        return <PersonEditor value={value} onChange={onChange} />;
      case "relation":
        return <RelationEditor field={field} value={value} relations={relations} onChange={onChange} />;
      default:
        return null;
    }
  })();

  return (
    <Popover
      open={editing}
      onOpenChange={setEditing}
      trigger={
        <Clickable className={box}>
          {placeholder ?? display}
        </Clickable>
      }
    >
      {editor}
    </Popover>
  );
}

/** A focusable, keyboard-activatable div (a <button> can't contain the links/chips cells render). */
const Clickable = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Clickable({ onClick, onKeyDown, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          (e.currentTarget as HTMLDivElement).click();
        }
      }}
      {...props}
    />
  );
});

function InlineInput({ field, value, variant, onDone }: { field: Field; value: unknown; variant: "cell" | "panel"; onDone: (v: unknown) => void }) {
  const [draft, setDraft] = useState(value === null || value === undefined ? "" : String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  const commit = () => {
    const t = draft.trim();
    if (field.type === "number") {
      if (t === "") return onDone(value === null ? undefined : null);
      const n = Number(t);
      return onDone(Number.isFinite(n) && n !== value ? n : undefined);
    }
    if (field.type === "title") return onDone(draft !== value ? draft : undefined);
    return onDone(t === (value ?? "") ? undefined : t || null);
  };
  return (
    <input
      ref={ref}
      autoFocus
      inputMode={field.type === "number" ? "decimal" : undefined}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.preventDefault(), commit());
        if (e.key === "Escape") onDone(undefined);
      }}
      className={cn(
        "w-full min-w-0 bg-paper text-[13.5px] text-ink outline-none",
        variant === "cell" ? "min-h-[34px] px-2 py-1 shadow-[inset_0_0_0_2px_var(--ion-deep)]" : "min-h-[30px] rounded-md px-2 py-1 shadow-[inset_0_0_0_1.5px_var(--ion-deep)]",
      )}
    />
  );
}
