import type { ConnectorField, ConnectorPreset, EmailConnector } from "../types";
import { gmailConnector } from "./gmail";
import { graphMailConnector } from "./graph-mail";
import { imapSmtpConnector } from "./imap-smtp";

// Declarative registry for combined accounts — presets + form fields drive the
// account UI. Adding an IMAP/CalDAV provider is one preset entry.

export const CONNECTORS: Record<"google" | "microsoft" | "imap", EmailConnector> = {
  google: gmailConnector,
  microsoft: graphMailConnector,
  imap: imapSmtpConnector,
};

export const IMAP_FIELDS: ConnectorField[] = [
  { key: "username", label: "Username", type: "text", placeholder: "defaults to the email address" },
  { key: "password", label: "Password / app password", type: "password", secret: true, required: true },
  { key: "imapHost", label: "IMAP host", type: "text", capability: "mail" },
  { key: "imapPort", label: "IMAP port", type: "number", capability: "mail" },
  { key: "imapSecure", label: "IMAP TLS", type: "boolean", capability: "mail" },
  { key: "smtpHost", label: "SMTP host", type: "text", capability: "mail" },
  { key: "smtpPort", label: "SMTP port", type: "number", capability: "mail" },
  { key: "smtpSecure", label: "SMTP TLS (465)", type: "boolean", capability: "mail" },
  { key: "appendToSent", label: "Save a copy to the server's Sent folder", type: "boolean", capability: "mail" },
  { key: "caldavUrl", label: "CalDAV URL", type: "text", placeholder: "https://caldav.example.com", capability: "calendar" },
];

export const PRESETS: ConnectorPreset[] = [
  {
    id: "google",
    label: "Google",
    kind: "google",
    auth: "oauth",
    capabilities: ["mail", "calendar"],
    description: "Gmail + Google Calendar via the Google APIs (OAuth).",
    defaults: {},
    help: "Requires the Google OAuth client configured under Settings → Accounts.",
  },
  {
    id: "microsoft",
    label: "Microsoft",
    kind: "microsoft",
    auth: "oauth",
    capabilities: ["mail", "calendar"],
    description: "Outlook.com or Microsoft 365 mail + calendar via Microsoft Graph (OAuth).",
    defaults: {},
    help: "Requires the Microsoft (Entra) app configured under Settings → Accounts.",
  },
  {
    id: "icloud",
    label: "iCloud",
    kind: "imap",
    auth: "password",
    capabilities: ["mail", "calendar"],
    description: "iCloud Mail (IMAP/SMTP) + iCloud Calendar (CalDAV).",
    defaults: {
      imapHost: "imap.mail.me.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.mail.me.com",
      smtpPort: 587,
      smtpSecure: false,
      appendToSent: true,
      caldavUrl: "https://caldav.icloud.com",
    },
    help: "Use an app-specific password: appleid.apple.com → Sign-In and Security → App-Specific Passwords.",
  },
  {
    id: "fastmail",
    label: "Fastmail",
    kind: "imap",
    auth: "password",
    capabilities: ["mail", "calendar"],
    description: "Fastmail via IMAP/SMTP + CalDAV.",
    defaults: {
      imapHost: "imap.fastmail.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.fastmail.com",
      smtpPort: 465,
      smtpSecure: true,
      appendToSent: true,
      caldavUrl: "https://caldav.fastmail.com/dav/calendars",
    },
    help: "Create an app password with Mail and Calendars access: Settings → Privacy & Security → App passwords.",
  },
  {
    id: "yahoo",
    label: "Yahoo",
    kind: "imap",
    auth: "password",
    capabilities: ["mail", "calendar"],
    description: "Yahoo Mail (IMAP/SMTP) + Yahoo Calendar (CalDAV).",
    defaults: {
      imapHost: "imap.mail.yahoo.com",
      imapPort: 993,
      imapSecure: true,
      smtpHost: "smtp.mail.yahoo.com",
      smtpPort: 465,
      smtpSecure: true,
      appendToSent: false,
      caldavUrl: "https://caldav.calendar.yahoo.com",
    },
    help: "Yahoo requires an app password: Account security → Generate app password. Your normal password will not work.",
  },
  {
    id: "nextcloud",
    label: "Nextcloud",
    kind: "imap",
    auth: "password",
    capabilities: ["calendar", "mail"],
    description: "Nextcloud calendars (CalDAV), optionally with your mail server.",
    defaults: { imapPort: 993, imapSecure: true, smtpPort: 465, smtpSecure: true, appendToSent: true, caldavUrl: "https://cloud.example.com/remote.php/dav" },
    help: "Use an app password: Nextcloud → Settings → Security → Devices & sessions.",
  },
  {
    id: "custom",
    label: "IMAP / SMTP / CalDAV",
    kind: "imap",
    auth: "password",
    capabilities: ["mail", "calendar"],
    description: "Any provider that speaks IMAP + SMTP and/or CalDAV.",
    defaults: { imapPort: 993, imapSecure: true, smtpPort: 465, smtpSecure: true, appendToSent: true },
  },
];

export function connectorFor(kind: string): EmailConnector {
  const c = CONNECTORS[kind as keyof typeof CONNECTORS];
  if (!c) throw new Error(`unknown email connector "${kind}"`);
  return c;
}
