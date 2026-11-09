import { useMemo, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { CodeShellContext } from "./code-shell-context";

type CodeShellProps = ComponentProps<"div"> & {
  sidebarVisible?: boolean;
  sidebarWidth?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  reservedMainWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  bottomPanelVisible?: boolean;
  bottomPanelHeight?: number;
  minBottomPanelHeight?: number;
  maxBottomPanelHeight?: number;
  reservedMainHeight?: number;
  onBottomPanelHeightChange?: (height: number) => void;
};

export function CodeShell({
  sidebarVisible = true,
  sidebarWidth = 288,
  minSidebarWidth = 240,
  maxSidebarWidth,
  reservedMainWidth = 120,
  onSidebarWidthChange,
  bottomPanelVisible = false,
  bottomPanelHeight = 240,
  minBottomPanelHeight = 120,
  maxBottomPanelHeight,
  reservedMainHeight = 120,
  onBottomPanelHeightChange,
  className,
  ...props
}: CodeShellProps) {
  const context = useMemo(
    () => ({
      sidebarVisible,
      sidebarWidth,
      minSidebarWidth,
      maxSidebarWidth,
      reservedMainWidth,
      onSidebarWidthChange,
      bottomPanelVisible,
      bottomPanelHeight,
      minBottomPanelHeight,
      maxBottomPanelHeight,
      reservedMainHeight,
      onBottomPanelHeightChange,
    }),
    [
      bottomPanelHeight,
      bottomPanelVisible,
      maxBottomPanelHeight,
      maxSidebarWidth,
      minBottomPanelHeight,
      minSidebarWidth,
      onBottomPanelHeightChange,
      onSidebarWidthChange,
      reservedMainHeight,
      reservedMainWidth,
      sidebarVisible,
      sidebarWidth,
    ],
  );

  return (
    <CodeShellContext.Provider value={context}>
      <div data-slot="code-shell" className={cn("relative flex h-full min-h-0", className)} {...props} />
    </CodeShellContext.Provider>
  );
}
