/** Tool names offered to agents — mirrors the server's AGENT_TOOLS list
 * (apps/server/src/lib/agent-tools.ts). The special value "all" (checkbox at
 * the top) means every tool, including ones added in the future. */

export const AGENT_TOOL_NAMES = [
  { name: "read_skill", label: "read_skill", hint: "load a skill's content" },
  { name: "read_asset", label: "read_asset", hint: "read an uploaded asset" },
  { name: "update_canvas", label: "update_canvas", hint: "canvas documents" },
  { name: "ask_user", label: "ask_user", hint: "ask the user questions" },
  { name: "set_session_name", label: "set_session_name", hint: "rename the session" },
  { name: "get_plan", label: "get_plan", hint: "read the plan" },
  { name: "update_plan", label: "update_plan", hint: "edit the plan" },
  { name: "run_command", label: "run_command", hint: "shell on the runner (code only)" },
  { name: "read_file", label: "read_file", hint: "read a file (code only)" },
  { name: "write_file", label: "write_file", hint: "create/overwrite a file (code only)" },
  { name: "update_file", label: "update_file", hint: "targeted string replace (code only)" },
  { name: "apply_patch", label: "apply_patch", hint: "apply a unified diff (code only)" },
  { name: "grep", label: "grep", hint: "search file contents (code only)" },
  { name: "glob", label: "glob", hint: "find files (code only)" },
  { name: "web_fetch", label: "web_fetch", hint: "fetch a URL" },
  { name: "web_search", label: "web_search", hint: "search the web" },
] as const;

export const AGENT_TOOL_ALL = "all";
