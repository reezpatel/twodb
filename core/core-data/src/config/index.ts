// @twodb/core-data/config
//
// Typed env/secrets loader. Every app defines its own Zod schema for the env
// vars it needs; this just parses `process.env` against it once and fails
// fast with a readable error instead of undefined-propagating at runtime.

import { z, type ZodType } from "zod";

export function loadConfig<T extends ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  // An empty value means "unset" (docker compose renders `VAR: ${VAR:-}` as ""), so optional/default fields still apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration (check your .env):\n${issues}`);
  }
  return result.data;
}

/** Common fragments apps can spread into their own config schema. */
export const commonConfigFields = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Every app dials TwoDB's gateway for anything cross-app. */
  TWODB_GATEWAY_URL: z.string().url().default("http://localhost:6400"),
};
