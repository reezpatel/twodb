import { createContext, useContext } from "react";
import type { ModelPickerModel } from "./model-picker-types";

export interface ModelPickerContextValue {
  selected: ModelPickerModel | null;
  modifiers: string[];
  disabled: boolean;
  /** Resolves a provider/group id to its display label. */
  providerLabel: (id: string) => string;
}

export const ModelPickerContext = createContext<ModelPickerContextValue | null>(null);

export function useModelPickerContext() {
  return useContext(ModelPickerContext);
}
