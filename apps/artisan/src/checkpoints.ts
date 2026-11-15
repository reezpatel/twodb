import type { DispatchClient } from "./dispatch-client.js";
import { newId } from "./db/repository.js";

/** Snapshot of a directory as a git ref (temp index — staged state and HEAD stay untouched). */
export async function snapshotDirectory(
  dispatch: DispatchClient,
  runner: string,
  directory: string,
): Promise<{ ref: string; sha: string } | { error: "not_git" | "runner_offline" | "failed"; detail?: string }> {
  const cpId = newId();
  const script = [
    "git rev-parse --git-dir >/dev/null 2>&1 || exit 14",
    "T=$(mktemp) || exit 10",
    "GIT_INDEX_FILE=$T",
    "export GIT_INDEX_FILE",
    "git read-tree HEAD 2>/dev/null",
    "git add -A",
    "TREE=$(git write-tree 2>/dev/null) || exit 11",
    "rm -f $T",
    "PARENT=$(git rev-parse --verify -q HEAD)",
    'if [ -n "$PARENT" ]; then',
    '  C=$(git commit-tree $TREE -p $PARENT -m "artisan checkpoint")',
    "else",
    '  C=$(git commit-tree $TREE -m "artisan checkpoint")',
    "fi",
    '[ -n "$C" ] || exit 12',
    `git update-ref refs/artisan/checkpoints/${cpId} $C || exit 13`,
    "echo $C",
  ].join("\n");
  const res = await dispatch.exec(runner, script, directory, 30_000);
  if (res.error) return { error: "runner_offline", detail: res.error };
  if (res.exitCode === 14) return { error: "not_git" };
  if (res.exitCode !== 0) return { error: "failed", detail: res.stderr.slice(0, 300) };
  const sha = (res.stdout.trim().split("\n").pop() ?? "").trim();
  if (!/^[0-9a-f]{40,64}$/.test(sha)) return { error: "failed", detail: "no commit sha" };
  return { ref: `refs/artisan/checkpoints/${cpId}`, sha };
}

/**
 * Restore the working tree + index of `directory` to a snapshot ref.
 * `removeNew` also deletes files created since the snapshot (untracked and not ignored — the snapshot's `git add -A`
 * saw every such file, so anything untracked after the restore is newer). Used by collaborator rollback.
 */
export async function restoreSnapshot(dispatch: DispatchClient, runner: string, directory: string, ref: string, opts: { removeNew?: boolean } = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  const script = `git restore --source=${ref} --staged --worktree .${opts.removeNew ? " && git clean -fdq ." : ""}`;
  const res = await dispatch.exec(runner, script, directory, 30_000);
  if (res.error) return { ok: false, error: "runner_offline" };
  if (res.exitCode !== 0) return { ok: false, error: res.stderr.slice(0, 300) || "restore_failed" };
  return { ok: true };
}
