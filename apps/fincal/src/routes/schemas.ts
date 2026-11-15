import { z } from "zod";
import { ACCOUNT_TYPES, ASSET_CLASSES, LIABILITY_KINDS } from "../db/schema.js";

export const anyObject = z.record(z.string(), z.any());
export const anyList = z.array(anyObject);
export const ok = z.object({ ok: z.boolean() });

export const spaceId = z.string().min(1);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
export const month = z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM");
export const money = z.coerce.number().finite();
export const positive = z.coerce.number().finite().positive();
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const accountShape = {
  name: z.string().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().max(80).nullable().optional(),
  openingBalance: money.optional(),
  creditLimit: money.nullable().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  color: color.optional(),
  includeInNetworth: z.boolean().optional(),
};

export const holdingShape = {
  assetClass: z.enum(ASSET_CLASSES),
  name: z.string().min(1).max(120),
  symbol: z.string().max(40).nullable().optional(),
  institution: z.string().max(80).nullable().optional(),
  quantity: money.optional(),
  avgCost: money.optional(),
  currentPrice: money.nullable().optional(),
  principal: money.nullable().optional(),
  currentValue: money.nullable().optional(),
  interestRate: money.nullable().optional(),
  compounding: z.number().int().min(1).max(365).optional(),
  installment: money.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  maturityDate: isoDate.nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  retirement: z.boolean().optional(),
  note: z.string().max(2000).nullable().optional(),
};

export const liabilityShape = {
  name: z.string().min(1).max(120),
  kind: z.enum(LIABILITY_KINDS).optional(),
  principal: money.optional(),
  outstanding: money.optional(),
  interestRate: money.nullable().optional(),
  emi: money.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
};

export const envelopeShape = {
  name: z.string().min(1).max(80),
  color: color.optional(),
  target: money.nullable().optional(),
  monthlyFill: money.nullable().optional(),
};

export const goalShape = {
  name: z.string().min(1).max(80),
  kind: z.enum(["savings", "retirement", "emergency", "other"]).optional(),
  targetAmount: positive,
  targetDate: isoDate.nullable().optional(),
  color: color.optional(),
  note: z.string().max(2000).nullable().optional(),
};

export const categoryShape = {
  name: z.string().min(1).max(60),
  kind: z.enum(["expense", "income"]),
  color: color.optional(),
};
