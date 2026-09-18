export const IDENTIFIER_RE = /^(git:\S+|npm:\S+|local:\S+)$/;

export function isValidIdentifier(identifier: string): boolean {
  return IDENTIFIER_RE.test(identifier);
}
