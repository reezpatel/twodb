import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/components/ui/property-cell/media-cell";

interface ImageFieldProps {
  value: string[];
  onChange: (ids: string[]) => void;
  upload: (file: File) => Promise<string>;
}

export function ImageField({ value, onChange, upload }: ImageFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const ids: string[] = [];
      for (const file of Array.from(files)) ids.push(await upload(file));
      onChange([...value, ...ids]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id, index) => (
          <div key={id} className="bg-muted group relative size-20 overflow-hidden rounded-md border">
            <img src={mediaUrl(id)} alt="" className="size-full object-cover" />
            {index === 0 ? <span className="bg-background/80 absolute bottom-0 left-0 right-0 text-center text-[10px]">Cover</span> : null}
            <button
              type="button"
              aria-label="Remove image"
              className="bg-background/80 absolute top-1 right-1 hidden rounded-full p-0.5 group-hover:block"
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" className="size-20 flex-col gap-1 text-xs" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          Add
        </Button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
