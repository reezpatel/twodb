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

// Never let logging crash the server: if the log dir isn't writable (e.g. a
// service started with cwd=/), fall back to stdout so journald still sees it.
function openStream(): fs.WriteStream | NodeJS.WritableStream {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    return fs.createWriteStream(logFile, { flags: "a" });
  } catch (err) {
    process.stderr.write(`twodb: cannot open log file ${logFile} (${(err as Error).message}), logging to stdout\n`);
    return process.stdout;
  }
}
const stream = openStream();

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
