import { bookmarkFaviconUrl, type BookmarkDto } from "../../lib/twopin-client.js";
import { ExternalLink, Globe, Pencil, Trash2 } from "lucide-react";

interface BookmarkRowProps {
  bookmark: BookmarkDto;
  onEdit: (bookmark: BookmarkDto) => void;
  onDelete: (id: string) => Promise<unknown>;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Dumb partial: one bookmark list row — favicon, title, url, hover actions. */
export function BookmarkRow({ bookmark, onEdit, onDelete }: BookmarkRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-outline bg-paper px-3 py-2.5 transition-shadow hover:shadow-sm">
      {bookmark.hasFavicon ? (
        <img src={bookmarkFaviconUrl(bookmark)} alt="" className="size-5 shrink-0 rounded-sm" loading="lazy" />
      ) : (
        <Globe className="size-5 shrink-0 text-ink-muted" />
      )}

      <div className="min-w-0 flex-1">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-medium text-ink hover:underline"
          title={bookmark.title ?? bookmark.url}
        >
          {bookmark.title ?? bookmark.url}
        </a>
        <span className="block truncate text-xs text-ink-muted">{hostOf(bookmark.url)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full p-1.5 text-ink-muted hover:bg-stone hover:text-ink"
          title="Open link"
        >
          <ExternalLink className="size-4" />
        </a>
        <button className="rounded-full p-1.5 text-ink-muted hover:bg-stone hover:text-ink" title="Edit bookmark" onClick={() => onEdit(bookmark)}>
          <Pencil className="size-4" />
        </button>
        <button
          className="rounded-full p-1.5 text-ink-muted hover:bg-stone hover:text-destructive"
          title="Delete bookmark"
          onClick={() => {
            if (window.confirm("Delete this bookmark?")) void onDelete(bookmark.id);
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

