import { randomBytes } from "node:crypto";

/**
 * Label codes: 6 chars of Crockford base32 minus the ambiguous I, L, O, U
 * → 32^6 ≈ 1.07 billion combinations. Short enough to read off a 12 mm
 * label and type by hand, random enough that collisions are a non-issue for
 * a personal inventory (and we check anyway — see code-pool.ts).
 *
 * Display form is "K7Q-M2X"; QR payloads may be the bare code or a deep link
 * ending in `/c/K7QM2X` (phone camera apps open the app straight to it).
 */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 6;

export function randomCode(): string {
  // 32 divides 256 evenly → `b & 31` is unbiased.
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b & 31];
  return out;
}

const DEEP_LINK = /\/c\/([0-9A-Za-z-]{6,8})\/?(?:[?#].*)?$/;

/**
 * Canonical form of scanned/typed input, or null when it can't be one of our
 * codes (then it's treated as a foreign/manufacturer barcode). Accepts
 * "k7q-m2x", "K7QM2X", "TT:K7QM2X" and deep links ".../c/K7QM2X". Look-alikes
 * are mapped: O→0, I/L→1.
 */
export function normalizeCode(input: string): string | null {
  let raw = input.trim();
  const link = raw.match(DEEP_LINK);
  if (link) raw = link[1];
  else if (/^TT:/i.test(raw)) raw = raw.slice(3);
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) if (!CODE_ALPHABET.includes(ch)) return null;
  return cleaned;
}

export function formatCode(code: string): string {
  return code.length === CODE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}
