import fs from "node:fs";

export const config = {
  apiUrl: process.env.TWODB_NODE_URL ?? "http://localhost:3001",
  token: process.env.TWODB_NODE_TOKEN ?? "",
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
