import { IconButton, SearchInput } from "@twodb/ui";
import { X } from "lucide-react";
import { noteSearchRowStyles } from "./note-search-row.style";

type NoteSearchRowProps = {
  query?: string;
  onQueryChange: (query: string) => void;
};

export function NoteSearchRow({
  query = "",
  onQueryChange,
}: NoteSearchRowProps) {
  return (
    <div className="shell__searchrow">
      <style jsx>{noteSearchRowStyles}</style>
      <SearchInput
        autoFocus
        placeholder="Search inbox…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-label="Filter notes"
      />
      {query && (
        <IconButton
          icon={<X size={12} />}
          label="Clear search"
          onClick={() => onQueryChange("")}
          size="sm"
        />
      )}
    </div>
  );
}
