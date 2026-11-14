import { Box, Globe2 } from "lucide-react";
import type { Space } from "../../../lib/chat-client";

/** Control-plane-backed list scope picker; never accepts arbitrary IDs. */
export function SpacePicker(props: {
  id: string;
  spaces: Space[];
  value: string;
  onChange: (spaceId: string) => void;
}) {
  const selected = props.spaces.find((space) => space.id === props.value);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {selected ? <Box size={14} /> : <Globe2 size={14} />}
      </span>
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-border bg-background pl-9 pr-8 text-sm text-foreground outline-none focus:border-primary/50"
      >
        <option value="">Entire workspace</option>
        {props.spaces.map((space) => (
          <option key={space.id} value={space.id}>{space.name}</option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">⌄</span>
    </div>
  );
}
