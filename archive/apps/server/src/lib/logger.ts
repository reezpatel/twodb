import fs from "node:fs";
import os from "node:os";
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

const preferredLogFile = process.env.TWODB_LOG_FILE ?? path.join(process.cwd(), "logs", "server.log");
// Last resort when the preferred location isn't writable (e.g. a container user without access to /app/logs).
const fallbackLogFile = path.join(os.tmpdir(), "twodb", "server.log");
let logFile = preferredLogFile;

let fileError: string | null = null;

/** Creates the directory and proves we can append — open errors would otherwise only surface asynchronously. */
function canWrite(file: string): string | null {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.closeSync(fs.openSync(file, "a"));
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

// Never let logging crash the server. Try the configured file, then /tmp, and
// always keep writing to stdout so `docker logs` / journald see everything.
// If a file can't be used we remember why so the viewer can say so.
function openFile(): pino.DestinationStream | null {
  let problem = canWrite(preferredLogFile);
  if (problem) {
    const fallbackProblem = canWrite(fallbackLogFile);
    process.stderr.write(
      fallbackProblem
        ? `twodb: cannot write log file ${preferredLogFile} (${problem}) or ${fallbackLogFile} (${fallbackProblem}), logging to stdout only\n`
        : `twodb: cannot write log file ${preferredLogFile} (${problem}), logging to ${fallbackLogFile} instead\n`,
    );
    if (fallbackProblem) {
      fileError = `${problem}; fallback ${fallbackLogFile}: ${fallbackProblem}`;
      return null;
    }
    logFile = fallbackLogFile;
    problem = null;
  }
  const dest = pino.destination({ dest: logFile, sync: false, append: true, mkdir: true });
  dest.on("error", (err: Error) => {
    fileError = err.message;
    process.stderr.write(`twodb: log file write failed (${err.message}), logging to stdout only\n`);
  });
  return dest;
}
const fileDest = openFile();

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
  fileDest ? pino.multistream([{ stream: process.stdout }, { stream: fileDest }]) : process.stdout,
);

/** The file actually being written (the /tmp fallback when the configured one isn't writable). */
export function logFilePath(): string {
  return logFile;
}

/** Why the log file can't be written, or null when it's fine. */
export function logFileError(): string | null {
  return fileError;
}

/** Reopens the file — recreates it if it was deleted/rotated out from under us. */
export function reopenLogFile(): void {
  try {
    (fileDest as { reopen?: () => void } | null)?.reopen?.();
  } catch (err) {
    fileError = (err as Error).message;
  }
}
