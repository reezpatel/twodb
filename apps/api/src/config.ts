import path from "node:path";

export const envSchema = {
  type: "object",
  properties: {
    // --- API ---
    TWODB_PORT: {
      type: "number",
      default: 3001,
      description: "HTTP port the api listens on",
    },
    TWODB_WORK_DIR: {
      type: "string",
      default: path.resolve(import.meta.dirname, "../../../.work"),
      description: "Absolute path to the api-owned work dir (fetched-plugin extractions); created if missing",
    },
    TWODB_VENDOR_DIR: {
      type: "string",
      default: "../vendor",
      description: "Directory of vendored browser modules served at /vendor (react, react-query, shared-frontend)",
    },
    TWODB_PLUGINS_DIR: {
      type: "string",
      default: "",
      description: "Directory of baked-in plugin folders; missing registry rows are seeded from their .build manifests",
    },
    TWODB_STATIC_DIR: {
      type: "string",
      default: "../../../apps/web/dist",
      description: "Directory of the built web app served at /",
    },

    // --- Admin (passkey auth, /api/v1/admin) ---
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
    TWODB_DATABASE_URL: {
      type: "string",
      default: "postgres://twodb:twodb@localhost:5432/twodb",
      description: "Full postgres:// connection URI",
    },
    TWODB_POSTGRES_POOL_SIZE: {
      type: "number",
      default: 10,
      description: "Max connections in the pg pool",
    },
  },
};

export const dotenvPath = "../../../.env";
