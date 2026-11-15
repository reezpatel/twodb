/** Tiny ANSI helpers — no dependencies. */
const isTty = process.stdout.isTTY;
export const bold = (s: string) => (isTty ? `\x1b[1m${s}\x1b[22m` : s);
export const dim = (s: string) => (isTty ? `\x1b[2m${s}\x1b[22m` : s);
export const cyan = (s: string) => (isTty ? `\x1b[36m${s}\x1b[39m` : s);
export const green = (s: string) => (isTty ? `\x1b[32m${s}\x1b[39m` : s);
export const yellow = (s: string) => (isTty ? `\x1b[33m${s}\x1b[39m` : s);
export const red = (s: string) => (isTty ? `\x1b[31m${s}\x1b[39m` : s);

export function printHelp(lines: string[]): void {
  for (const line of lines) process.stdout.write(line + "\n");
}

export function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

/** Wraps text at ~width with an indent, respecting existing structure lightly. */
export function wrap(text: string, indent: number, width = 100): string {
  const padStr = " ".repeat(indent);
  const max = width - indent;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + " " + word).length > max) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.map((l) => padStr + l).join("\n");
}

export async function readStdin(): Promise<string | null> {
  // Piped stdin (not a TTY). Read fully; return null when nothing is piped.
  if (process.stdin.isTTY) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  if (!chunks.length) return null;
  return Buffer.concat(chunks).toString("utf8");
}

export function prettyJson(value: unknown): string {
  const indent = process.stdout.isTTY ? 2 : 0;
  return JSON.stringify(value, null, indent);
}
