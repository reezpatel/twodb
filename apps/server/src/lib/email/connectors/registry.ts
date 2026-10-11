import type { ConnectorField, ConnectorPreset, EmailConnector } from "../types";
import { gmailConnector } from "./gmail";
import { imapSmtpConnector } from "./imap-smtp";

// Declarative connector registry — presets + form fields drive the account
// UI. Adding an IMAP provider is one preset entry.

export const CONNECTORS: Record<"gmail" | "imap_smtp", EmailConnector> = {
  gmail: gmailConnector,
  imap_smtp: imapSmtpConnector,
};

export const IMAP_FIELDS: ConnectorField[] = [
  { key: "username", label: "Username", type: "text", placeholder: "defaults to the email address" },
  { key: "password", label: "Password / app password", type: "password", secret: true, required: true },
  { key: "imapHost", label: "IMAP host", type: "text", required: true },
  { key: "imapPort", label: "IMAP port", type: "number" },
  { key: "imapSecure", label: "IMAP TLS", type: "boolean" },
  { key: "smtpHost", label: "SMTP host", type: "text", required: true },
  { key: "smtpPort", label: "SMTP port", type: "number" },
  { key: "smtpSecure", label: "SMTP TLS (465)", type: "boolean" },
  { key: "appendToSent", label: "Save a copy to the server's Sent folder", type: "boolean" },
];

export const PRESETS: ConnectorPreset[] = [
  {
    id: "gmail",
    label: "Gmail",
    kind: "gmail",
    description: "Google account via the Gmail API (OAuth).",
    defaults: {},
    help: "Requires the Google OAuth client configured under Settings → Email.",
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    kind: "imap_smtp",
    description: "Yahoo via IMAP + SMTP with an app password.",
    defaults: { imapHost: "imap.mail.yahoo.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpSecure: true, appendToSent: false },
    help: "Yahoo requires an app password: Account security → Generate app password. Your normal password will not work.",
  },
  {
    id: "custom",
    label: "IMAP / SMTP",
    kind: "imap_smtp",
    description: "Any provider that speaks IMAP + SMTP.",
    defaults: { imapPort: 993, imapSecure: true, smtpPort: 465, smtpSecure: true, appendToSent: true },
  },
];

export function connectorFor(kind: string): EmailConnector {
  const c = CONNECTORS[kind as keyof typeof CONNECTORS];
  if (!c) throw new Error(`unknown email connector "${kind}"`);
  return c;
}
