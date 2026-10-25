import { createContext, useContext } from "react";

export type AppShellVariant = "attached" | "floating" | "sliding";

type AppShellContextValue = {
  variant: AppShellVariant;
  navigationOpen: boolean;
  attachedNavigationVisible: boolean;
  openNavigation: () => void;
  closeNavigation: () => void;
  holdNavigation: () => void;
  releaseNavigation: () => void;
  toggleAttachedNavigation: () => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShellContext() {
  const context = useContext(AppShellContext);
  if (!context) throw new Error("App shell components must be rendered inside AppShell");
  return context;
}
