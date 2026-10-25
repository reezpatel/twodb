import { useState } from "react";
import { ImageOff } from "lucide-react";
import { assetUrl } from "@/lib/native";
import { cn } from "@/lib/utils";
import type { CellDisplayProps, CellSidebarViewProps } from "./types";

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

/** One media item in the sidebar: videos get a real player, images a larger
 *  preview; unknown types fall back to the thumbnail. */
function SidebarMediaItem({ id }: { id: string }) {
  const url = mediaUrl(id);
  const [failed, setFailed] = useState(false);
  // A stored media id maps to one file; the resolver serves the real
  // content-type, so <video> just won't play for images — detect by trying
  // the image first for non-video-looking ids and vice versa. Simpler:
  // render <video> when the id came from a video upload — we can't know here,
  // so probe with an <img> that hides on error, backed by a <video>.
  return (
    <div className="bg-muted/40 relative w-full overflow-hidden rounded-lg border">
      {!failed && (
        <img src={url} alt="" loading="lazy" className="w-full object-contain" onError={() => setFailed(true)} />
      )}
      {failed && (
        <video src={url} controls preload="metadata" className="max-h-80 w-full" />
      )}
    </div>
  );
}

/** Property-sheet (sidebar) view for media: stacked full-width previews —
 *  images rendered large, videos in a player. Read-only like the table cell. */
export function MediaCellSidebarView({ value }: CellSidebarViewProps) {
  const ids = mediaIdsOf(value);
  if (ids.length === 0) return <p className="text-muted-foreground/60 py-1 text-xs">No media</p>;
  return (
    <div className="flex flex-col gap-2 py-1">
      {ids.map((id) => (
        <SidebarMediaItem key={id} id={id} />
      ))}
    </div>
  );
}
