import { ImageOff } from "lucide-react";
import { assetUrl } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { CellDisplayProps } from "./types";

const MAX_THUMBS = 4;

/** Media ids stored in a `media` column (text[] of media_asset ids). */
export function mediaIdsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Public URL for a stored media item. */
export const mediaUrl = (id: string) => assetUrl(`/api/storage/resolve/${id}`);

function MediaThumb({ id, className }: { id: string; className?: string }) {
  return (
    <img
      src={mediaUrl(id)}
      alt=""
      loading="lazy"
      draggable={false}
      className={cn("bg-muted size-6 shrink-0 rounded object-cover", className)}
      onError={(e) => {
        // Videos and other non-image media can't render in <img> — swap in a
        // placeholder icon instead of the broken-image glyph.
        const el = e.currentTarget;
        el.style.display = "none";
        el.nextElementSibling?.classList.remove("hidden");
      }}
    />
  );
}

/**
 * Media cell: display-only thumbnail strip for now (max 4 + overflow count).
 * Editing (upload / media picker / carousel preview) comes later — clicks
 * don't open a floating editor.
 */
export function MediaCellDisplay({ value }: CellDisplayProps) {
  const ids = mediaIdsOf(value);
  if (ids.length === 0) {
    return <div className="-mx-2 flex h-full min-h-[24px] items-center rounded px-2 text-xs" />;
  }
  const shown = ids.slice(0, MAX_THUMBS);
  const extra = ids.length - shown.length;
  return (
    <div className="-mx-2 flex h-full min-h-[24px] items-center gap-1 rounded px-2" title={`${ids.length} media item${ids.length === 1 ? "" : "s"}`}>
      {shown.map((id) => (
        <span key={id} className="relative shrink-0">
          <MediaThumb id={id} />
          <ImageOff size={14} className="text-muted-foreground bg-muted hidden size-6 rounded p-1" />
        </span>
      ))}
      {extra > 0 ? <span className="text-muted-foreground text-xs tabular-nums">+{extra}</span> : null}
    </div>
  );
}
