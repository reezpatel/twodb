import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@twodb/blocks";
import { pinImageUrl, pinMediaUrl, type PinDto } from "../lib/twopin-client.js";
import { PinAssetsPanel } from "./partials/PinAssetsPanel.js";
import { PinProperties } from "./partials/PinProperties.js";

interface PinDetailDialogProps {
  pin: PinDto | null;
  onOpenChange: (open: boolean) => void;
}

/** Read-only pin detail dialog: hero/media on top, then assets, then properties. */
export function PinDetailDialog({ pin, onOpenChange }: PinDetailDialogProps) {
  const hero =
    pin && pin.hasMedia
      ? pin.mediaContentType?.startsWith("video/")
        ? { kind: "video" as const, src: pinMediaUrl(pin) }
        : { kind: "image" as const, src: pinMediaUrl(pin) }
      : pin && pin.hasImage
        ? { kind: "image" as const, src: pinImageUrl(pin) }
        : null;

  return (
    <Dialog open={pin !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {pin && (
          <>
            {hero &&
              (hero.kind === "video" ? (
                <video src={hero.src} controls playsInline className="max-h-64 w-full rounded-lg bg-stone object-contain" />
              ) : (
                <img src={hero.src} alt={pin.title ?? pin.url ?? "pin"} className="max-h-64 w-full rounded-lg object-contain" />
              ))}
            <DialogHeader>
              <DialogTitle>{pin.title ?? pin.url ?? "Untitled pin"}</DialogTitle>
            </DialogHeader>
            {pin.description && <p className="text-sm leading-relaxed text-ink-muted">{pin.description}</p>}
            {pin.note && <p className="rounded-md bg-stone px-2 py-1 text-sm italic leading-relaxed text-ink-muted">“{pin.note}”</p>}
            <PinAssetsPanel pin={pin} />
            <PinProperties pin={pin} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

