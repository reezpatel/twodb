import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Business hook for the shell nav: active id derives from the URL (fixed
 * pages + one entry per microvm), selection navigates.
 */
export function useShellNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // /jobs/:id -> jobs; /microvms/:identifier -> microvms; fixed pages otherwise.
  const pathMatch = location.pathname.match(/^\/(runners|jobs|microvms|enroll)(?:\/([^/]+))?$/);
  const activeId = pathMatch ? (pathMatch[2] ? `${pathMatch[1]}:${decodeURIComponent(pathMatch[2])}` : pathMatch[1]) : "overview";

  const onSelect = useCallback(
    (id: string) => {
      const [page, sub] = id.split(":");
      if (!sub) navigate(`/${page}`);
      else navigate(`/${page}/${encodeURIComponent(sub)}`);
    },
    [navigate],
  );

  return { activeId, onSelect };
}
