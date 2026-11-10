/**
 * The installable app catalog — the single place that knows every
 * installable app's name, workspace package and FIXED ports. Ports are
 * stable per app (not allocated) so a developer running a stack on the host
 * and TwoDB running containers never collide: each app owns its port across
 * environments.
 *
 * Port allocation:
 * - TwoDB (control plane + gateway): 4000 — unchanged; hub.twodb.io, the
 *   NixOS module, TWODB_GATEWAY_URL and every existing deploy point there.
 * - Installable apps: 6400+ sequentially (see the roadmap: "new apps run
 *   from port 6400 to 6500"). Reserved block for future apps: 6416–6499.
 * - Local dev webapps (Vite): twodb 5173 (established; PASSKEY_ORIGIN and
 *   the Vite proxy target it), scaffold webapps 5180+ sequentially.
 */
export interface CatalogEntry {
  slug: string;
  name: string;
  /** pnpm workspace package name — used to resolve endpoint.json in dev. */
  pkgName: string;
  /** Port the app listens on inside its container (PORT env). */
  containerPort: number;
  /** Host port TwoDB publishes the container on (same value; fixed per app). */
  hostPort: number;
}

export const APP_CATALOG: CatalogEntry[] = [
  { slug: "tworoute", name: "TwoRoute", pkgName: "@twodb/app-tworoute", containerPort: 6400, hostPort: 6400 },
  { slug: "twomail", name: "TwoMail", pkgName: "@twodb/app-twomail", containerPort: 6401, hostPort: 6401 },
  { slug: "twoday", name: "TwoDay", pkgName: "@twodb/app-twoday", containerPort: 6402, hostPort: 6402 },
  { slug: "twocontacts", name: "TwoContacts", pkgName: "@twodb/app-twocontacts", containerPort: 6403, hostPort: 6403 },
  { slug: "twochat", name: "TwoChat", pkgName: "@twodb/app-twochat", containerPort: 6404, hostPort: 6404 },
  { slug: "twodrive", name: "TwoDrive", pkgName: "@twodb/app-twodrive", containerPort: 6405, hostPort: 6405 },
  { slug: "artisan", name: "Artisan", pkgName: "@twodb/app-artisan", containerPort: 6406, hostPort: 6406 },
  { slug: "dispatch", name: "Dispatch", pkgName: "@twodb/app-dispatch", containerPort: 6407, hostPort: 6407 },
  { slug: "tworing", name: "TwoRing", pkgName: "@twodb/app-tworing", containerPort: 6408, hostPort: 6408 },
  { slug: "garden", name: "Garden", pkgName: "@twodb/app-garden", containerPort: 6409, hostPort: 6409 },
  { slug: "twothing", name: "TwoThing", pkgName: "@twodb/app-twothing", containerPort: 6410, hostPort: 6410 },
  { slug: "twoloop", name: "TwoLoop", pkgName: "@twodb/app-twoloop", containerPort: 6411, hostPort: 6411 },
  { slug: "membrain", name: "Membrain", pkgName: "@twodb/app-membrain", containerPort: 6412, hostPort: 6412 },
  { slug: "paintress", name: "Paintress", pkgName: "@twodb/app-paintress", containerPort: 6413, hostPort: 6413 },
  { slug: "twopin", name: "TwoPin", pkgName: "@twodb/app-twopin", containerPort: 6414, hostPort: 6414 },
  { slug: "twodoo", name: "TwoDoo", pkgName: "@twodb/app-twodoo", containerPort: 6415, hostPort: 6415 },
];

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return APP_CATALOG.find((entry) => entry.slug === slug);
}
