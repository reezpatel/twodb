import { pinFaviconUrl, pinImageUrl, pinMediaUrl, type PinDto } from "../../lib/twopin-client.js";

/**
 * Dumb partial: the pin's assets — uploaded media (video/image), the hero
 * image, and the favicon. Renders nothing for assets the pin doesn't have.
 */
export function PinAssetsPanel({ pin }: { pin: PinDto }) {
  const hasMedia = pin.hasMedia && pin.mediaContentType;
  if (!hasMedia && !pin.hasImage && !pin.hasFavicon) return null;

  return (
    <div className="flex flex-col gap-2">
      {hasMedia &&
        (pin.mediaContentType!.startsWith("video/") ? (
          <video src={pinMediaUrl(pin)} controls playsInline className="max-h-72 w-full rounded-lg bg-stone object-contain" />
        ) : (
          <img src={pinMediaUrl(pin)} alt={pin.title ?? "pin media"} className="max-h-72 w-full rounded-lg object-contain" />
        ))}
      {!hasMedia && pin.hasImage && (
        <img src={pinImageUrl(pin)} alt={pin.title ?? pin.url ?? "pin image"} className="max-h-72 w-full rounded-lg object-contain" />
      )}
      {pin.hasFavicon && (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <img src={pinFaviconUrl(pin)} alt="site favicon" className="size-4 rounded-sm" />
          <span>Favicon</span>
        </div>
      )}
    </div>
  );
}

