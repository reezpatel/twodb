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
    url: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  },
  passkey: {
    rpID: process.env.PASSKEY_RP_ID ?? "localhost",
  },
  webOrigin: process.env.TWODB_WEB_ORIGIN ?? "http://localhost:5173",
  staticDir: process.env.TWODB_STATIC_DIR,
  skipAutoMigration: ["1", "true", "yes"].includes((process.env.TWO_DB_SKIP_AUTO_MIGRATION ?? "").toLowerCase()),
};
