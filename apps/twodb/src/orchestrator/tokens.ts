import { randomBytes } from "node:crypto";

/** Opaque app token: `twodbt_<48 hex>`. Only its sha256 is ever stored. */
export function generateAppToken(): string {
  return `twodbt_${randomBytes(24).toString("hex")}`;
}

/** @deprecated use generateAppToken */
export const generateRegistrationToken = generateAppToken;
