import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { ApiClient } from "@twodb/shared-frontend";

export type AdminSessionState = {
  authenticated: boolean;
  bootstrapRequired: boolean;
};

export type Passkey = {
  id: string;
  name: string;
  transports: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type InstanceInfo = {
  id: string;
  name: string;
  logo: string | null;
  created_at: string;
};

export type PluginManifest = {
  identifier: string;
  name?: string;
  description?: string;
  logo?: string;
  version?: string;
  provides?: string[];
  requires?: string[];
  tags?: string[];
};

export type PluginEntry = {
  identifier: string;
  manifest: PluginManifest | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PluginTemplateEntry = Omit<PluginEntry, "manifest" | "config">;

const api = new ApiClient("admin");

export const adminRepo = {
  getInstance: () => api.get<InstanceInfo>("/instance"),
  updateInstance: (name: string) => api.patch<InstanceInfo>("/instance", { name }),

  getSession: () => api.get<AdminSessionState>("/session"),
  loginOptions: () => api.post<PublicKeyCredentialRequestOptionsJSON>("/login/options"),
  loginVerify: (response: AuthenticationResponseJSON) => api.post("/login/verify", { response }),
  logout: () => api.post("/logout"),

  listPasskeys: () => api.get<Passkey[]>("/passkeys"),
  registerPasskeyOptions: () => api.post<PublicKeyCredentialCreationOptionsJSON>("/passkeys/register/options"),
  registerPasskeyVerify: (response: RegistrationResponseJSON, name?: string) => api.post("/passkeys/register/verify", { response, name }),
  deletePasskey: (id: string) => api.del(`/passkeys/${encodeURIComponent(id)}`),

  listPlugins: () => api.get<PluginEntry[]>("/plugins"),
  addPlugin: (identifier: string) => api.post<PluginEntry>("/plugins", { identifier }),
  removePlugin: (identifier: string) => api.del(`/plugins/${encodeURIComponent(identifier)}`),
  updatePluginConfig: (identifier: string, config: unknown) =>
    api.patch<PluginEntry>(`/plugins/${encodeURIComponent(identifier)}/config`, { config }),
  listPluginTemplates: () => api.get<PluginTemplateEntry[]>("/plugin-templates"),
  addPluginTemplate: (identifier: string) => api.post<PluginTemplateEntry>("/plugin-templates", { identifier }),
  removePluginTemplate: (identifier: string) => api.del(`/plugin-templates/${encodeURIComponent(identifier)}`),
};
