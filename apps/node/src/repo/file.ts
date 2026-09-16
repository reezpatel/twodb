import {
	access,
	lstat,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	unlink,
	writeFile as writeFileFs,
} from "node:fs/promises";
import path from "node:path";
import { fuzzyScore, resolvePath, walkDirs, walkFiles } from "../utils";
import { NodeError } from "../types";
import { runCommand } from "./command";

export type DirectoryEntry = {
	name: string;
	path: string;
	isDirectory: boolean;
	isFile: boolean;
	isSymbolicLink: boolean;
};

export const getFile = async (
	cwd: string,
	filePath: string,
	encoding?: "utf8" | "base64",
): Promise<string> => {
	const target = resolvePath(cwd, filePath);
	if (encoding === "base64") {
		return readFile(target).then((buffer) => buffer.toString("base64"));
	}
	return readFile(target, "utf8");
};

export const writeFile = async (
	cwd: string,
	filePath: string,
	content: string,
	encoding?: "utf8" | "base64",
): Promise<void> => {
	const target = resolvePath(cwd, filePath);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFileFs(target, content, {
		encoding: encoding ?? "utf8",
	});
};

export const mkDir = async (cwd: string, dirPath: string): Promise<void> => {
	await mkdir(resolvePath(cwd, dirPath), { recursive: true });
};

export const movePath = async (
	cwd: string,
	fromPath: string,
	toPath: string,
): Promise<void> => {
	const from = resolvePath(cwd, fromPath);
	const to = resolvePath(cwd, toPath);
	await mkdir(path.dirname(to), { recursive: true });
	await rename(from, to);
};

export const deletePath = async (
	cwd: string,
	targetPath: string,
	recursive = false,
): Promise<void> => {
	const target = resolvePath(cwd, targetPath);
	const stats = await lstat(target);
	if (stats.isDirectory() && !recursive) {
		throw new NodeError("BAD_PAYLOAD", "directory requires recursive=true");
	}
	await rm(target, { recursive });
};

export const listDir = async (
	cwd: string,
	directoryPath = ".",
): Promise<DirectoryEntry[]> => {
	const directory = resolvePath(cwd, directoryPath);
	const entries = await readdir(directory, { withFileTypes: true });

	return entries.map((entry) => ({
		name: entry.name,
		path: path.join(directory, entry.name),
		isDirectory: entry.isDirectory(),
		isFile: entry.isFile(),
		isSymbolicLink: entry.isSymbolicLink(),
	}));
};

export const hasFile = async (
	cwd: string,
	filePath: string,
): Promise<boolean> => {
	try {
		await access(resolvePath(cwd, filePath));
		return true;
	} catch {
		return false;
	}
};

/**
 * Exact search/replace edit. Fails when old_string is absent (NO_MATCH) or
 * ambiguous (AMBIGUOUS_MATCH) so the caller retries with more context.
 */
export const editFile = async (
	cwd: string,
	filePath: string,
	oldString: string,
	newString: string,
): Promise<{ path: string; replacements: number }> => {
	if (!oldString) {
		throw new NodeError("BAD_PAYLOAD", "old_string must not be empty");
	}
	const target = resolvePath(cwd, filePath);
	const content = await readFile(target, "utf8");
	const occurrences = content.split(oldString).length - 1;
	if (occurrences === 0) {
		throw new NodeError("NO_MATCH", "old_string not found in file");
	}
	if (occurrences > 1) {
		throw new NodeError(
			"AMBIGUOUS_MATCH",
			`old_string matches ${occurrences} times — include more surrounding context`,
		);
	}
	await writeFileFs(target, content.replace(oldString, newString), "utf8");
	return { path: filePath, replacements: 1 };
};

export const removeFile = async (
	cwd: string,
	filePath: string,
): Promise<void> => {
	const target = resolvePath(cwd, filePath);
	if ((await lstat(target)).isDirectory())
		throw new NodeError("BAD_PAYLOAD", "removeFile only accepts files");
	await unlink(target);
};

export type FindFileOptions = {
	query: string;
	directory?: string;
	maxResults?: number;
};

export type FindFileMatch = {
	name: string;
	path: string;
	relativePath: string;
	via: "fzf" | "native";
};

let fzfAvailable: boolean | undefined;

const hasFzf = async (): Promise<boolean> => {
	if (fzfAvailable !== undefined) return fzfAvailable;
	try {
		const result = await runCommand("fzf", {
			args: ["--version"],
			cwd: "/",
			timeoutMs: 5_000,
		});
		fzfAvailable = result.exitCode === 0;
	} catch {
		fzfAvailable = false;
	}
	return fzfAvailable;
};

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

const toMatch =
	(root: string, via: "fzf" | "native") =>
	(relativePath: string): FindFileMatch => ({
		name: path.basename(relativePath),
		path: path.join(root, relativePath),
		relativePath,
		via,
	});

const rankMatches = async (
	root: string,
	relatives: string[],
	query: string,
	maxResults: number,
): Promise<FindFileMatch[]> => {
	if (await hasFzf()) {
		const result = await runCommand("fzf", {
			args: ["--filter", query],
			cwd: root,
			input: relatives.join("\n"),
			timeoutMs: 15_000,
		});
		if (result.exitCode === 0 || result.exitCode === 1) {
			return result.stdout
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.slice(0, maxResults)
				.map(toMatch(root, "fzf"));
		}
	}

	return relatives
		.map((relativePath) => ({
			relativePath,
			score: fuzzyScore(relativePath, query),
		}))
		.filter((candidate) => candidate.score >= 0)
		.sort(
			(a, b) =>
				b.score - a.score || a.relativePath.length - b.relativePath.length,
		)
		.slice(0, maxResults)
		.map((candidate) => toMatch(root, "native")(candidate.relativePath));
};

export const findFile = async (
	cwd: string,
	options: FindFileOptions,
): Promise<FindFileMatch[]> => {
	const query = options.query?.trim();
	if (!query) {
		throw new NodeError("BAD_PAYLOAD", "find_file requires a query");
	}
	const root = resolvePath(cwd, options.directory ?? ".");
	const maxResults = clamp(options.maxResults ?? 50, 1, 500);
	const files = await walkFiles(root);
	const relatives = files.map((file) => path.relative(root, file));
	return rankMatches(root, relatives, query, maxResults);
};

/**
 * Path-style browse: "/" lists the root's immediate directories,
 * "/mnt/" lists mnt's children, "/mnt/nv" prefix-matches within mnt.
 * Shallow on purpose — no recursion while navigating.
 */
const browseDirs = async (
	root: string,
	query: string,
	maxResults: number,
): Promise<FindFileMatch[]> => {
	const normalized = query.replace(/^\/+/, "");
	const listAll = normalized.length === 0 || normalized.endsWith("/");
	const slash = normalized.lastIndexOf("/");
	const parent = listAll
		? normalized.replace(/\/+$/, "")
		: slash === -1
			? ""
			: normalized.slice(0, slash);
	const prefix = listAll ? "" : normalized.slice(slash + 1).toLowerCase();

	let entries: DirectoryEntry[];
	try {
		entries = await listDir(root, parent || ".");
	} catch {
		return [];
	}

	return entries
		.filter(
			(entry) =>
				entry.isDirectory &&
				!entry.name.startsWith(".") &&
				entry.name.toLowerCase().startsWith(prefix),
		)
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, maxResults)
		.map((entry) => {
			const relativePath = parent ? `${parent}/${entry.name}` : entry.name;
			return toMatch(root, "native")(relativePath);
		});
};

export const findDir = async (
	cwd: string,
	options: FindFileOptions,
): Promise<FindFileMatch[]> => {
	const query = options.query?.trim();
	if (!query) {
		throw new NodeError("BAD_PAYLOAD", "find_dir requires a query");
	}
	const root = resolvePath(cwd, options.directory ?? ".");
	const maxResults = clamp(options.maxResults ?? 10, 1, 500);
	if (query.startsWith("/")) {
		return browseDirs(root, query, maxResults);
	}
	const needle = query.toLowerCase();
	const directories = await walkDirs(root);
	return directories
		.map((directory) => path.relative(root, directory))
		.filter(Boolean)
		.filter((relativePath) => relativePath.toLowerCase().includes(needle))
		.sort((a, b) => a.length - b.length || a.localeCompare(b))
		.slice(0, maxResults)
		.map(toMatch(root, "native"));
};
