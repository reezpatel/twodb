import type { CellDisplayProps, CellEditProps, CellSidebarViewProps } from "./types";
import { TextCellDisplay, TextCellEdit, type TextInputType } from "./text-cell";
import { NumberCellDisplay, NumberCellEdit } from "./number-cell";
import { SingleSelectCellDisplay, SingleSelectCellEdit } from "./single-select-cell";
import { MultiSelectCellDisplay, MultiSelectCellEdit } from "./multi-select-cell";
import { DateCellDisplay, DateCellEdit } from "./date-cell";
import { CheckboxCellDisplay } from "./checkbox-cell";
import { MediaCellDisplay, MediaCellSidebarView } from "./media-cell";

/** Dispatch to the right per-type display cell based on `prop.type`. */
export function CellDisplayFor(props: CellDisplayProps) {
  switch (props.prop.type) {
    case "checkbox":
      return <CheckboxCellDisplay {...props} />;
    case "select":
    case "status":
      return <SingleSelectCellDisplay {...props} />;
    case "multiselect":
      return <MultiSelectCellDisplay {...props} />;
    case "number":
      return <NumberCellDisplay {...props} />;
    case "date":
      return <DateCellDisplay {...props} />;
    case "media":
      return <MediaCellDisplay {...props} />;
    case "text":
    case "url":
    case "phone":
    case "email":
    case "id":
    case "place":
    case "person":
    case "files & media":
    default:
      return <TextCellDisplay {...props} />;
  }
}

/** Dispatch to the right per-type floating editor based on `prop.type`. */
export function CellEditFor(props: CellEditProps) {
  switch (props.prop.type) {
    case "checkbox":
      // Checkbox edits in place via CheckboxCellDisplay's onCommit — no floating editor.
      return null;
    case "media":
      // Media is display-only for now (thumbnails); editing comes with the
      // upload/picker UX.
      return null;
    case "select":
    case "status":
      return <SingleSelectCellEdit {...props} />;
    case "multiselect":
      return <MultiSelectCellEdit {...props} />;
    case "number":
      return <NumberCellEdit {...props} />;
    case "date":
      return <DateCellEdit {...props} />;
    case "url":
      return <TextCellEdit {...props} inputType="url" />;
    case "phone":
      return <TextCellEdit {...props} inputType="tel" />;
    case "email":
      return <TextCellEdit {...props} inputType="email" />;
    case "text":
    case "id":
    case "place":
    case "person":
    case "files & media":
    default:
      return <TextCellEdit {...props} inputType="text" />;
  }
}

/** Sidebar (property-sheet) display: cell types may define a roomier view
 *  for the side panel; others fall back to the table display. */
export function CellSidebarViewFor(props: CellSidebarViewProps) {
  if (props.prop.type === "media") return <MediaCellSidebarView {...props} />;
  return <CellDisplayFor {...props} onActivate={() => {}} />;
}

export type { TextInputType };
