import { pinFaviconUrl, pinImageUrl, type PinDto } from "../../lib/twopin-client.js";
import { Globe, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";

interface PinCardProps {
  pin: PinDto;
  onEdit: (pin: PinDto) => void;
  onRefresh: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

function hostOf(pin: PinDto): string {
  try {
    return new URL(pin.finalUrl ?? pin.url).hostname.replace(/^www\./, "");
  } catch {
    return pin.url;
  }
}

/** Dumb partial: one masonry card. Click opens the link; hover reveals actions. */
export function PinCard({ pin, onEdit, onRefresh, onDelete }: PinCardProps) {
  return (
    <div className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-outline bg-paper shadow-sm transition-shadow hover:shadow-md">
      <a href={pin.finalUrl ?? pin.url} target="_blank" rel="noreferrer" className="block">
        {pin.hasImage ? (
          <img src={pinImageUrl(pin)} alt={pin.title ?? pin.url} className="w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-stone text-ink-muted">
            <Globe className="size-8" />
          </div>
        )}
      </a>

      <div className="flex flex-col gap-1.5 p-3">
        <a
          href={pin.finalUrl ?? pin.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-sm font-semibold leading-snug text-ink hover:underline"
        >
          {pin.title ?? pin.url}
        </a>
        {pin.description && <p className="line-clamp-3 text-xs leading-relaxed text-ink-muted">{pin.description}</p>}
        {pin.note && <p className="rounded-md bg-stone px-2 py-1 text-xs italic leading-relaxed text-ink-muted">“{pin.note}”</p>}

        {pin.status === "error" && (
          <p className="flex items-center gap-1 text-xs text-destructive" title={pin.fetchError ?? undefined}>
            <TriangleAlert className="size-3.5 shrink-0" /> metadata fetch failed
          </p>
        )}

        <div className="mt-1 flex items-center gap-1.5">
          {pin.hasFavicon && <img src={pinFaviconUrl(pin)} alt="" className="size-3.5 rounded-sm" loading="lazy" />}
          <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{pin.siteName ?? hostOf(pin)}</span>

          <span className="hidden shrink-0 gap-0.5 group-hover:flex">
            <button
              className="rounded-full p-1 text-ink-muted hover:bg-stone hover:text-ink"
              title="Refresh metadata"
              onClick={() => void onRefresh(pin.id)}
            >
              <RefreshCw className="size-3.5" />
            </button>
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
