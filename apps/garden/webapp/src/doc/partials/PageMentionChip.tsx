import type { PageMentionProps } from "@twodb/editor";
import { useRecord } from "../../lib/queries";
import { RecordIcon } from "../../ui/RecordIcon";

/** Live title/icon for @-mentions (falls back to the title stored in the doc; struck through if trashed). */
export function PageMentionChip({ id, title }: PageMentionProps) {
  const { data, isError } = useRecord(id);
  const gone = isError || !!data?.deletedAt;
  return (
    <>
      <RecordIcon icon={data?.icon} kind={data?.kind ?? "page"} size={14} />
      <span className={gone ? "text-ink-muted line-through" : undefined}>{data ? data.title || "Untitled" : title || "Untitled"}</span>
    </>
  );
}
