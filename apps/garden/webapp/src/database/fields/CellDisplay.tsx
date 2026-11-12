import { Check } from "lucide-react";
import type { Field, RecordRef } from "@shared/model";
import { cn } from "@twodb/blocks";
import { formatDate, formatNumber, optionOf } from "../../lib/format";
import { useMembers } from "../../lib/queries";
import { RecordIcon } from "../../ui/RecordIcon";
import { OptionPill } from "./OptionPill";

export interface CellDisplayProps {
  field: Field;
  value: unknown;
  relations?: Record<string, RecordRef>;
  /** wrap long text instead of truncating */
  wrap?: boolean;
  onOpenRecord?: (id: string) => void;
}

const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Read-only rendering of any field value (tables, cards, lists, properties). */
export function CellDisplay({ field, value, relations, wrap, onOpenRecord }: CellDisplayProps) {
  const members = useMembers().data?.members ?? [];
  const type = field.type === "rollup" || field.type === "formula" ? field.valueType : field.type;
  if (field.type === "checkbox" || type === "boolean") {
    return (
      <span className={cn("inline-flex size-4 items-center justify-center rounded-[4px] border", value ? "border-ion-deep bg-ion-deep text-paper" : "border-ink-muted/50")}>
        {value ? <Check size={12} strokeWidth={3} /> : null}
      </span>
    );
  }
  if (empty(value)) return null;
  const text = cn("text-[13.5px] text-ink", wrap ? "whitespace-pre-wrap break-words" : "truncate");

  switch (field.type) {
    case "select":
    case "status": {
      const o = optionOf(field, value);
      return o ? <OptionPill option={o} /> : null;
    }
    case "multi_select":
      return (
        <span className={cn("flex min-w-0 gap-1", wrap ? "flex-wrap" : "overflow-hidden")}>
          {(value as string[]).map((id) => {
            const o = optionOf(field, id);
            return o ? <OptionPill key={id} option={o} className="shrink-0" /> : null;
          })}
        </span>
      );
    case "number":
      return <span className={cn(text, "tabular-nums")}>{formatNumber(value, field)}</span>;
    case "date":
    case "created_time":
    case "updated_time":
      return <span className={text}>{formatDate(value, field.type !== "date" || field.config.date?.includeTime)}</span>;
    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className={cn(text, "underline decoration-outline underline-offset-2 hover:text-ion-deep")} onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\//, "")}
        </a>
      );
    case "email":
      return (
        <a href={`mailto:${value}`} className={cn(text, "underline decoration-outline underline-offset-2")} onClick={(e) => e.stopPropagation()}>
          {String(value)}
        </a>
      );
    case "person":
    case "created_by": {
      const ids = Array.isArray(value) ? (value as string[]) : [String(value).replace(/^user:/, "")];
      return (
        <span className={cn("flex min-w-0 gap-1.5", wrap ? "flex-wrap" : "overflow-hidden")}>
          {ids.map((id) => {
            const m = members.find((x) => x.id === id);
            const name = m?.name || m?.email || id;
            return (
              <span key={id} className="inline-flex shrink-0 items-center gap-1 text-[13px]">
                <span className="flex size-[18px] items-center justify-center rounded-full bg-ion/50 text-[10px] font-semibold uppercase">{name.slice(0, 1)}</span>
                <span className="truncate">{name}</span>
              </span>
            );
          })}
        </span>
      );
    }
    case "relation":
      return (
        <span className={cn("flex min-w-0 gap-1.5", wrap ? "flex-wrap" : "overflow-hidden")}>
          {(value as string[]).map((id) => {
            const r = relations?.[id];
            return (
              <button
                key={id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRecord?.(id);
                }}
                className="inline-flex max-w-[220px] shrink-0 items-center gap-1 rounded px-0.5 text-[13px] underline decoration-outline underline-offset-2 hover:bg-ink/[0.05]"
              >
                <RecordIcon icon={r?.icon} kind="page" size={13} />
                <span className="truncate">{r?.title || "Untitled"}</span>
              </button>
            );
          })}
        </span>
      );
  }

  // rollup / formula / text-like
  if (Array.isArray(value))
    return (
      <span className={cn("flex min-w-0 gap-1", wrap ? "flex-wrap" : "overflow-hidden")}>
        {value.map((v, i) => (
          <span key={i} className="shrink-0 rounded-[5px] bg-ink/[0.06] px-1.5 text-[12.5px] leading-[20px]">
            {String(v)}
          </span>
        ))}
      </span>
    );
  if (type === "number") return <span className={cn(text, "tabular-nums")}>{formatNumber(value, field)}</span>;
  if (type === "date") return <span className={text}>{formatDate(value)}</span>;
  return <span className={text}>{String(value)}</span>;
}
