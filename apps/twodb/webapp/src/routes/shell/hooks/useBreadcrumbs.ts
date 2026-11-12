import { useLocation } from "react-router";
import { formatAppName } from "../../../lib/app-name.js";

export interface Crumb {
  label: string;
  /** Absent on the current page. */
  to?: string;
}

const SECTIONS: Array<[prefix: string, label: string, to: string]> = [
  ["/keys", "API keys", "/keys"],
  ["/spaces", "Spaces", "/spaces"],
];

/** Business hook: breadcrumb trail for the current route (the URL is the source of truth). */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();

  const app = pathname.match(/^\/app\/([^/]+)/);
  if (app) return [{ label: "Apps", to: "/apps" }, { label: formatAppName(decodeURIComponent(app[1])) }];

  for (const [prefix, label] of SECTIONS) if (pathname.startsWith(prefix)) return [{ label }];
  return [{ label: "Apps" }];
}
