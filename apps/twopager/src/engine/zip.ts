import { unzipSync } from "fflate";
import { HttpError, tooLarge } from "../lib/http.js";
import { normalizeFilePath } from "./paths.js";

export interface ZipLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface Entry {
  path: string;
  data: Buffer;
  /** Overrides the type guessed from the extension. */
  contentType?: string;
}

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/;

/** Extracts a zip into normalized entries, enforcing limits before and after inflating (zip-bomb safe). */
export function extractZip(buf: Buffer, limits: ZipLimits): Entry[] {
  let count = 0;
  let declared = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), {
      filter: (f) => {
        if (f.name.endsWith("/") || JUNK.test(f.name)) return false;
        if (++count > limits.maxFiles) throw tooLarge(`zip contains more than ${limits.maxFiles} files`);
        if (f.originalSize > limits.maxFileBytes) throw tooLarge(`"${f.name}" exceeds the ${Math.floor(limits.maxFileBytes / 1048576)} MB file limit`);
        declared += f.originalSize;
        if (declared > limits.maxTotalBytes) throw tooLarge(`zip expands beyond ${Math.floor(limits.maxTotalBytes / 1048576)} MB`);
        return true;
      },
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "bad_zip", "could not read the zip archive");
  }

  let entries: Entry[] = [];
  let total = 0;
  for (const [name, data] of Object.entries(files)) {
    if (data.length > limits.maxFileBytes) throw tooLarge(`"${name}" exceeds the file size limit`);
    total += data.length;
    if (total > limits.maxTotalBytes) throw tooLarge("zip expands beyond the size limit");
    entries.push({ path: normalizeFilePath(name), data: Buffer.from(data) });
  }
  if (!entries.length) throw new HttpError(400, "empty_zip", "the zip contains no files");

  // `zip -r site.zip dist` style archives wrap everything in one folder: strip it.
  const tops = new Set(entries.map((e) => e.path.split("/")[0]));
  if (tops.size === 1 && entries.every((e) => e.path.includes("/"))) {
    const prefix = `${[...tops][0]}/`;
    entries = entries.map((e) => ({ ...e, path: e.path.slice(prefix.length) }));
  }
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.path)) throw new HttpError(400, "duplicate_path", `duplicate path in zip: ${e.path}`);
    seen.add(e.path);
  }
  return entries;
}
