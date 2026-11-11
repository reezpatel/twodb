import { authClient } from "../../../lib/auth-client.js";

/** Business hook: the shared session + sign-out (control-plane SSO). */
export function useShellSession() {
  const { data: session, isPending } = authClient.useSession();
  const signOut = () => void authClient.signOut();
  return { isPending, signedIn: !!session, userName: session?.user?.name ?? "", signOut };
}
