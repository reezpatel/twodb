import type { AgentTool, AgentToolCall } from "./agent";
import { runnerManager } from "./runner-manager";

export type ToolOutputSink = (stream: "stdout" | "stderr", data: string) => void;

/** Shell-quote a string for POSIX sh. */
const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Base64-encode so arbitrary content survives shell transport without quoting issues. */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** sh snippet that prints the base64-decoded payload to stdout. */
const b64Decode = (payload: string) => `printf %s ${shq(b64(payload))} | base64 -d`;

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "run_command",
    description: "Runs a shell command on the session's runner machine, in the session's working directory. Returns exit code, stdout and stderr.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run" },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Reads a file on the runner machine. Relative paths resolve against the session's working directory. Use offset/limit for large files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        offset: { type: "number", description: "First line to read (1-based, default 1)" },
        limit: { type: "number", description: "Maximum number of lines to read (default: whole file)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Creates a file or fully overwrites an existing one on the runner machine. Parent directories are created as needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        content: { type: "string", description: "Full new content of the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "update_file",
    description:
      "Replaces an exact string in a file on the runner machine. Fails when old_string is absent or matches more than once — include enough surrounding context to make it unique. Prefer this over write_file for targeted edits.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        old_string: { type: "string", description: "Exact text to replace" },
        new_string: { type: "string", description: "Replacement text" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "apply_patch",
    description: "Applies a unified-diff patch in the session's working directory (git apply inside a work tree, patch -p1 otherwise).",
    parameters: {
      type: "object",
      properties: {
        patch: { type: "string", description: "Unified diff content" },
      },
      required: ["patch"],
    },
  },
  {
    name: "grep",
    description: "Searches file contents on the runner machine (ripgrep when available, grep -rn otherwise).",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (regex)" },
        path: { type: "string", description: "File or directory to search (default: working directory)" },
        include: { type: "string", description: "Glob limiting searched files, e.g. *.ts" },
        ignore_case: { type: "boolean", description: "Case-insensitive search" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "glob",
    description: "Finds files on the runner machine by name or pattern (fzf fuzzy-match when available, find -name otherwise).",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search text (fzf) or glob like *.ts (find fallback)" },
        path: { type: "string", description: "Directory to search (default: working directory)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "web_fetch",
    description: "Fetches a URL and returns readable text. Placeholder — not wired up yet.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
      },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description: "Searches the web and returns results. Placeholder — not wired up yet.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
];

const MAX_OUTPUT = 8000;

/** update_file body — inputs arrive base64 in env so no shell quoting is involved. */
const UPDATE_FILE_PY = `
import os, base64, sys

p = base64.b64decode(os.environ["U_FILE"]).decode()
old = base64.b64decode(os.environ["U_OLD"]).decode()
new = base64.b64decode(os.environ["U_NEW"]).decode()
s = open(p, encoding="utf-8").read()
n = s.count(old)
if n == 0:
    sys.exit("error: old_string not found in " + p)
if n > 1:
    sys.exit("error: old_string matches %d times in %s — make it more specific" % (n, p))
open(p, "w", encoding="utf-8").write(s.replace(old, new, 1))
print("updated " + p)
`;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Translates a tool call into the bash script executed on the runner. Throws on invalid arguments. */
function buildCommand(call: AgentToolCall): string {
  const args = call.arguments ?? {};

  switch (call.name) {
    case "run_command": {
      const command = str(args.command);
      if (!command.trim()) throw new Error("empty command");
      return command;
    }

    case "read_file": {
      const path = str(args.path);
      if (!path) throw new Error("path is required");
      const offset = Math.max(1, Number(args.offset) || 1);
      const limit = Math.max(0, Number(args.limit) || 0);
      const reader = offset > 1 || limit > 0 ? `sed -n ${shq(`${offset},${limit > 0 ? offset + limit - 1 : "$"}p`)} -- ${shq(path)}` : `cat -- ${shq(path)}`;
      return `if [ ! -f ${shq(path)} ]; then echo ${shq(`error: not a file: ${path}`)} >&2; exit 1; fi; ${reader}`;
    }

    case "write_file": {
      const path = str(args.path);
      if (!path) throw new Error("path is required");
      const content = str(args.content);
      return `mkdir -p -- "$(dirname -- ${shq(path)})" && ${b64Decode(content)} > ${shq(path)} && echo ${shq(`wrote ${path}`)}`;
    }

    case "update_file": {
      const path = str(args.path);
      if (!path) throw new Error("path is required");
      return (
        `command -v python3 >/dev/null 2>&1 || { echo 'error: update_file requires python3 on the runner' >&2; exit 1; }; ` +
        `U_FILE=${shq(b64(path))} U_OLD=${shq(b64(str(args.old_string)))} U_NEW=${shq(b64(str(args.new_string)))} ` +
        `python3 -c "$(${b64Decode(UPDATE_FILE_PY)})"`
      );
    }

    case "apply_patch": {
      const patch = str(args.patch);
      if (!patch.trim()) throw new Error("patch is required");
      return `if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then ${b64Decode(patch)} | git apply -; else ${b64Decode(patch)} | patch -p1; fi`;
    }

    case "grep": {
      const pattern = str(args.pattern);
      if (!pattern) throw new Error("pattern is required");
      const path = str(args.path) || ".";
      const include = str(args.include);
      const ignoreCase = args.ignore_case === true;
      const rg = ["rg", "--line-number", "--no-heading"];
      const grep = ["grep", "-rn"];
      if (ignoreCase) {
        rg.push("--ignore-case");
        grep.push("-i");
      }
      if (include) {
        rg.push("-g", shq(include));
        grep.push(`--include=${shq(include)}`);
      }
      rg.push("--", shq(pattern), shq(path));
      grep.push("--", shq(pattern), shq(path));
      return `if command -v rg >/dev/null 2>&1; then ${rg.join(" ")}; else ${grep.join(" ")}; fi`;
    }

    case "glob": {
      const pattern = str(args.pattern);
      if (!pattern) throw new Error("pattern is required");
      const path = str(args.path) || ".";
      return (
        `if command -v fzf >/dev/null 2>&1; then ` +
        `{ command -v rg >/dev/null 2>&1 && rg --files ${shq(path)} || find ${shq(path)} -type f -not -path '*/.git/*'; } ` +
        `| fzf --filter ${shq(pattern)} | head -200; ` +
        `else find ${shq(path)} -type f -name ${shq(pattern)} -not -path '*/.git/*' | head -200; fi`
      );
    }

    default:
      throw new Error(`unknown tool "${call.name}"`);
  }
}

export async function executeToolCall(
  runnerId: string | null,
  cwd: string | null,
  call: AgentToolCall,
  onChunk?: ToolOutputSink,
  onWaiting?: () => void,
): Promise<string> {
  if (call.name === "web_fetch" || call.name === "web_search") {
    return `${call.name} is not available yet (placeholder). For fetching, use run_command with curl as a workaround.`;
  }
  if (!runnerId) return "error: no runner assigned to this session";

  try {
    const script = buildCommand(call);
    const command = cwd ? `cd ${shq(cwd)} && ${script}` : script;
    if (call.name === "write_file" && onChunk) {
      // Stream the content being written from the tool args so the UI can show
      // it live. Deliberately not part of the tool result — the model already
      // knows what it wrote, echoing it back would waste context.
      const content = str(call.arguments?.content);
      for (let i = 0; i < content.length; i += 4000) onChunk("stdout", content.slice(i, i + 4000));
    }
    const result = await runnerManager.execOnRunner(runnerId, command, onChunk, { onWaiting });
    const text = `exit code: ${result.code}\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`;
    return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…(truncated)` : text;
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}
