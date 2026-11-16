import { z } from "zod";

export const anyObject = z.record(z.string(), z.any());
export const anyList = z.array(anyObject);
export const ok = z.object({ ok: z.boolean() });

export const spaceId = z.string().min(1);
export const siteId = z.string().min(1);
export const versionId = z.string().min(1);

/** Query-string friendly boolean ("true"/"false"/"1"/"0" or a real boolean). */
export const boolish = z.union([z.boolean(), z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1")]);

export const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "lowercase letters, digits and dashes (max 40)");

export const hostname = z
  .string()
  .min(3)
  .max(253)
  .transform((h) => h.trim().toLowerCase().replace(/\.$/, ""))
  .refine((h) => /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h), "must be a fully-qualified domain name, e.g. example.com");
