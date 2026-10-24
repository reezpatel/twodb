import { useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";
import { setAuthToken } from "../lib/native";

export function useAppLayout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const signOut = async () => {
    await authClient.signOut();
    setAuthToken(null); // native builds: drop the bearer token
    navigate("/login");
  };

  const switchOrg = () => navigate("/orgs");

  return { session, activeOrg, signOut, switchOrg };
}
