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
    STATIC_DIR: {
      type: "string",
      default: "../../../apps/web/dist",
      description: "Directory of built React static assets, resolved from apps/api/src",
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

    // --- Identity (consumed by @twodb/plugin-identity) ---
    TWODB_IDENTIFIER: {
      type: "string",
      default: "email",
      description: "User identifier mode: email | phone | email+phone (deployment invariant)",
    },
    TWODB_SUPERADMIN_EMAIL: {
      type: "string",
      default: "",
      description: "Email of the first superadmin, granted at register/boot when platform_admins is empty",
    },
    TWODB_REQUIRE_VERIFIED: {
      type: "boolean",
      default: false,
      description: "Verified-only gate: unverified sessions get 403 verify_required outside the verify/session endpoints",
    },
    TWODB_API_ORIGIN: {
      type: "string",
      default: "http://localhost:3001",
      description: "Absolute origin of this api — used to build magic-link and SSO callback URLs",
    },
    TWODB_AGENT_ENCRYPTION_KEY: {
      type: "string",
      default: "twodb-dev-agent-key-override-in-production",
      description: "Key material (hashed to 32 bytes) for AES-256-GCM encryption of agent credentials at rest. MUST be overridden outside dev.",
    },
    TWODB_AGENT_USAGE_INTERVAL_MS: {
      type: "number",
      default: 300_000,
      description: "Cron tick for agent usage collection. Providers are only refetched once their own TTL elapsed, so this can tick often.",
    },

    TWODB_STORAGE_ENCRYPTION_KEY: {
      type: "string",
      default: "twodb-dev-storage-key-override-in-production",
      description: "Key material (hashed to 32 bytes) for AES-256-GCM encryption of storage-location credentials at rest. MUST be overridden outside dev.",
    },

    // --- Memgraph (Bolt) ---
    MEMGRAPH_URL: {
      type: "string",
      default: "bolt://localhost:7687",
      description: "Bolt URL. Use bolt+s:// or neo4j+s:// to enable TLS; the plugin auto-enables encryption for those schemes.",
    },
    MEMGRAPH_USER: {
      type: "string",
      default: "",
      description: "Bolt auth user (Memgraph is unauthenticated by default)",
    },
    MEMGRAPH_PASSWORD: {
      type: "string",
      default: "",
      description: "Bolt auth password",
    },
    MEMGRAPH_DATABASE: {
      type: "string",
      default: "memgraph",
      description: "Memgraph database name (memgraph supports only one)",
    },
    MEMGRAPH_POOL_SIZE: {
      type: "number",
      default: 50,
      description: "Max connections in the neo4j-driver pool",
    },

    // --- S3-compatible object storage (MinIO in local compose) ---
    S3_ENDPOINT: {
      type: "string",
      default: "http://localhost:9000",
      description: "S3-compatible endpoint URL",
    },
    S3_REGION: {
      type: "string",
      default: "us-east-1",
      description: "S3 signing region",
    },
    S3_BUCKET: {
      type: "string",
      default: "twodb",
      description: "Default S3 bucket name",
    },
    S3_ACCESS_KEY_ID: {
      type: "string",
      default: "twodb",
      description: "S3 access key id",
    },
    S3_SECRET_ACCESS_KEY: {
      type: "string",
      default: "twodb-secret",
      description: "S3 secret access key",
    },
    S3_FORCE_PATH_STYLE: {
      type: "boolean",
      default: true,
      description: "Use path-style S3 URLs, required by MinIO",
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
