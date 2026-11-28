import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** What the shared TopBar should show — set by whichever page is mounted. */
export interface HeaderConfig {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface HeaderCtx {
  config: HeaderConfig;
  setConfig: (c: HeaderConfig) => void;
}

const Ctx = createContext<HeaderCtx | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>({ title: "TwoPin" });
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHeader(): HeaderCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHeader must be used within HeaderProvider");
  return v;
}

