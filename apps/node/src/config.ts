import fs from "node:fs";

const readTokenFile = (): string => {
  const file = process.env.TWODB_NODE_TOKEN_FILE;
  if (!file) return "";
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch (error) {
    console.error(`[node] cannot read TWODB_NODE_TOKEN_FILE (${file}): ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export const config = {
  apiUrl: process.env.TWODB_NODE_URL ?? "http://localhost:3001",
  token: (process.env.TWODB_NODE_TOKEN ?? "").trim() || readTokenFile(),
  rootDir: process.env.TWODB_ROOT ?? process.cwd(),
  platform: detectPlatform(),
  agentVersion: "0.1.0",
};

function detectPlatform() {
  if (process.env.TWODB_NODE_PLATFORM) return process.env.TWODB_NODE_PLATFORM;
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (fs.existsSync("/.dockerenv")) return "docker";
  return "linux";
}
