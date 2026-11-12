import { createContext, useContext } from "react";

export interface ShellApi {
  collapsed: boolean;
  expand: () => void;
  openSearch: () => void;
}

export const ShellContext = createContext<ShellApi>({ collapsed: false, expand: () => undefined, openSearch: () => undefined });
export const useShell = () => useContext(ShellContext);
