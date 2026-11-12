import { Globe, Loader2 } from "lucide-react";
import type { MetadataPreview } from "../../lib/twopin-client.js";

interface PinPreviewCardProps {
  status: "idle" | "loading" | "ok" | "error";
  preview: MetadataPreview | null;
  error: string | null;
}

/** Dumb partial: live metadata preview inside the add-pin dialog. */
export function PinPreviewCard({ status, preview, error }: PinPreviewCardProps) {
  if (status === "idle") return null;
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-outline bg-stone/50 p-3 text-sm text-ink-muted">
        <Loader2 className="size-4 animate-spin" /> Fetching link preview…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Couldn’t fetch this link: {error}. You can still save it.
      </div>
    );
  }
  if (!preview) return null;
  return (
    <div className="flex gap-3 overflow-hidden rounded-lg border border-outline bg-stone/50 p-3">
      {preview.imageDataUri ? (
        <img src={preview.imageDataUri} alt="" className="h-20 w-24 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-stone text-ink-muted">
          <Globe className="size-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-semibold text-ink">{preview.title ?? preview.finalUrl}</p>
        {preview.description && <p className="line-clamp-2 text-xs text-ink-muted">{preview.description}</p>}
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
          {preview.faviconDataUri && <img src={preview.faviconDataUri} alt="" className="size-3 rounded-sm" />}
          {preview.siteName}
        </p>
      </div>
    </div>
  );
}
