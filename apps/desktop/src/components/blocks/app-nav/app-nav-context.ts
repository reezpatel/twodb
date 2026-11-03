import { createContext, useContext, type ComponentType } from "react";

/** "line": a branch line follows the selected link. "pill": a highlighted pill slides to it. */
export type AppNavVariant = "line" | "pill";

export type AppNavIcon = ComponentType<{ className?: string }>;

export interface AppNavContextValue {
  selectedId: string | null;
  hoveredId: string | null;
  variant: AppNavVariant;
  /** Text colour class applied to the selected link's icon and branch line. */
  activeColor: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export const AppNavContext = createContext<AppNavContextValue | null>(null);

export function useAppNav() {
  const context = useContext(AppNavContext);
  if (!context) throw new Error("App nav parts must be rendered inside <AppNav>.");
  return context;
}
