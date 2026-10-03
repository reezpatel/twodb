import type { NoteProperty } from "@/routes/notes/view/use-notes-view";

/** Common props for every cell's display view. */
export interface CellDisplayProps {
  value: unknown;
  prop: NoteProperty;
  /** Activate the floating editor (used by text/number/select/date/url cells). */
  onActivate: (rect: DOMRect) => void;
  /** Commit a value directly from the display view (used by checkbox to toggle). */
  onCommit: (value: unknown) => void;
}

/** Common props for every cell's floating edit view. */
export interface CellEditProps {
  value: unknown;
  prop: NoteProperty;
  position: { x: number; y: number };
  size: { width: number; minHeight: number };
  onCommit: (value: unknown) => void;
  onClose: () => void;
  /** Mutate the property definition itself (e.g., select option list). */
  onPropChange?: (prop: NoteProperty) => void;
}
