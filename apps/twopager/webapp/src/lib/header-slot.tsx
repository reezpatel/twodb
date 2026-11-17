import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The shell's header row; pages render their title + actions into it (like Toolkit's AppHeader) via `HeaderPortal`. */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);

export function HeaderPortal({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  return slot ? createPortal(children, slot) : null;
}
