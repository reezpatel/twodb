import { Camera, ImagePlus, Loader2, Star, X } from "lucide-react";
import { api } from "../../lib/api";

export function PhotoStrip({
  imageIds,
  uploading,
  onAdd,
  onRemove,
  onCover,
}: {
  imageIds: string[];
  uploading: number;
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onCover: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {imageIds.map((id, i) => (
        <div key={id} className="group relative aspect-square overflow-hidden rounded-xl border border-outline bg-stone">
          <img src={api.imageUrl(id)} alt="" className="size-full object-cover" />
          {i === 0 ? (
            <span className="absolute bottom-1 left-1 rounded-full bg-ink/80 px-1.5 text-[10px] font-semibold text-paper">Cover</span>
          ) : (
            <button type="button" title="Make cover" onClick={() => onCover(id)} className="absolute bottom-1 left-1 grid size-6 place-items-center rounded-full bg-paper/90 opacity-0 transition group-hover:opacity-100">
              <Star className="size-3" />
            </button>
          )}
          <button type="button" aria-label="Remove photo" onClick={() => onRemove(id)} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-paper/90 opacity-80 hover:opacity-100">
            <X className="size-3" />
          </button>
        </div>
      ))}
      {Array.from({ length: uploading }).map((_, i) => (
        <div key={`u${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-outline">
          <Loader2 className="size-5 animate-spin text-ink-muted" />
        </div>
      ))}
      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline text-xs font-medium text-ink-muted transition hover:border-ink/30 hover:bg-stone hover:text-ink">
        <Camera className="size-5 md:hidden" />
        <ImagePlus className="hidden size-5 md:block" />
        <span>Add photo</span>
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => e.target.files && onAdd(e.target.files)} />
      </label>
    </div>
  );
}
