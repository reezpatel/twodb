import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

export type AuthMethodOptions = {
  passkeys: boolean;
  googleSso: boolean;
  magicLink: boolean;
};

export type AuthPluginConfig = {
  passkeys: { enabled: boolean };
  googleSso: { enabled: boolean; clientId: string; clientSecret: string };
  magicLink: { enabled: boolean };
};

export type RegisterPasskeyOptionsRequest = {
  email: string;
  name?: string;
};

export type RegisterPasskeyVerifyRequest = {
  email: string;
  name?: string;
  credential: RegistrationResponseJSON;
};

export type RegisterPasskeyVerifyResponse = {
  ok: true;
  user: AuthUser;
};

export type LoginPasskeyOptionsRequest = {
  email?: string;
};

export type LoginPasskeyVerifyRequest = {
  credential: AuthenticationResponseJSON;
};

export type LoginPasskeyVerifyResponse = {
  user: AuthUser;
};

export type AuthSessionResponse = {
  user: AuthUser | null;
};

export type LogoutResponse = {
  ok: true;
};

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthApiError = {
  error: string;
  message?: string;
};
