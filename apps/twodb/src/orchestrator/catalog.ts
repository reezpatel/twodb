// Static catalog of installable apps. This is a monorepo today (every app
// lives under apps/<slug> and is built from the same repo checkout TwoDB
// itself runs from), so "installable" just means "has a package.json under
// apps/<slug> with a manifest.ts" — there's no separate registry server to
// query yet. When apps start shipping as standalone images/repos, this
// catalog is the one place that changes to a real lookup.
//
// Ports are a fixed, hand-assigned map so installs are reproducible and two
// apps never collide — see README.md "Port assignments" for the full table.

export interface CatalogEntry {
  slug: string;
  /** Workspace package name, e.g. "@twodb/app-tworoute" — used for `pnpm --filter <pkgName> start`. */
  pkgName: string;
  /** Port the app's Fastify server listens on *inside* its container. */
  containerPort: number;
  /** Port published on the host so the Gateway (and you) can reach it at http://localhost:<hostPort>. */
  hostPort: number;
}

// NOTE: TwoDB itself is deliberately NOT here — it's the thing doing the
// installing (circular), and it runs on the host with its own SQLite file.
// Its Docker image is still released by CI when a repo-wide tag touches it,
// but deploying it is a bootstrap step outside the orchestrator's scope.
export const APP_CATALOG: CatalogEntry[] = [
  { slug: "tworoute", pkgName: "@twodb/app-tworoute", containerPort: 4010, hostPort: 4010 },
  { slug: "twomail", pkgName: "@twodb/app-twomail", containerPort: 4011, hostPort: 4011 },
  { slug: "twoday", pkgName: "@twodb/app-twoday", containerPort: 4012, hostPort: 4012 },
  { slug: "twocontacts", pkgName: "@twodb/app-twocontacts", containerPort: 4013, hostPort: 4013 },
  { slug: "twochat", pkgName: "@twodb/app-twochat", containerPort: 4014, hostPort: 4014 },
  { slug: "twodrive", pkgName: "@twodb/app-twodrive", containerPort: 4015, hostPort: 4015 },
  { slug: "artisan", pkgName: "@twodb/app-artisan", containerPort: 4016, hostPort: 4016 },
  { slug: "dispatch", pkgName: "@twodb/app-dispatch", containerPort: 4017, hostPort: 4017 },
  { slug: "tworing", pkgName: "@twodb/app-tworing", containerPort: 4018, hostPort: 4018 },
  { slug: "garden", pkgName: "@twodb/app-garden", containerPort: 4019, hostPort: 4019 },
  { slug: "twothing", pkgName: "@twodb/app-twothing", containerPort: 4020, hostPort: 4020 },
  { slug: "twoloop", pkgName: "@twodb/app-twoloop", containerPort: 4021, hostPort: 4021 },
  { slug: "membrain", pkgName: "@twodb/app-membrain", containerPort: 4022, hostPort: 4022 },
  { slug: "paintress", pkgName: "@twodb/app-paintress", containerPort: 4023, hostPort: 4023 },
  { slug: "twopin", pkgName: "@twodb/app-twopin", containerPort: 4024, hostPort: 4024 },
  { slug: "twodoo", pkgName: "@twodb/app-twodoo", containerPort: 4025, hostPort: 4025 },
];

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return APP_CATALOG.find((e) => e.slug === slug);
}
