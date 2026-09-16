import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

export interface CalendarCredentials {
	access_token?: string;
	refresh_token?: string;
	expires_at?: number;
	/** CalDAV basic auth. */
	username?: string;
	password?: string;
	[key: string]: unknown;
}

/**
 * AES-256-GCM box for calendar account credentials. The configured key
 * material is hashed to 32 bytes, so any string works as
 * TWODB_CALENDAR_ENCRYPTION_KEY.
 */
export class CredentialBox {
	private readonly key: Buffer;

	constructor(keyMaterial: string) {
		this.key = createHash("sha256").update(keyMaterial).digest();
	}

	encrypt(payload: CalendarCredentials): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv, {
			authTagLength: 16,
		});
		const data = Buffer.concat([
			cipher.update(JSON.stringify(payload), "utf8"),
			cipher.final(),
		]);
		const tag = cipher.getAuthTag();
		return [
			"v1",
			iv.toString("base64"),
			tag.toString("base64"),
			data.toString("base64"),
		].join(".");
	}

	decrypt(blob: string): CalendarCredentials | null {
		try {
			const [version, iv, tag, data] = blob.split(".");
			if (version !== "v1" || !iv || !tag || !data) return null;
			const decipher = createDecipheriv(
				"aes-256-gcm",
				this.key,
				Buffer.from(iv, "base64"),
				{ authTagLength: 16 },
			);
			decipher.setAuthTag(Buffer.from(tag, "base64"));
			const plain = Buffer.concat([
				decipher.update(Buffer.from(data, "base64")),
				decipher.final(),
			]);
			return JSON.parse(plain.toString("utf8")) as CalendarCredentials;
		} catch {
			return null;
		}
	}
}
