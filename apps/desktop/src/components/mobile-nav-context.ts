import { createContext, useContext } from "react";

export interface MobileNavContextValue {
  isMobile: boolean;
  closeNav: () => void;
  sideNavTarget: HTMLElement | null;
  setSideNavActive: (active: boolean) => void;
}

export const MobileNavContext = createContext<MobileNavContextValue>({
  isMobile: false,
  closeNav: () => {},
  sideNavTarget: null,
  setSideNavActive: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}
