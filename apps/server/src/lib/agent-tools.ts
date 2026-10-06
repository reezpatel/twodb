import type { AgentImagePart, AgentTool, AgentToolCall, ToolScope } from "./agent";
import { db } from "../auth";
import type { CodeSessionArtifactType } from "../plugins/db";
import { getCodeSettings } from "./code-settings";
import { enabledRepoSources, readRepoSkill } from "./skills";
import { readAssetForModel } from "./assets";
import { runnerManager } from "./runner-manager";
import { broadcastToSession, broadcastSessionEvent } from "../routes/code-ws";

export type ToolOutputSink = (stream: "stdout" | "stderr", data: string) => void;

/** Shell-quote a string for POSIX sh. */
const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Base64-encode so arbitrary content survives shell transport without quoting issues. */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** sh snippet that prints the base64-decoded payload to stdout. */
const b64Decode = (payload: string) => `printf %s ${shq(b64(payload))} | base64 -d`;

/** Standalone so non-runner chats (assistant) can offer skill loading too. */
export const READ_SKILL_TOOL: AgentTool = {
  name: "read_skill",
  description: "Reads a skill's full content by name. Skill names are listed in the system prompt's [Skills] section. Read a skill before following it.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name, exactly as listed in [Skills]" },
    },
    required: ["name"],
  },
};

export interface CanvasArtifactResult {
  id: string;
  title: string;
  type: string;
  content: string;
  updatedAt: string;
}

/** Canvas document tool — available everywhere; content is upserted per session + title. */
export const CANVAS_TOOL: AgentTool = {
  name: "update_canvas",
  description:
    "Creates or updates the canvas document shown beside the chat. Call with the FULL content every time (it replaces the previous version of that title).",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short document title" },
      type: { type: "string", enum: ["markdown", "html", "code", "text"], description: "Content format" },
      content: { type: "string", description: "Full document content" },
    },
    required: ["title", "type", "content"],
  },
};

/** Asks the user questions and blocks until they answer — available everywhere. */
export const ASK_USER_TOOL: AgentTool = {
  name: "ask_user",
  description:
    "Asks the user one or more questions and waits for their answers before continuing. Use when you need a decision, choice, or clarification instead of guessing. Each question may offer options; the user can always answer freely.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        description: "One or more questions to ask the user",
        items: {
          type: "object",
          properties: {
            question: { type: "string", description: "Question text" },
            options: { type: "array", items: { type: "string" }, description: "Selectable answers (optional)" },
            allowMultiple: { type: "boolean", description: "Allow selecting several options (default false)" },
          },
          required: ["question"],
        },
      },
    },
    required: ["questions"],
  },
};

/** Tools offered for a chat flavor — code sessions (runner) or assistant-style (no directory). */
export function toolsForScope(scope: ToolScope): AgentTool[] {
  return AGENT_TOOLS.filter((tool) => tool.scope.includes(scope));
}

/** Reads a chat asset by its twodb:// uri — available everywhere. */
export const READ_ASSET_TOOL: AgentTool = {
  name: "read_asset",
  description:
    "Reads an uploaded asset by its twodb:// URI (as linked in the conversation). Text-like files return their content; images return the picture itself when you support vision.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      uri: { type: "string", description: "Asset URI, e.g. twodb://<backend>/<media-id>" },
    },
    required: ["uri"],
  },
};

/** Session plan tools — code sessions only; full-replacement step list persisted on the session. */
export const GET_PLAN_TOOL: AgentTool = {
  name: "get_plan",
  description: "Reads this session's current plan — the step list with statuses (pending | in_progress | done). Returns 'no plan set' when none exists.",
  scope: ["code"],
  parameters: { type: "object", properties: {} },
};

export const UPDATE_PLAN_TOOL: AgentTool = {
  name: "update_plan",
  description:
    "Replaces this session's plan with the given steps. Use it for multi-step work: set the plan before starting, then move steps to in_progress/done as you go. Always pass the FULL step list — it replaces the previous plan.",
  scope: ["code"],
  parameters: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        description: "The complete step list",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "What this step does" },
            status: { type: "string", enum: ["pending", "in_progress", "done"], description: "Step status" },
          },
          required: ["description", "status"],
        },
      },
    },
    required: ["steps"],
  },
};

/** Names the session in the sidebar — available everywhere; respects user renames. */
export const SET_SESSION_NAME_TOOL: AgentTool = {
  name: "set_session_name",
  description:
    "Sets this session's display name in the sidebar. Call it ONCE, after the user's goal for the session has become clear — not in the first exchange. Never call it again after that; a user rename always wins.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short session name (3-6 words), e.g. 'Fix login timeout bug'" },
    },
    required: ["name"],
  },
};

export const AGENT_TOOLS: AgentTool[] = [
  READ_SKILL_TOOL,
  READ_ASSET_TOOL,
  CANVAS_TOOL,
  ASK_USER_TOOL,
  SET_SESSION_NAME_TOOL,
  GET_PLAN_TOOL,
  UPDATE_PLAN_TOOL,
  {
    name: "run_command",
    description: "Runs a shell command on the session's runner machine, in the session's working directory. Returns exit code, stdout and stderr.",
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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
    scope: ["code"],
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

/** update_file body — node, guaranteed since the runner itself is a node process (python3 is absent on NixOS runners). Inputs arrive base64 in env so no shell quoting is involved. */
const UPDATE_FILE_JS = `
const b64 = (v) => Buffer.from(v ?? "", "base64").toString("utf8");
const file = b64(process.env.U_FILE), oldS = b64(process.env.U_OLD), newS = b64(process.env.U_NEW);
const fs = require("fs");
const s = fs.readFileSync(file, "utf8");
const n = s.split(oldS).length - 1;
if (n === 0) { console.error("error: old_string not found in " + file); process.exit(1); }
if (n > 1) { console.error("error: old_string matches " + n + " times in " + file + " — make it more specific"); process.exit(1); }
fs.writeFileSync(file, s.replace(oldS, newS));
console.log("updated " + file);
`;

/**
 * Models habitually wrap diffs in markdown fences, drop the trailing newline
 * and miscount `@@` hunk headers. git apply needs `--recount` for the last of
 * those and plain `patch` has no such flag at all — so the counts are fixed up
 * here, before the patch ever reaches the runner.
 */
function stripPatchFences(patch: string): string {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  if (lines.length && /^\s*```/.test(lines[0])) lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length && /^\s*```\s*$/.test(lines[lines.length - 1])) lines.pop();
  return `${lines.join("\n")}\n`;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;
const FILE_HEADER = /^(diff |--- |\+\+\+ |Index: )/;

/** git diffs carry a/ and b/ prefixes (strip 1); bare diffs do not (strip 0). */
function patchStripLevel(patch: string): number {
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) return 1;
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const path = line.slice(4).split("\t")[0].trim();
      return /^(a|b)\//.test(path) ? 1 : 0;
    }
  }
  return 1;
}

/** Rewrites every `@@` header to the counts its body actually contains. */
function recountHunks(patch: string): string {
  const lines = patch.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const header = HUNK_HEADER.exec(lines[i]);
    if (!header) {
      out.push(lines[i]);
      continue;
    }
    const body: string[] = [];
    let oldCount = 0;
    let newCount = 0;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j];
      if (HUNK_HEADER.test(line) || FILE_HEADER.test(line)) break;
      if (line.startsWith("\\")) {
        body.push(line);
        continue;
      }
      if (line.startsWith("-")) oldCount++;
      else if (line.startsWith("+")) newCount++;
      else if (line.startsWith(" ") || line === "") {
        oldCount++;
        newCount++;
      } else break;
      body.push(line);
    }
    out.push(`@@ -${header[1]},${oldCount} +${header[3]},${newCount} @@${header[5]}`);
    out.push(...body);
    i = j - 1;
  }
  return `${out.join("\n")}\n`;
}

/**
 * apply_patch body. Reads the diff on stdin and applies it. $1 is the strip
 * level (1 for git-style a/ b/ prefixes, 0 for bare diffs), used only by the
 * patch fallback.
 *
 * git apply works outside work trees as well, auto-detects a/ b/ stripping and
 * tolerates stale line numbers; --recount is what repairs the miscounted @@
 * headers models emit (the "corrupt patch at <stdin>:N" failure). GNU patch is
 * the fallback for runners without git — fuzz stays at 1 because 2 can match
 * unrelated context and silently corrupt the file.
 */
const APPLY_PATCH_SH = `
__twodb_p=$(mktemp) || exit 1
trap 'rm -f "$__twodb_p"' EXIT
cat > "$__twodb_p" || exit 1
if [ ! -s "$__twodb_p" ]; then echo 'error: empty patch' >&2; exit 1; fi

if command -v git >/dev/null 2>&1; then
  git apply --recount --whitespace=nowarn "$__twodb_p" && exit 0
fi

if ! command -v patch >/dev/null 2>&1; then
  echo 'error: apply_patch needs git or patch on the runner' >&2
  exit 1
fi

set -- "-p$1" --fuzz=1
__twodb_help=$(patch --help 2>&1)
for __twodb_opt in --forward --batch --no-backup-if-mismatch; do
  case "$__twodb_help" in *"$__twodb_opt"*) set -- "$@" "$__twodb_opt";; esac
done
patch "$@" < "$__twodb_p"
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
        `U_FILE=${shq(b64(path))} U_OLD=${shq(b64(str(args.old_string)))} U_NEW=${shq(b64(str(args.new_string)))} ` +
        `node -e "$(${b64Decode(UPDATE_FILE_JS)})"`
      );
    }

    case "apply_patch": {
      const raw = str(args.patch);
      if (!raw.trim()) throw new Error("patch is required");
      return `${b64Decode(recountHunks(stripPatchFences(raw)))} | sh -c "$(${b64Decode(APPLY_PATCH_SH)})" twodb ${patchStripLevel(raw)}`;
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

export interface ToolExecution {
  output: string;
  /** null when the command never ran (thrown before exec). */
  code: number | null;
  failed: boolean;
  /** Set by update_canvas — the loop emits it as a canvas frame. */
  artifact?: CanvasArtifactResult;
  /** Set by read_asset on images — transient wire parts for vision models. */
  imageParts?: AgentImagePart[];
}

/** Server-side context for tools that resolve beyond the runner (read_skill, update_canvas, read_asset). */
export interface ToolContext {
  organizationId: string;
  sessionId: string;
  codeDirectoryId: string | null;
  /** Whether the current model can see images — read_asset inlines them when true. */
  supportsImages: boolean;
  /** Only the Anthropic wire renders images inside tool results; elsewhere the upload-time attachment carries them. */
  imageToolResults: boolean;
}

const CANVAS_TYPES = new Set(["markdown", "html", "code", "text"]);

/** update_canvas upserts the session's canvas document — server-side, no runner. */
async function executeUpdateCanvas(ctx: ToolContext | undefined, call: AgentToolCall): Promise<ToolExecution> {
  if (!ctx) return { output: "error: update_canvas requires session context", code: null, failed: true };
  const title = (str(call.arguments?.title) || "Untitled").slice(0, 120);
  const rawType = str(call.arguments?.type) || "markdown";
  const type = (CANVAS_TYPES.has(rawType) ? rawType : "markdown") as CodeSessionArtifactType;
  const content = str(call.arguments?.content);

  const now = new Date();
  await db
    .insertInto("code_session_artifact")
    .values({ id: crypto.randomUUID(), sessionId: ctx.sessionId, organizationId: ctx.organizationId, title, type, content, createdAt: now, updatedAt: now })
    .onConflict((oc) => oc.columns(["sessionId", "title"]).doUpdateSet({ type, content, updatedAt: now }))
    .execute();
  const artifact = await db
    .selectFrom("code_session_artifact")
    .selectAll()
    .where("sessionId", "=", ctx.sessionId)
    .where("title", "=", title)
    .executeTakeFirstOrThrow();
  return {
    output: `canvas updated: ${title}`,
    code: 0,
    failed: false,
    artifact: { id: artifact.id, title: artifact.title, type: artifact.type, content: artifact.content, updatedAt: artifact.updatedAt.toISOString() },
  };
}

const PLAN_STATUSES = new Set(["pending", "in_progress", "done"]);

/**
 * set_session_name renames the session in the sidebar. A user rename (marked
 * runtimeState.titleUserEdited) makes this a no-op — the tool still succeeds
 * so the model doesn't retry.
 */
async function executeSetSessionName(ctx: ToolContext | undefined, call: AgentToolCall): Promise<ToolExecution> {
  if (!ctx) return { output: "error: set_session_name requires session context", code: null, failed: true };
  const name = str(call.arguments?.name).trim().slice(0, 80);
  if (!name) return { output: "error: name is required", code: null, failed: true };
  const row = await db.selectFrom("code_session").select(["id", "title", "runtimeState"]).where("id", "=", ctx.sessionId).executeTakeFirst();
  if (!row) return { output: "error: session not found", code: null, failed: true };
  if ((row.runtimeState as { titleUserEdited?: boolean } | null)?.titleUserEdited) {
    return { output: "name kept — user already renamed this session", code: 0, failed: false };
  }
  await db.updateTable("code_session").set({ title: name }).where("id", "=", ctx.sessionId).execute();
  broadcastToSession(ctx.sessionId, { type: "session_updated" });
  broadcastSessionEvent(ctx.organizationId, { type: "session_updated", session: { id: ctx.sessionId, title: name, updatedAt: new Date().toISOString() } });
  return { output: `session named: ${name}`, code: 0, failed: false };
}

/** get_plan/update_plan — reads or fully replaces the session's plan column. */
async function executePlan(ctx: ToolContext | undefined, call: AgentToolCall): Promise<ToolExecution> {
  if (!ctx) return { output: "error: plan tools require session context", code: null, failed: true };
  if (call.name === "get_plan") {
    const row = await db.selectFrom("code_session").select("plan").where("id", "=", ctx.sessionId).executeTakeFirst();
    const steps = row?.plan && Array.isArray((row.plan as { steps?: unknown }).steps) ? (row.plan as { steps: unknown[] }).steps : [];
    return { output: steps.length > 0 ? JSON.stringify({ steps }, null, 2) : "no plan set", code: 0, failed: false };
  }
  const raw = Array.isArray(call.arguments?.steps) ? (call.arguments.steps as unknown[]) : [];
  const steps = raw
    .map((s) => {
      const step = s as { description?: unknown; status?: unknown };
      return {
        description: typeof step.description === "string" ? step.description.trim() : "",
        status: typeof step.status === "string" && PLAN_STATUSES.has(step.status) ? step.status : "pending",
      };
    })
    .filter((s) => s.description);
  if (steps.length === 0) return { output: "error: update_plan requires at least one step with a description", code: null, failed: true };
  await db
    .updateTable("code_session")
    .set({ plan: JSON.stringify({ steps }), updatedAt: new Date() })
    .where("id", "=", ctx.sessionId)
    .execute();
  return { output: JSON.stringify({ steps }, null, 2), code: 0, failed: false };
}

/** read_skill resolves DB skills first, then repo skills from the runner. */
async function executeReadSkill(ctx: ToolContext | undefined, runnerId: string | null, cwd: string | null, call: AgentToolCall): Promise<ToolExecution> {
  const name = str(call.arguments?.name).trim();
  if (!name) return { output: "error: name is required", code: null, failed: true };
  if (ctx) {
    const rows = await db
      .selectFrom("skill")
      .selectAll()
      .where("organizationId", "=", ctx.organizationId)
      .where((eb) => eb.or([eb("codeDirectoryId", "is", null), ...(ctx.codeDirectoryId ? [eb("codeDirectoryId", "=", ctx.codeDirectoryId)] : [])]))
      .execute();
    const row = rows.find((r) => r.name === name);
    if (row) return { output: `${row.name}\n\n${row.content}`, code: 0, failed: false };
    if (runnerId && cwd) {
      const settings = await getCodeSettings(ctx.organizationId);
      const content = await readRepoSkill(runnerId, cwd, enabledRepoSources(settings.skillSources), name);
      if (content) return { output: content, code: 0, failed: false };
    }
  }
  return { output: `error: skill not found: ${name}`, code: null, failed: true };
}

export async function executeToolCall(
  runnerId: string | null,
  cwd: string | null,
  call: AgentToolCall,
  onChunk?: ToolOutputSink,
  onWaiting?: () => void,
  ctx?: ToolContext,
): Promise<ToolExecution> {
  if (call.name === "read_skill") {
    try {
      return await executeReadSkill(ctx, runnerId, cwd, call);
    } catch (e) {
      return { output: `error: ${(e as Error).message}`, code: null, failed: true };
    }
  }
  if (call.name === "update_canvas") {
    try {
      return await executeUpdateCanvas(ctx, call);
    } catch (e) {
      return { output: `error: ${(e as Error).message}`, code: null, failed: true };
    }
  }
  if (call.name === "get_plan" || call.name === "update_plan") {
    try {
      return await executePlan(ctx, call);
    } catch (e) {
      return { output: `error: ${(e as Error).message}`, code: null, failed: true };
    }
  }
  if (call.name === "set_session_name") {
    try {
      return await executeSetSessionName(ctx, call);
    } catch (e) {
      return { output: `error: ${(e as Error).message}`, code: null, failed: true };
    }
  }
  if (call.name === "read_asset") {
    if (!ctx) return { output: "error: read_asset requires session context", code: null, failed: true };
    const uri = str(call.arguments?.uri).trim();
    if (!uri) return { output: "error: uri is required", code: null, failed: true };
    try {
      const asset = await readAssetForModel(ctx.organizationId, uri, ctx.supportsImages, ctx.imageToolResults);
      return { output: asset.output, code: 0, failed: false, ...(asset.imagePart ? { imageParts: [asset.imagePart] } : {}) };
    } catch (e) {
      return { output: `error: ${(e as Error).message}`, code: null, failed: true };
    }
  }
  if (call.name === "web_fetch" || call.name === "web_search") {
    return {
      output: `${call.name} is not available yet (placeholder). For fetching, use run_command with curl as a workaround.`,
      code: null,
      failed: true,
    };
  }
  if (!runnerId) return { output: "error: no runner assigned to this session", code: null, failed: true };

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
    return {
      output: text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…(truncated)` : text,
      code: result.code,
      failed: result.code !== 0,
    };
  } catch (e) {
    return { output: `error: ${(e as Error).message}`, code: null, failed: true };
  }
}
