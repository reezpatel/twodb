import { createContext, useContext } from "react";
import type { ItemPatch } from "@shared/model";

/** What node/edge components may do to the board. Provided by DiagramCanvas. */
export interface DiagramActions {
  canEdit: boolean;
  /** Patch one item (data is shallow-merged; null removes a key). */
  patch(id: string, patch: ItemPatch, label?: string): void;
  /** Resized by hand: commit size + position and pin it so auto-layout leaves it alone. */
  resized(id: string, box: { x: number; y: number; width: number; height: number }): void;
}

export const DiagramContext = createContext<DiagramActions | null>(null);

export function useDiagramActions(): DiagramActions {
  const ctx = useContext(DiagramContext);
  if (!ctx) throw new Error("useDiagramActions outside DiagramContext");
  return ctx;
}
