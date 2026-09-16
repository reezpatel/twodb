export const IDENTIFIER_RE = /^(git:\S+|npm:\S+)$/;

export function isValidIdentifier(identifier: string): boolean {
	return IDENTIFIER_RE.test(identifier);
}

// Display name until a fetch fills in metadata: last path segment for git
// urls, the package name for npm identifiers.
export function nameFromIdentifier(identifier: string): string {
	const rest = identifier.replace(/^(git|npm):/, "");
	const last = rest.split("/").filter(Boolean).pop() ?? rest;
	return last.replace(/\.git$/, "");
}
