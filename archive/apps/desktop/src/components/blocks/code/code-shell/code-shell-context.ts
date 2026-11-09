import { createContext, useContext } from "react";

export type CodeShellContextValue = {
  sidebarVisible: boolean;
  sidebarWidth: number;
  minSidebarWidth: number;
  maxSidebarWidth?: number;
  reservedMainWidth: number;
  onSidebarWidthChange?: (width: number) => void;
  bottomPanelVisible: boolean;
  bottomPanelHeight: number;
  minBottomPanelHeight: number;
  maxBottomPanelHeight?: number;
  reservedMainHeight: number;
  onBottomPanelHeightChange?: (height: number) => void;
};

export const CodeShellContext = createContext<CodeShellContextValue | null>(null);

export function useCodeShellContext() {
  const context = useContext(CodeShellContext);
  if (!context) throw new Error("CodeShell components must be used within CodeShell");
  return context;
}
