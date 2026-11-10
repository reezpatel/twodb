import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { authClient } from "../../../lib/auth-client.js";

/**
 * Business hook for the post-login hub shell: which nav view is active
 * (derived from the URL — the router is the source of truth) and the
 * sign-out action. No JSX here.
 */
export function useHubShell() {
  const { data: session } = authClient.useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const activeId = location.pathname.startsWith("/apps")
    ? "apps"
    : location.pathname.startsWith("/keys")
      ? "keys"
      : location.pathname.startsWith("/spaces")
        ? "spaces"
        : "explorer";

  const signOut = useCallback(async () => {
    setSigningOut(true);
    await authClient.signOut();
    // no need to reset: RequireAuth flips back to <Login/> once the session clears
  }, []);

  const onNavSelect = useCallback(
    (id: string) => {
      if (id === "logout") {
        void signOut();
        return;
      }
      if (id === "apps") navigate("/apps");
      else if (id === "keys") navigate("/keys");
      else if (id === "spaces") navigate("/spaces");
      else if (id === "explorer") navigate("/hub");
    },
    [navigate, signOut],
  );

  return {
    activeId,
    signingOut,
    onNavSelect,
    userEmail: session?.user?.email ?? "",
    userName: session?.user?.name ?? "",
  };
}
