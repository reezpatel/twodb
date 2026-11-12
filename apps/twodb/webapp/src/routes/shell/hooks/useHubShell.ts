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
  /** Side nav visibility — the toggle button in the header owns this, and it's remembered. */
  const [navOpen, setNavOpen] = useState(() => {
    try {
      return localStorage.getItem("twodb.nav-open") !== "false";
    } catch {
      return true;
    }
  });

  // An app's details page (/app/:slug/…) belongs to the Apps section.
  const activeId = location.pathname.startsWith("/apps") || location.pathname.startsWith("/app/")
    ? "apps"
    : location.pathname.startsWith("/keys")
      ? "keys"
      : location.pathname.startsWith("/spaces")
        ? "spaces"
        : "apps";

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
    },
    [navigate, signOut],
  );

  const toggleNav = useCallback(() => {
    setNavOpen((open) => {
      try {
        localStorage.setItem("twodb.nav-open", String(!open));
      } catch {
        // ignore — persistence is best-effort
      }
      return !open;
    });
  }, []);

  return {
    activeId,
    navOpen,
    toggleNav,
    signingOut,
    onNavSelect,
    userEmail: session?.user?.email ?? "",
    userName: session?.user?.name ?? "",
  };
}
