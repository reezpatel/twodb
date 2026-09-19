import { createContext, useContext } from "react";
import type { AuthUser } from "../lib/api";

export type AuthContextValue = {
  user: AuthUser;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
