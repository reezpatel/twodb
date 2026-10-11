import type { Selectable } from "kysely";
import type { EmailAccountTable } from "../../plugins/db";

export type EmailAccountRow = Selectable<EmailAccountTable>;

/** One message as fetched from a provider — always raw RFC822 so parsing has a single path. */
export interface RawIncoming {
  providerMessageId: string;
  providerThreadId?: string | null;
  raw: Buffer;
  /** Came from the provider's Sent mailbox / SENT label — imported as outbound "sent". */
  isSent: boolean;
  /** Provider read flag, used once at import. */
  isRead: boolean;
  internalDate?: Date | null;
}

export interface SyncContext {
  account: EmailAccountRow;
  credentials: Record<string, unknown>;
  /** Persist refreshed credentials (OAuth access tokens). */
  saveCredentials: (next: Record<string, unknown>) => Promise<void>;
  /** Provider ids we haven't stored yet — lets connectors skip fetching bodies we already have. */
  filterNew: (providerMessageIds: string[]) => Promise<string[]>;
  ingest: (items: RawIncoming[]) => Promise<void>;
}

export interface BackfillStep {
  /** null = backfill finished. */
  cursor: Record<string, unknown> | null;
  done: number;
  total: number | null;
}

export interface SendEnvelope {
  from: string;
  to: string[];
}

export interface SendResult {
  providerMessageId?: string | null;
  providerThreadId?: string | null;
}

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean";
  placeholder?: string;
  /** Sealed into credentials instead of config. */
  secret?: boolean;
  required?: boolean;
}

export interface ConnectorPreset {
  id: string;
  label: string;
  kind: "gmail" | "imap_smtp";
  description: string;
  defaults: Record<string, unknown>;
  /** Shown above the form — e.g. "create an app password". */
  help?: string;
}

export interface EmailConnector {
  kind: "gmail" | "imap_smtp";
  /** Throws on bad credentials / unreachable host. */
  verify(account: Pick<EmailAccountRow, "address" | "config">, credentials: Record<string, unknown>, saveCredentials?: SyncContext["saveCredentials"]): Promise<void>;
  /** Pull new mail since syncCursor; returns the next head cursor (plus an initial backfill cursor on first run). */
  pullHead(ctx: SyncContext): Promise<{ cursor: Record<string, unknown>; backfillCursor?: Record<string, unknown> | null; total?: number | null }>;
  /** One bounded backfill batch, newest → oldest. */
  pullBackfill(ctx: SyncContext): Promise<BackfillStep>;
  send(ctx: Omit<SyncContext, "ingest" | "filterNew">, mime: Buffer, envelope: SendEnvelope, hint: { providerThreadId?: string | null }): Promise<SendResult>;
}

export class EmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailAuthError";
  }
}
