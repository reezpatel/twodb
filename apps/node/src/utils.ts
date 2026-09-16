import os from "node:os";
import path from "node:path";
import { readdir } from "node:fs/promises";
import type { HeartbeatDetails, NodeMeta } from "./types";
import { NodeError } from "./types";

export const resolvePath = (root: string, filePath: string): string => {
	if (!filePath || typeof filePath !== "string") {
		throw new NodeError("BAD_PAYLOAD", "a non-empty path is required");
	}
	const base = path.resolve(root);
	const resolved = path.resolve(base, filePath);
	if (resolved !== base && !resolved.startsWith(base + path.sep)) {
		throw new NodeError("PATH_ESCAPE", `path escapes root: ${filePath}`);
	}
	return resolved;
};

export const nodeMeta = (): NodeMeta => ({
	hostname: os.hostname(),
	platform: os.platform(),
	arch: os.arch(),
	nodeVersion: process.version,
	pid: process.pid,
});

export const heartbeatDetails = (activeJobs: number): HeartbeatDetails => ({
	...nodeMeta(),
	cpus: os.cpus().length,
	loadavg: os.loadavg(),
	memoryTotal: os.totalmem(),
	memoryFree: os.freemem(),
	systemUptimeSec: Math.floor(os.uptime()),
	processUptimeSec: Math.floor(process.uptime()),
	activeJobs,
	status: activeJobs > 0 ? "busy" : "idle",
});

const IGNORED_DIRS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	".next",
	".turbo",
	"coverage",
]);

export type WalkOptions = {
	limit?: number;
};

export const walkFiles = async (
	root: string,
	options: WalkOptions = {},
): Promise<string[]> => {
	const limit = options.limit ?? 20_000;
	const results: string[] = [];
	const stack: string[] = [root];

	while (stack.length > 0 && results.length < limit) {
		const directory = stack.pop()!;
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
					stack.push(full);
				}
			} else if (entry.isFile()) {
				results.push(full);
				if (results.length >= limit) break;
			}
		}
	}
	return results;
};

export const walkDirs = async (
	root: string,
	options: WalkOptions = {},
): Promise<string[]> => {
	const limit = options.limit ?? 20_000;
	const results: string[] = [];
	const stack: string[] = [root];

	while (stack.length > 0 && results.length < limit) {
		const directory = stack.pop()!;
		let entries;
		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
			const full = path.join(directory, entry.name);
			results.push(full);
			stack.push(full);
			if (results.length >= limit) break;
		}
	}
	return results;
};

export const fuzzyScore = (candidate: string, query: string): number => {
	const text = candidate.toLowerCase();
	const needle = query.toLowerCase();
	let score = 0;
	let ti = 0;
	let lastMatch = -2;

	for (let qi = 0; qi < needle.length; qi++) {
		const found = text.indexOf(needle[qi], ti);
		if (found === -1) return -1;
		if (found === lastMatch + 1) score += 10;
		else score += 1;
		const prev = found > 0 ? text[found - 1] : "/";
		if (prev === "/" || prev === "-" || prev === "_" || prev === ".")
			score += 5;
		score -= (found - ti) * 0.1;
		lastMatch = found;
		ti = found + 1;
	}
	return score - candidate.length * 0.01;
};
