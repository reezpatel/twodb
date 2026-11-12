import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearToken,
  completeLoginIfCallback,
  fetchUser,
  installAuthFetch,
  loadToken,
  resolveConfig,
  revokeToken,
  startLogin,
  type TwoDbAuthConfig,
  type TwoDbUser,
} from "./client.js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface TwoDbAuth {
  status: AuthStatus;
  user: TwoDbUser | null;
  error: string | null;
  /** Redirects to TwoDB to sign in. */
  login: () => Promise<void>;
  logout: () => Promise<void>;
  /** Bearer token for non-fetch consumers (WebSocket query params, EventSource, …). */
  token: () => string | null;
}

const Ctx = createContext<TwoDbAuth | null>(null);

/**
 * Wrap the app once. Handles the ?code callback, restores the stored session, and installs an
 * auth-aware fetch so plain `fetch("/apps/<slug>/…")` calls carry the user's token.
 */
export function TwoDbAuthProvider(props: { children: ReactNode; config?: TwoDbAuthConfig }) {
  const cfg = useMemo(() => resolveConfig(props.config), [props.config]);
  const tokenRef = useRef<string | null>(loadToken(cfg));
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<TwoDbUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Installed during render (idempotent) so it is in place before children's first requests.
  installAuthFetch(cfg, () => tokenRef.current);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await completeLoginIfCallback(cfg);
        tokenRef.current = loadToken(cfg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
      const token = tokenRef.current;
      const u = token ? await fetchUser(cfg, token) : null;
      if (cancelled) return;
      if (!u && token) {
        clearToken(cfg);
        tokenRef.current = null;
      }
      setUser(u);
      setStatus(u ? "authenticated" : "unauthenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg]);

  const login = useCallback(() => startLogin(cfg), [cfg]);
  const logout = useCallback(async () => {
    const t = tokenRef.current;
    clearToken(cfg);
    tokenRef.current = null;
    setUser(null);
    setStatus("unauthenticated");
    if (t) await revokeToken(cfg, t);
  }, [cfg]);
  const token = useCallback(() => tokenRef.current, []);

  const value = useMemo<TwoDbAuth>(() => ({ status, user, error, login, logout, token }), [status, user, error, login, logout, token]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useTwoDbAuth(): TwoDbAuth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTwoDbAuth must be used inside <TwoDbAuthProvider>");
  return v;
}
