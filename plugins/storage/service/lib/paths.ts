import type { FileKind } from "../../shared/types";

const MAX_NAME_BYTES = 255;

/**
 * Normalize a folder/file name. Storage keys and backend paths are built from
 * ids, so names are pure metadata — but they still must not smuggle path
 * separators or traversal segments.
 */
export function sanitizeName(input: string): string {
	const name = input.trim().replace(/\s+/g, " ");
	if (name.length === 0) throw new Error("name is required");
	if (Buffer.byteLength(name, "utf8") > MAX_NAME_BYTES) {
		throw new Error("name is too long (max 255 bytes)");
	}
	if (name === "." || name === "..") {
		throw new Error('"." and ".." are not valid names');
	}
	// eslint-disable-next-line no-control-regex
	if (/[/\\\u0000-\u001f]/.test(name)) {
		throw new Error("name must not contain slashes or control characters");
	}
	return name;
}

/** Normalize a location root path / prefix: no leading/trailing slashes, no traversal. */
export function sanitizePrefix(input: string | undefined | null): string {
	const value = (input ?? "").trim().replace(/^\/+|\/+$/g, "");
	if (value.length === 0) return "";
	if (value.split("/").some((segment) => segment === ".." || segment === ".")) {
		throw new Error("path must not contain '.' or '..' segments");
	}
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f]/.test(value)) {
		throw new Error("path must not contain control characters");
	}
	return value;
}

/** Object key inside a location: `<root_folder_id>/<file_id>` (ids only, renames are free). */
export function objectKey(rootFolderId: string, fileId: string): string {
	return `${rootFolderId}/${fileId}`;
}

/** RFC 6266 Content-Disposition with an ASCII fallback + UTF-8 extended form. */
export function contentDisposition(name: string): string {
	const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const SPREADSHEET_MIMES = new Set([
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/csv",
]);

/** Mirrors the scene's type tabs: Documents, Spreadsheets, PDFs, Images. */
export function mimeKind(mime: string): FileKind {
	const normalized = (mime || "").toLowerCase().split(";")[0].trim();
	if (normalized === "application/pdf") return "pdf";
	if (SPREADSHEET_MIMES.has(normalized)) return "spreadsheet";
	if (normalized.startsWith("image/")) return "image";
	if (normalized.startsWith("text/")) return "document";
	return "document";
}
