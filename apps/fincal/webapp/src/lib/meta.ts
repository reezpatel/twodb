import { Banknote, CreditCard, Landmark, Smartphone, Wallet, CircleDollarSign, type LucideIcon } from "lucide-react";

export const ACCOUNT_TYPES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "bank", label: "Bank account", icon: Landmark },
  { id: "credit_card", label: "Credit card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "other", label: "Other", icon: CircleDollarSign },
];
export const accountMeta = (t: string) => ACCOUNT_TYPES.find((a) => a.id === t) ?? ACCOUNT_TYPES[5];

export const PAY_METHODS = ["upi", "card", "cash", "netbanking", "cheque", "auto_debit", "other"];

export const ASSET_CLASSES: { id: string; label: string; group: string; kind: "priced" | "fd" | "rd" | "manual"; unit?: string }[] = [
  { id: "stock", label: "Stock", group: "Equity", kind: "priced", unit: "shares" },
  { id: "etf", label: "ETF", group: "Equity", kind: "priced", unit: "units" },
  { id: "mutual_fund", label: "Mutual fund", group: "Mutual funds", kind: "priced", unit: "units" },
  { id: "gold", label: "Gold", group: "Metals", kind: "priced", unit: "g" },
  { id: "silver", label: "Silver", group: "Metals", kind: "priced", unit: "g" },
  { id: "platinum", label: "Platinum", group: "Metals", kind: "priced", unit: "g" },
  { id: "fd", label: "Fixed deposit", group: "Fixed income", kind: "fd" },
  { id: "rd", label: "Recurring deposit", group: "Fixed income", kind: "rd" },
  { id: "bond", label: "Bond", group: "Fixed income", kind: "priced", unit: "units" },
  { id: "ppf", label: "PPF", group: "Retirement funds", kind: "manual" },
  { id: "epf", label: "EPF", group: "Retirement funds", kind: "manual" },
  { id: "nps", label: "NPS", group: "Retirement funds", kind: "manual" },
  { id: "crypto", label: "Crypto", group: "Crypto", kind: "priced", unit: "coins" },
  { id: "real_estate", label: "Real estate", group: "Real estate", kind: "manual" },
  { id: "other", label: "Other asset", group: "Other", kind: "manual" },
];
export const assetMeta = (id: string) => ASSET_CLASSES.find((a) => a.id === id) ?? ASSET_CLASSES[ASSET_CLASSES.length - 1];

export const LIABILITY_KINDS = ["home_loan", "car_loan", "personal_loan", "education_loan", "credit_card", "other"];

export const PALETTE = ["#6366f1", "#22c55e", "#f97316", "#0ea5e9", "#eab308", "#ec4899", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b", "#a855f7", "#f43f5e"];
export const GROUP_COLORS: Record<string, string> = {
  "Cash & bank": "#0ea5e9", Equity: "#6366f1", "Mutual funds": "#8b5cf6", Metals: "#eab308", "Fixed income": "#22c55e",
  "Retirement funds": "#14b8a6", Crypto: "#f97316", "Real estate": "#ec4899", Other: "#9ca3af",
};
