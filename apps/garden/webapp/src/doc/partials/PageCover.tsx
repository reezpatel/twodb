import { useRef } from "react";
import { ImageUp, Shuffle, Trash2 } from "lucide-react";

export const COVER_PRESETS = [
  "linear-gradient(120deg, var(--ion) 0%, var(--tritium) 100%)",
  "linear-gradient(120deg, var(--transmute) 0%, var(--materials) 100%)",
  "linear-gradient(120deg, var(--glow) 0%, var(--materials) 100%)",
  "linear-gradient(160deg, var(--tritium) 0%, var(--ion-deep) 140%)",
  "linear-gradient(135deg, var(--stone) 0%, var(--stone-hatch) 100%)",
  "linear-gradient(120deg, var(--ion) 0%, var(--transmute) 100%)",
  "radial-gradient(circle at 20% 30%, var(--glow) 0%, transparent 40%), linear-gradient(120deg, var(--ion-deep) 0%, var(--ion) 100%)",
  "repeating-linear-gradient(45deg, var(--stone) 0 12px, var(--paper) 12px 24px)",
];

export const isImageCover = (c: string) => c.startsWith("/") || c.startsWith("http");

export function PageCover({ cover, editable, onChange, onUpload }: { cover: string; editable: boolean; onChange: (c: string | null) => void; onUpload: (f: File) => void }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="group/cover relative h-[200px] w-full overflow-hidden" style={isImageCover(cover) ? undefined : { background: cover }}>
      {isImageCover(cover) ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
      {editable ? (
        <div className="absolute bottom-3 right-4 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
          {[
            { icon: <Shuffle size={13} />, label: "Change", run: () => onChange(COVER_PRESETS[(COVER_PRESETS.indexOf(cover) + 1) % COVER_PRESETS.length]) },
            { icon: <ImageUp size={13} />, label: "Upload", run: () => file.current?.click() },
            { icon: <Trash2 size={13} />, label: "Remove", run: () => onChange(null) },
          ].map((b) => (
            <button key={b.label} type="button" onClick={b.run} className="flex h-7 items-center gap-1 rounded-md bg-paper/90 px-2 text-[12px] font-medium text-ink backdrop-blur hover:bg-paper">
              {b.icon} {b.label}
            </button>
          ))}
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onUpload(f);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
