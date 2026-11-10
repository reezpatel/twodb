import { useCallback, useState } from "react";
import { authClient } from "../../../lib/auth-client.js";

/**
 * Business hook for the post-login hub shell: which nav view is active and
 * the sign-out action. No JSX here.
 */
export function useHubShell() {
  const { data: session } = authClient.useSession();
  const [activeId, setActiveId] = useState("explorer");
  const [signingOut, setSigningOut] = useState(false);

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
      setActiveId(id);
    },
    [signOut],
  );

  return {
    activeId,
    signingOut,
    onNavSelect,
    userEmail: session?.user?.email ?? "",
    userName: session?.user?.name ?? "",
  };
}
