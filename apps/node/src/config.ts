try {
  process.loadEnvFile();
} catch {
  // no .env next to the agent — rely on real environment variables
}

export const CONTROLLER_URL = process.env.TWODB_CONTROLLER_URL || "http://localhost:3001";

export const CONTROLLER_WS_PATH = process.env.TWODB_CONTROLLER_WS_PATH || "/api/v1/io.twodb.node/nodes/ws";

export const NODE_SECRET = process.env.TWODB_NODE_SECRET || "";

const heartbeatMs = Number(process.env.TWODB_HEARTBEAT_MS);
export const HEARTBEAT_MS = Number.isFinite(heartbeatMs) && heartbeatMs >= 1000 ? heartbeatMs : 10_000;

export const ROOT_DIR = process.env.TWODB_ROOT_DIR || process.cwd();

export const controllerWsUrl = (): string => {
  const base = CONTROLLER_URL.replace(/^http/i, "ws");
  return new URL(CONTROLLER_WS_PATH, base).toString();
};
