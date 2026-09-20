import type { SelectedConnection } from "../db";

export const connectionDto = (row: SelectedConnection) => ({
  id: row.id,
  provider: row.provider,
  name: row.name,
  config: row.config ?? {},
  overrides: row.overrides ?? null,
  enabled: row.enabled,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

export const cleanText = (raw: unknown, max: number): string | null => {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text.length > 0 && text.length <= max ? text : null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
