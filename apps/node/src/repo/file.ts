import { resolvePath } from "../utils";
import {
  access,
  lstat,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile as writeFileFs,
} from "node:fs/promises";
import path from "node:path";

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
): Promise<string> => {
  return readFile(resolvePath(cwd, filePath), "utf8");
};

export const writeFile = async (
  cwd: string,
  filePath: string,
  content: string,
): Promise<void> => {
  const target = resolvePath(cwd, filePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFileFs(target, content, "utf8");
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

export const removeFile = async (
  cwd: string,
  filePath: string,
): Promise<void> => {
  const target = resolvePath(cwd, filePath);
  if ((await lstat(target)).isDirectory())
    throw new TypeError("removeFile only accepts files");
  await unlink(target);
};
