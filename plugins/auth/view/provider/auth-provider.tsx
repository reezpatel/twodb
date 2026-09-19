import type { ReactNode } from "react";
import { AuthContext } from "../hooks/use-auth";
import { useAuthSession } from "../hooks/use-auth-session";
import { SigninSection } from "../sections/signin/signin-section";

export const AuthProvider: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { sessionQuery, logout } = useAuthSession();

  if (sessionQuery.isPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-3)",
          background: "var(--bg)",
        }}
      >
        Loading…
      </div>
    );
  }

  const user = sessionQuery.data?.user ?? null;
  if (!user) return <SigninSection />;

  return <AuthContext.Provider value={{ user, logout: () => logout.mutate() }}>{children}</AuthContext.Provider>;
};
