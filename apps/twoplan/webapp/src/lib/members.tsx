import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMembersQuery } from "./queries";
import type { Member } from "./types";

interface MembersCtx { members: Member[]; me: string | null; byId: (id: string | null | undefined) => Member | undefined; nameOf: (id: string | null | undefined) => string }
const Ctx = createContext<MembersCtx>({ members: [], me: null, byId: () => undefined, nameOf: () => "" });

export function MembersProvider({ children }: { children: ReactNode }) {
  const { data } = useMembersQuery();
  const value = useMemo<MembersCtx>(() => {
    const members = data?.members ?? [];
    const map = new Map(members.map((m) => [m.id, m]));
    return { members, me: data?.me ?? null, byId: (id) => (id ? map.get(id) : undefined), nameOf: (id) => (id ? map.get(id)?.name ?? "Unknown" : "Unassigned") };
  }, [data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useMembers = () => useContext(Ctx);
