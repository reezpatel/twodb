import { randomBytes } from "node:crypto";

/**
 * Generates a per-app registration token at install time. Only its hash is
 * ever persisted (see registry.ts's `beginInstall`/`completeRegistration`) —
 * the plaintext is injected straight into the container's env and never
 * written to TwoDB's own DB. This replaces a single shared secret with one
 * unique, independently revocable token per installed app.
 */
export function generateRegistrationToken(): string {
  return `twodbreg_${randomBytes(24).toString("hex")}`;
}
