import { useLocation, useNavigate } from "react-router";
import { useAdminSession } from "./use-admin-session";

const SECTION_ROUTES = ["/admin/passkeys", "/admin/instance", "/admin/plugins"] as const;

export function useAdminRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAdminSession();
  const activeSection = SECTION_ROUTES.find((route) => location.pathname === route || location.pathname.startsWith(`${route}/`));

  return {
    activeId: activeSection ?? "",
    navigate,
    logout,
  };
}
