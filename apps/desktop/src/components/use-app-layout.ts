import { useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";

export function useAppLayout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const signOut = async () => {
    await authClient.signOut();
    navigate("/login");
  };

  const switchOrg = () => navigate("/orgs");

  return { session, activeOrg, signOut, switchOrg };
}
