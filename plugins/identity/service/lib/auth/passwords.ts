import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;

interface ScryptParams {
	N: number;
	r: number;
	p: number;
}

function scrypt(
	password: string,
	salt: Buffer,
	params: ScryptParams,
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scryptCb(password, salt, 64, params, (err, derived) =>
			err ? reject(err) : resolve(derived),
		);
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derived = await scrypt(password, salt, { N, r: R, p: P });
	return `scrypt:${N}:${R}:${P}:${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [scheme, n, r, p, salt, hash] = stored.split(":");
	if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
	const derived = await scrypt(password, Buffer.from(salt, "base64"), {
		N: Number(n),
		r: Number(r),
		p: Number(p),
	});
	const expected = Buffer.from(hash, "base64");
	return (
		derived.length === expected.length && timingSafeEqual(derived, expected)
	);
}
