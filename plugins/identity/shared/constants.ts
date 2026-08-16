export const PLUGIN_ID = "io.twodb.identity";

export const SESSION_COOKIE = "twodb_session";
export const PUBLIC = { config: { public: true } };
export const VERIFY_EXEMPT = { config: { verifyExempt: true } };
export const LINK_TTL_MS = 15 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const STATE_COOKIE = "twodb_sso_state";
