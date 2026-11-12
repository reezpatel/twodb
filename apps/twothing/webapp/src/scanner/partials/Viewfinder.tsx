import type { RefObject } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { CameraStatus } from "../hooks/useCamera";

/** Full-bleed video with a bracketed reticle, sweeping laser and a green flash on every hit. */
export function Viewfinder({
  videoRef,
  status,
  error,
  hitKey,
  onStart,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  hitKey: number;
  onStart: () => void;
}) {
  return (
    <div className="relative size-full overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted className="size-full object-cover" />
      {/* dim outside the reticle */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative aspect-square w-[min(68vw,320px)] rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"] as const).map(
            (c) => (
              <span key={c} className={cn("absolute size-10 border-white/90", c)} />
            ),
          )}
          {status === "scanning" && <span className="tt-laser absolute inset-x-5 h-0.5 rounded-full bg-rose-500 shadow-[0_0_12px_2px_rgba(244,63,94,0.7)]" />}
          {hitKey > 0 && <span key={hitKey} className="tt-hit absolute inset-0 rounded-3xl border-4 border-emerald-400" />}
        </div>
      </div>
      {status !== "scanning" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center text-sm text-white/80">
          {status === "starting" ? <Loader2 className="size-8 animate-spin" /> : <CameraOff className="size-8" />}
          {error && <p className="max-w-xs">{error}</p>}
          {status !== "starting" && (
            <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-black active:scale-95">
              <Camera className="size-4" /> Start camera
            </button>
          )}
        </div>
      )}
    </div>
  );
}
