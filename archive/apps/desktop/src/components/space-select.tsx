import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSpaces } from "./space-provider";

export const ALL_SPACES = "__all__";

/**
 * Optional space picker for org resources. "All spaces" (null) is the default —
 * the resource matches every session; picking a space restricts it to sessions
 * whose directory is in that space.
 */
export function SpaceSelect({ id, value, onChange, label = "Space" }: { id: string; value: string | null; onChange: (v: string | null) => void; label?: string }) {
  const { spaces, loading } = useSpaces();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Select value={value ?? ALL_SPACES} onValueChange={(v) => onChange(v === ALL_SPACES ? null : v)}>
        <SelectTrigger id={id} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SPACES} className="text-xs">
            All spaces
          </SelectItem>
          {!loading &&
            spaces.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-[10px] leading-snug">All spaces = visible everywhere; a space = only sessions in that space.</p>
    </div>
  );
}