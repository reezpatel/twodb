import { runnerManager } from "./runner-manager";

export interface GitStatusInfo {
  git: boolean;
  branch: string | null;
  origin: string | null;
  dirtyFiles: number;
  ahead: number | null;
  behind: number | null;
}

export type GitStatusResult = GitStatusInfo | { error: "runner_offline" } | { error: "directory_missing" } | { error: "git_failed"; detail: string };

/** One exec round-trip: git-ness, branch, origin, dirty count, ahead/behind. */
export async function readGitStatus(runnerId: string, cwd: string): Promise<GitStatusResult> {
  const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
  const script = [
    `cd ${q(cwd)} 2>/dev/null || exit 9`,
    "if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then",
    "  echo git",
    "  git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null",
    "  git remote get-url origin 2>/dev/null || echo none",
    "  git status --porcelain 2>/dev/null | wc -l | tr -d ' '",
    "  AB=$(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null)",
    '  if [ -n "$AB" ]; then printf "%s\\n" "$AB" | tr "\\t" " "; else echo none; fi',
    "else",
    "  echo nogit",
    "fi",
  ].join("\n");

  try {
    const r = await runnerManager.execOnRunner(runnerId, script, undefined, { waitMs: 0 });
    if (r.code === 9) return { error: "directory_missing" };
    if (r.code !== 0) return { error: "git_failed", detail: r.stderr.trim().slice(0, 300) };
    const lines = r.stdout.trim().split("\n");
    if (lines[0] !== "git") return { git: false, branch: null, origin: null, dirtyFiles: 0, ahead: null, behind: null };
    const ab = lines[4] && lines[4] !== "none" ? lines[4].trim().split(/\s+/) : null;
    return {
      git: true,
      branch: lines[1] ?? null,
      origin: lines[2] && lines[2] !== "none" ? lines[2] : null,
      dirtyFiles: Number(lines[3] ?? 0) || 0,
      ahead: ab ? Number(ab[0]) || 0 : null,
      behind: ab ? Number(ab[1]) || 0 : null,
    };
  } catch {
    return { error: "runner_offline" };
  }
}
