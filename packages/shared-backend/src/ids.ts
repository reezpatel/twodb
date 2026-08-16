import { randomBytes } from "node:crypto";

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function base62Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = BASE62_ALPHABET[Number(value % 62n)] + out;
    value /= 62n;
  }
  return out.padStart(22, "0");
}

function uuidV7Bytes(now: number): Uint8Array {
  const bytes = randomBytes(16);
  const ms = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

export function newId(prefix: string): string {
  const id = `${prefix}-${base62Encode(uuidV7Bytes(Date.now()))}`;

  return id;
}
