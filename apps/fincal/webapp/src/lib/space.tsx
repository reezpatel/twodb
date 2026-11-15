import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useParams } from "react-router";
import { useSettings, useSpaces } from "./queries";
import { makeFormatters, type Formatters } from "./format";

interface SpaceCtx extends Formatters { spaceId: string; spaceName: string; currency: string }
const Ctx = createContext<SpaceCtx | null>(null);

/** Current space from the URL (/s/:spaceId/…) + its currency formatters. Every space is an isolated book. */
export function SpaceProvider({ children }: { children: ReactNode }) {
  const { spaceId = "" } = useParams();
  const { data: spaces = [] } = useSpaces();
  const { data: settings } = useSettings(spaceId);
  const currency = settings?.currency ?? "INR";
  const value = useMemo(() => ({ spaceId, spaceName: spaces.find((s) => s.id === spaceId)?.name ?? "", currency, ...makeFormatters(currency) }), [spaceId, spaces, currency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSpace outside SpaceProvider");
  return v;
}
