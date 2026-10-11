import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { api } from "@/lib/api";
import {
  emailKeys,
  uploadForm,
  useEmailAccounts,
  useEmailMeta,
  useEmailSocket,
  type AccountCapability,
  type EmailAccount,
  type EmailRole,
} from "../../email/email-api";

export interface AccountMember {
  userId: string;
  role: EmailRole;
  name: string;
  email: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
}

export interface SenderRule {
  id: string;
  accountId: string | null;
  matchType: "address" | "domain";
  value: string;
  createdAt: string;
}

export type OAuthProvider = "google" | "microsoft";

export function startOAuth(provider: OAuthProvider, capabilities: AccountCapability[], accountId?: string | null) {
  return api<{ authUrl: string }>(`/api/email/accounts/${provider === "google" ? "gmail" : "microsoft"}/oauth/start`, {
    method: "POST",
    body: JSON.stringify({ accountId: accountId ?? null, capabilities }),
  });
}

export function useAccountsSettings() {
  useEmailSocket();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const meta = useEmailMeta();
  const accounts = useEmailAccounts();
  const senderRules = useQuery({ queryKey: ["email", "sender-rules"], queryFn: () => api<SenderRule[]>("/api/email/sender-rules") });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: emailKeys.accounts });
    void queryClient.invalidateQueries({ queryKey: emailKeys.meta });
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const oauthNotice = params.get("oauth")
    ? { ok: params.get("oauth") === "connected", provider: params.get("provider") === "microsoft" ? "Microsoft" : "Google", reason: params.get("reason") ?? "" }
    : null;
  const dismissNotice = () => setParams({}, { replace: true });

  const oauth = useMutation({
    mutationFn: ({ provider, capabilities, accountId }: { provider: OAuthProvider; capabilities: AccountCapability[]; accountId?: string | null }) =>
      startOAuth(provider, capabilities, accountId),
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl;
    },
  });

  const setCapabilities = useMutation({
    mutationFn: ({ account, capabilities }: { account: EmailAccount; capabilities: AccountCapability[] }) =>
      api<{ needsAuth: boolean }>(`/api/email/accounts/${account.id}/capabilities`, { method: "POST", body: JSON.stringify({ capabilities }) }),
    onSuccess: (res, { account, capabilities }) => {
      if (res.needsAuth && account.kind !== "imap") oauth.mutate({ provider: account.kind, capabilities, accountId: account.id });
      else invalidate();
    },
  });

  const syncNow = useMutation({
    mutationFn: async (account: EmailAccount) => {
      if (account.capabilities.includes("mail")) await api(`/api/email/accounts/${account.id}/sync`, { method: "POST", body: "{}" });
      if (account.capabilities.includes("calendar")) await api(`/api/calendar/accounts/${account.id}/sync`, { method: "POST", body: "{}" });
    },
    onSuccess: invalidate,
  });
  const test = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; error?: string }>(`/api/email/accounts/${id}/test`, { method: "POST", body: "{}" }),
  });
  const backfill = useMutation({
    mutationFn: ({ id, op }: { id: string; op: "pause" | "resume" }) => api(`/api/email/accounts/${id}/backfill/${op}`, { method: "POST", body: "{}" }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api(`/api/email/accounts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, purgeMail }: { id: string; purgeMail: boolean }) => api(`/api/email/accounts/${id}?purgeMail=${purgeMail}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: emailKeys.all });
    },
  });
  const importEml = useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      return uploadForm<{ inserted: number }>(`/api/email/accounts/${id}/import`, form);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: emailKeys.all }),
  });
  const removeRule = useMutation({
    mutationFn: (id: string) => api(`/api/email/sender-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["email", "sender-rules"] }),
  });

  return {
    meta,
    accounts,
    senderRules,
    oauthNotice,
    dismissNotice,
    oauth,
    setCapabilities,
    syncNow,
    test,
    backfill,
    update,
    remove,
    importEml,
    removeRule,
    invalidate,
  };
}

export function useOAuthClientForm(provider: OAuthProvider) {
  const queryClient = useQueryClient();
  const path = provider === "google" ? "/api/email/admin/gmail-oauth" : "/api/email/admin/microsoft-oauth";
  const save = useMutation({
    mutationFn: (value: { clientId: string; clientSecret: string; tenant?: string }) => api(path, { method: "PUT", body: JSON.stringify(value) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: emailKeys.meta }),
  });
  const clear = useMutation({
    mutationFn: () => api(path, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: emailKeys.meta }),
  });
  return { save, clear };
}

export function useAddPasswordAccount(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      preset: string;
      address: string;
      displayName: string;
      password: string;
      capabilities: AccountCapability[];
      config: Record<string, unknown>;
    }) => api<{ id: string }>("/api/email/accounts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.accounts });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onDone();
    },
  });
}

export function useAccountSharing(account: EmailAccount | null) {
  const queryClient = useQueryClient();
  const id = account?.id ?? "";
  const members = useQuery({
    queryKey: ["email", "members", id],
    queryFn: () => api<AccountMember[]>(`/api/email/accounts/${id}/members`),
    enabled: !!account,
  });
  const orgUsers = useQuery({ queryKey: ["email", "org-users"], queryFn: () => api<OrgUser[]>("/api/email/org-users"), enabled: !!account });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["email", "members", id] });
    void queryClient.invalidateQueries({ queryKey: emailKeys.accounts });
  };
  const setVisibility = useMutation({
    mutationFn: (visibility: "private" | "shared") => api(`/api/email/accounts/${id}/sharing`, { method: "PATCH", body: JSON.stringify({ visibility }) }),
    onSuccess: refresh,
  });
  const upsert = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "member" | "viewer" }) =>
      api(`/api/email/accounts/${id}/members`, { method: "POST", body: JSON.stringify({ userId, role }) }),
    onSuccess: refresh,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api(`/api/email/accounts/${id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { members, orgUsers, setVisibility, upsert, removeMember };
}
