import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { AppNavContext, type AppNavVariant } from "./app-nav-context";

export interface AppNavProps extends Omit<ComponentProps<"nav">, "onSelect"> {
  /** Controlled selection. Omit to let the nav manage it (see defaultSelectedId). */
  selectedId?: string;
  defaultSelectedId?: string;
  variant?: AppNavVariant;
  activeColor?: string;
  onSelect?: (id: string) => void;
}

/**
 * Root of the app navigation. Holds selection and hover state for its parts —
 * put one or more <AppNavLinks> sections inside it; further section types can
 * slot in alongside them.
 */
export function AppNav({
  selectedId: controlledSelectedId,
  defaultSelectedId,
  variant = "line",
  activeColor = "text-primary",
  onSelect,
  className,
  children,
  ...props
}: AppNavProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(defaultSelectedId ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  const handleSelect = useCallback(
    (id: string) => {
      if (controlledSelectedId === undefined) setInternalSelectedId(id);
      onSelect?.(id);
    },
    [controlledSelectedId, onSelect],
  );

  const value = useMemo(
    () => ({ selectedId, hoveredId, variant, activeColor, onSelect: handleSelect, onHover: setHoveredId }),
    [selectedId, hoveredId, variant, activeColor, handleSelect],
  );

  return (
    <AppNavContext.Provider value={value}>
      <LayoutGroup id="app-nav">
        <nav
          data-slot="app-nav"
          aria-label="App navigation"
          onMouseLeave={() => setHoveredId(null)}
          className={cn("flex w-full flex-col gap-0.5 px-1 select-none", className)}
          {...props}
        >
          {children}
        </nav>
      </LayoutGroup>
    </AppNavContext.Provider>
  );
}
