import { createHash, randomBytes } from "node:crypto";

export const hashSecret = (secret: string): string =>
	createHash("sha256").update(secret).digest("hex");

/**
 * Creates a node secret. The plaintext is shown to the user exactly once —
 * only its sha256 hash is persisted.
 */
export const generateNodeSecret = (): {
	plaintext: string;
	hash: string;
} => {
	const plaintext = `twn_${randomBytes(24).toString("base64url")}`;
	return { plaintext, hash: hashSecret(plaintext) };
};
