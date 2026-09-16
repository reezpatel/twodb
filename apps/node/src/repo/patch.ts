import { runCommand } from "./command";
import { NodeError } from "../types";

const PATCH_TIMEOUT_MS = 15_000;

export type ApplyPatchResult = {
	applied: boolean;
	via: "git" | "patch";
	output: string;
};

/**
 * Apply a unified diff inside cwd. Prefers `git apply` (checks first, so a
 * bad diff never half-applies); falls back to `patch -p1` outside git repos.
 */
export const applyPatch = async (
	cwd: string,
	diff: string,
): Promise<ApplyPatchResult> => {
	if (!diff.trim()) {
		throw new NodeError("BAD_PAYLOAD", "patch must not be empty");
	}

	const check = await runCommand("git", {
		args: ["apply", "--check", "--verbose"],
		cwd,
		input: diff,
		timeoutMs: PATCH_TIMEOUT_MS,
	});
	const notARepo = /not a git repository/i.test(check.stderr);
	if (check.exitCode === 0) {
		const applied = await runCommand("git", {
			args: ["apply", "--verbose"],
			cwd,
			input: diff,
			timeoutMs: PATCH_TIMEOUT_MS,
		});
		if (applied.exitCode !== 0) {
			throw new NodeError(
				"PATCH_FAILED",
				applied.stderr.trim() || "git apply failed",
			);
		}
		return { applied: true, via: "git", output: applied.stderr.trim() };
	}
	if (!notARepo) {
		throw new NodeError(
			"PATCH_REJECTED",
			check.stderr.trim() || "git apply --check failed",
		);
	}

	const dryRun = await runCommand("patch", {
		args: ["-p1", "--dry-run"],
		cwd,
		input: diff,
		timeoutMs: PATCH_TIMEOUT_MS,
	});
	if (dryRun.exitCode !== 0) {
		throw new NodeError(
			"PATCH_REJECTED",
			dryRun.stderr.trim() || dryRun.stdout.trim() || "patch --dry-run failed",
		);
	}
	const applied = await runCommand("patch", {
		args: ["-p1"],
		cwd,
		input: diff,
		timeoutMs: PATCH_TIMEOUT_MS,
	});
	if (applied.exitCode !== 0) {
		throw new NodeError(
			"PATCH_FAILED",
			applied.stderr.trim() || applied.stdout.trim() || "patch failed",
		);
	}
	return { applied: true, via: "patch", output: applied.stdout.trim() };
};
