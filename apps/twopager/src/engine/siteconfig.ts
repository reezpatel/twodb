import { z } from "zod";

const source = z.string().min(1).max(300);
const destination = z.string().min(1).max(2000);
const rewriteRule = z.object({ source, destination });
const redirectRule = z.object({ source, destination, type: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional() });

/**
 * Per-version serving config (Firebase-Hosting-like). Sources are globs matched against the URL path:
 *   `**` any depth, `*` one segment part, `?` one char, `{a,b}` alternatives, `:name` one named segment
 *   (usable in redirect destinations as `:name`).
 * Order of evaluation: redirects -> static file -> rewrites -> 404 page.
 */
export const siteConfigSchema = z.object({
  /** Single-page-app shortcut: appends a catch-all rewrite to `/index.html`. */
  spa: z.boolean().optional(),
  /** Serve `/about` for `about.html` and redirect `/about.html` -> `/about`. */
  cleanUrls: z.boolean().optional(),
  /** true: `/docs` -> `/docs/`; false: `/docs/` -> `/docs`; unset: both work. */
  trailingSlash: z.boolean().optional(),
  rewrites: z.array(rewriteRule).max(100).optional(),
  redirects: z.array(redirectRule).max(100).optional(),
  headers: z
    .array(z.object({ source, headers: z.array(z.object({ key: z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+$/), value: z.string().max(2048) })).max(30) }))
    .max(100)
    .optional(),
  /** File served (with status 404) when nothing matches. Default `404.html`. */
  notFoundPage: z.string().max(300).optional(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

export function parseSiteConfig(raw: unknown): SiteConfig {
  return siteConfigSchema.parse(raw ?? {});
}
