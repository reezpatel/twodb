import fs from "node:fs";
import path from "node:path";
import pino from "pino";

/**
 * Structured logging for the whole server. One JSON line per event written to
 * a log file (default <cwd>/logs/server.log, override TWODB_LOG_FILE). The
 * /api/logs endpoint reads the same file line-by-line, so the file is the
 * source of truth for the Settings → Logs viewer.
 *
 * Levels: error (failures), warn (degraded but continuing), info (critical
 * lifecycle points — boot, migrations, WS connections, agent runs, tool calls).
 * Nothing sensitive is logged: no API keys, tokens, cookies, or full message
 * bodies — identifiers and short excerpts only.
 */

const logFile = process.env.TWODB_LOG_FILE ?? path.join(process.cwd(), "logs", "server.log");
fs.mkdirSync(path.dirname(logFile), { recursive: true });

// Append-only stream; the server restarts under tsx watch recreate it.
const stream = fs.createWriteStream(logFile, { flags: "a" });

export const logger = pino(
  {
    level: process.env.TWODB_LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    // Keep errors readable as JSON (message + stack, no endless cause chains).
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: undefined,
  },
  stream,
);

export function logFilePath(): string {
  return logFile;
}
