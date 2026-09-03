import path from "path";

export const resolvePath = (cwd: string, filePath: string): string => {
  if (!filePath || typeof filePath !== "string") {
    throw new TypeError("A non-empty path is required");
  }

  return path.resolve(cwd, filePath);
};
