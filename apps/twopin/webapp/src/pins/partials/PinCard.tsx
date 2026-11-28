import { pinFaviconUrl, pinImageUrl, pinMediaUrl, type PinDto } from "../../lib/twopin-client.js";
import { Clapperboard, ExternalLink, Globe, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";

interface PinCardProps {
  pin: PinDto;
  onOpen: (pin: PinDto) => void;
  onEdit: (pin: PinDto) => void;
  onRefresh: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

function hostOf(pin: PinDto): string {
  const raw = pin.finalUrl ?? pin.url;
  if (!raw) return "media";
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}

/**
 * Dumb partial: one masonry card. Clicking anywhere on the card opens the pin
 * detail dialog; only the external-link affordance (the arrow button and the
 * hostname) opens the source page directly.
 */
export function PinCard({ pin, onOpen, onEdit, onRefresh, onDelete }: PinCardProps) {
  const href = pin.finalUrl ?? pin.url;
  return (
    <div
      className="group mb-4 cursor-pointer break-inside-avoid overflow-hidden rounded-xl border border-outline bg-paper shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onOpen(pin)}
    >
      {pin.hasMedia && pin.mediaContentType?.startsWith("video/") ? (
        // Direct-uploaded video hero.
        <video src={pinMediaUrl(pin)} className="w-full object-cover" muted playsInline preload="metadata" />
      ) : pin.hasMedia ? (
        // Direct-uploaded image hero.
        <img src={pinMediaUrl(pin)} alt={pin.title ?? "pin media"} className="w-full object-cover" loading="lazy" />
      ) : pin.heroKind === "video" ? (
        // Video hero: no local bytes yet — show a placeholder tile.
        <div className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-stone text-ink-muted">
          <Clapperboard className="size-8" />
          <span className="text-[11px] uppercase tracking-wide">video</span>
        </div>
      ) : pin.hasImage ? (
        <img src={pinImageUrl(pin)} alt={pin.title ?? pin.url ?? "pin"} className="w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-stone text-ink-muted">
          <Globe className="size-8" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{pin.title ?? pin.url ?? "Untitled pin"}</span>
        {pin.description && <p className="line-clamp-3 text-xs leading-relaxed text-ink-muted">{pin.description}</p>}
        {pin.tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {pin.tags.slice(0, 4).map((t) => (
              <span key={t} className="rounded-full bg-stone px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                #{t}
              </span>
            ))}
            {pin.tags.length > 4 && <span className="text-[10px] text-ink-muted">+{pin.tags.length - 4}</span>}
          </span>
        )}
        {pin.note && <p className="rounded-md bg-stone px-2 py-1 text-xs italic leading-relaxed text-ink-muted">“{pin.note}”</p>}

        {pin.status === "error" && (
          <p className="flex items-center gap-1 text-xs text-destructive" title={pin.fetchError ?? undefined}>
            <TriangleAlert className="size-3.5 shrink-0" /> metadata fetch failed
          </p>
        )}

        <div className="mt-1 flex items-center gap-1.5">
          {pin.hasFavicon && <img src={pinFaviconUrl(pin)} alt="" className="size-3.5 rounded-sm" loading="lazy" />}

          {/* The link: clicking this opens the source page directly. Hidden for URL-less pins. */}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-1 truncate text-xs text-ink-muted hover:text-ion-deep hover:underline"
              title={`Open ${href}`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{pin.siteName ?? hostOf(pin)}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">media pin</span>
          )}

          <span className="hidden shrink-0 gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
            {href && (
              <button
                className="rounded-full p-1 text-ink-muted hover:bg-stone hover:text-ink"
                title="Refresh metadata"
                onClick={() => void onRefresh(pin.id)}
              >
                <RefreshCw className="size-3.5" />
              </button>
            )}
            <button
              className="rounded-full p-1 text-ink-muted hover:bg-stone hover:text-ink"
              title="Edit pin"
              onClick={() => onEdit(pin)}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              className="rounded-full p-1 text-ink-muted hover:bg-stone hover:text-destructive"
              title="Delete pin"
              onClick={() => {
                if (window.confirm("Delete this pin?")) void onDelete(pin.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

