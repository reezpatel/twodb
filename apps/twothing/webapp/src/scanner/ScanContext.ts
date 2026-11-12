import { createContext, useContext } from "react";
import type { Place } from "../lib/types";

export type ScanMode = "lookup" | "putaway" | "stockIn" | "stockOut";

export interface PickOptions {
  title: string;
  hint?: string;
}

export interface ScanApi {
  /** Full scan session (lookup / put-away / stock in / out). */
  open(opts?: { mode?: ScanMode; target?: Pick<Place, "id" | "name" | "path"> | null }): void;
  /** Single-shot: resolve with the raw scanned/typed text (null if cancelled). */
  pick(opts: PickOptions): Promise<string | null>;
}

export const ScanContext = createContext<ScanApi | null>(null);

export function useScanner(): ScanApi {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScanner outside <ScanProvider>");
  return ctx;
}
