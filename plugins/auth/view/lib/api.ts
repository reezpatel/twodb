import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { ApiClient } from "@twodb/shared-frontend";
import type { AuthSessionResponse, AuthUser, LoginPasskeyVerifyRequest, RegisterPasskeyVerifyRequest } from "../../shared/api";

const api = new ApiClient("io.twodb.auth");

export const authRepo = {
  getSession: () => api.get<AuthSessionResponse>("/auth/session"),
  loginOptions: (email: string) => api.post<PublicKeyCredentialRequestOptionsJSON>("/auth/passkeys/login/options", { email }),
  loginVerify: (credential: LoginPasskeyVerifyRequest["credential"]) => api.post("/auth/passkeys/login/verify", { credential }),
  registerOptions: (email: string, name?: string) => api.post<PublicKeyCredentialCreationOptionsJSON>("/auth/passkeys/register/options", { email, name }),
  registerVerify: (credential: RegisterPasskeyVerifyRequest["credential"], email: string, name?: string) =>
    api.post("/auth/passkeys/register/verify", { credential, email, name }),
  logout: () => api.post("/auth/logout"),
};

export type { AuthUser };
