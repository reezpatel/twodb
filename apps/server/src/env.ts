const authUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:5173").replace(/\/$/, "");

export const env = {
  port: Number(process.env.TWODB_PORT ?? 3001),
  databaseUrl: process.env.TWODB_DATABASE_URL ?? "postgres://twodb:twodb@localhost:5432/twodb",
  memgraph: {
    url: process.env.MEMGRAPH_URL ?? "bolt://localhost:7687",
    user: process.env.MEMGRAPH_USER || undefined,
    password: process.env.MEMGRAPH_PASSWORD || undefined,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "twodb",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "twodb",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "twodb-secret",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  },
  auth: {
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-in-production",
    /** The URL users open in the browser; the UI, API and OAuth callbacks all live under it (in dev, Vite proxies /api). */
    url: authUrl,
    origin: new URL(authUrl).origin,
    /** Origins of the bundled native apps (Tauri) + any extra comma-separated
     *  TWODB_EXTRA_ORIGINS. They call the API cross-origin with bearer tokens.
     *  tauri://localhost = macOS/iOS; http(s)://tauri.localhost = Windows/Android. */
    nativeOrigins: [
      "tauri://localhost",
      "http://tauri.localhost",
      "https://tauri.localhost",
      ...(process.env.TWODB_EXTRA_ORIGINS ?? "")
        .split(",")
        .map((o) => o.trim().replace(/\/$/, ""))
        .filter(Boolean),
    ],
  },
  passkey: {
    rpID: process.env.PASSKEY_RP_ID ?? "localhost",
  },
  staticDir: process.env.TWODB_STATIC_DIR,
  skipAutoMigration: ["1", "true", "yes"].includes((process.env.TWO_DB_SKIP_AUTO_MIGRATION ?? "").toLowerCase()),
};
