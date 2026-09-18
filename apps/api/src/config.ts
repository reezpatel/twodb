// Single source of truth for runtime configuration.
//
// This schema is consumed by @fastify/fastify-env at boot. fastify-env
// validates process.env (overlaid with values from `.env`) against the
// schema, fills in defaults when keys are missing, and exposes the result
// as `fastify.config.*`. Plugins should never read `process.env` directly -
// they should pull from `fastify.config` so defaults stay centralized.
//
// To add a new env var:
//   1. Add it here with a default.
//   2. Reference `fastify.config.YOUR_VAR` from a plugin or handler.
//   3. (Optional) Add it to /<repo-root>/.env.example so humans know it
//      exists.
//
// Defaults are dev-friendly and match the docker-compose.db.yaml service
// defaults so the api runs out of the box against `pnpm db:up`.

export const envSchema = {
  type: "object",
  properties: {
    // --- API ---
    PORT: {
      type: "number",
      default: 3001,
      description: "HTTP port the api listens on",
    },
    TWO_DB_WORK_DIR: {
      type: "string",
      default: "../../../.work",
      description: "Directory holding the api-owned sqlite database (db-v1.sqlite), resolved from apps/api/src; created if missing",
    },

    // --- Admin (passkey auth, /api/admin) ---
    TWODB_ADMIN_RP_ID: {
      type: "string",
      default: "localhost",
      description: "WebAuthn relying-party id for admin passkeys",
    },
    TWODB_ADMIN_ORIGIN: {
      type: "string",
      default: "http://localhost:5173",
      description: "Expected WebAuthn origin for admin passkey ceremonies (the web app origin)",
    },
    TWODB_ADMIN_SESSION_TTL_MS: {
      type: "number",
      default: 604_800_000,
      description: "Admin session lifetime in ms (default 7 days)",
    },

    // --- Postgres (consumed by @fastify/postgres) ---
    DATABASE_URL: {
      type: "string",
      default: "postgres://twodb:twodb@localhost:5432/twodb",
      description: "Full postgres:// connection URI",
    },
    POSTGRES_POOL_SIZE: {
      type: "number",
      default: 10,
      description: "Max connections in the pg pool",
    },
  },
};

/**
 * Path to the .env file the api should load. Resolved against the api's
 * entry-point directory (apps/api/src) at runtime, so the file lives three
 * levels up - at the repo root. Dotenv silently no-ops if the file is
 * missing, so this is safe to leave alone in environments where the api
 * runs without a .env (CI, production with real env vars, etc.).
 */
export const dotenvPath = "../../../.env";
