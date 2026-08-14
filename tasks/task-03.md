# Task 3 — Sign-in methods & verification

Plan refs: plan.md §10 (identifiers, two-level methods, verification, sessions)
Depends on: task-02
Status: not started

## Goal

The two-level sign-in method model: the superadmin controls what the
deployment *offers*, each user controls what's enabled *for them*, and a
method works only when both switches are on. Plus per-identifier verification
and the optional verified-only access gate.

## Deliverables

### 3.1 Migrations

```text
user_auth_methods       id 'amt-'…, user_id → users, method text,
                        credential jsonb, enabled bool default true,
                        created_at, unique (user_id, method)
deployment_auth_methods method text primary key, config jsonb,
                        enabled bool default false
verification_codes      id 'vcd-'…, identifier text, code_hash text,
                        purpose text, expires_at timestamptz, created_at
```

- `method` values: `password`, `email_link`, `phone_otp`, `sso.<provider>`
  (e.g. `sso.google`, `sso.oidc.<slug>` for generic OIDC).
- `credential` shapes: password → `{ hash }` (argon2id); sso →
  `{ issuer, subject }`; otp/link methods need no stored credential.
- Registration from task 2 retrofits: the password credential moves out of
  any implicit storage into a `user_auth_methods` row with
  `method: "password"`.

### 3.2 Method engine (`plugins/identity/service/methods.ts`)

One pure module, unit-tested without HTTP:

```ts
function canSignIn(user: User, method: string): Promise<boolean>
// = deployment_auth_methods[method].enabled
//   && user_auth_methods(user, method).enabled
//   && methodAllowedByIdentifierMode(method, env.TWODB_IDENTIFIER)
//   && (gate off || user verified || method is verification-capable)

function disableMethod(userId: string, methodId: string): Promise<void>
// refuses when it is the user's last enabled method → 409 "Add another
// sign-in method first."
```

- Mode rules: `phone_otp` requires a phone mode; `email_link` requires an
  email mode; `password` and `sso.*` work in all modes.
- Withdrawing a method at deployment level flips `deployment_auth_methods`
  only — user rows stay intact but inert (re-enabling restores them).
- Seed on boot: `password` enabled, everything else disabled, so a fresh
  deployment behaves exactly like task 2 left it.

### 3.3 Method implementations

- **password** — as in task 2, now credential-sourced from
  `user_auth_methods`.
- **email_link** — `POST /auth/link` sends a single-use, 15-min token to the
  email; `GET /auth/link/:token` consumes it and starts a session
  (`auth_method: "email_link"`).
- **phone_otp** — `POST /auth/otp` sends a 6-digit code via the configured
  SMS sender; `POST /auth/otp/confirm` verifies and starts a session. Codes
  stored hashed in `verification_codes`, single-use, 10-min TTL, max 5
  attempts per code.
- **sso.\*** (generic OIDC) — `GET /auth/sso/:provider` → authorize redirect;
  `GET /auth/sso/:provider/callback` → exchange code, read `sub` + email/
  phone claim. **Link, never duplicate**: if the provider's verified
  identifier matches an existing user row, add/refresh a `user_auth_methods`
  row (`sso.<provider>`, credential `{ issuer, subject }`) and log that user
  in; otherwise create the user row (respecting identifier mode). Mismatched
  `sub` for an existing link → 401, never re-link silently.
- Mail/SMS sending goes behind a tiny `fastify.mailer` / `fastify.texter`
  interface with a console-log driver in dev — real providers are superadmin
  config (task 8).

### 3.4 Verification

- Request/confirm endpoints: `POST /auth/verify` (`{ identifier, purpose }`
  sends a code/link) and `POST /auth/verify/confirm`.
- Success sets `email_verified_at` / `phone_verified_at` on the user row.
- The gate: when `TWODB_REQUIRE_VERIFIED` (or the runtime toggle from task 8)
  is on, the task-2 `onRequest` hook gains a second stage — sessions whose
  user lacks the mode-required `verified_at` get 403 `{ error:
  "verify_required" }` on everything except `auth/session`, `auth/verify*`,
  and `auth/logout`. The frontend turns that into the holding screen
  (task 9).

### 3.5 User-facing APIs

| Route | Notes |
| --- | --- |
| `GET /auth/methods` | what the deployment offers (drives the login screen) |
| `GET /me/auth-methods` | the user's methods + `enabled` flags |
| `POST /me/auth-methods` | set a password / begin SSO link |
| `PATCH /me/auth-methods/:id` | enable/disable; last-enabled → 409 |

All mutations emit bus facts (`authmethod.configured` for deployment-level,
plus session facts already mapped in task 1).

## Acceptance criteria

- [ ] Disable-password-after-SSO flow works end to end; password login then
      401s for that user while SSO still works.
- [ ] Disabling the last enabled method → 409 with the plain-language error.
- [ ] Superadmin disables `password` deployment-wide → all password logins
      401; re-enable restores them without user action.
- [ ] SSO callback for an existing email links to the same `usr-…` row (prove
      with a DB query — no second row).
- [ ] `TWODB_REQUIRE_VERIFIED=on`: unverified session gets 403
      `verify_required` on a workspace route, 200 on `auth/verify`.
- [ ] `phone_otp` endpoints 404 in `email` identifier mode (and vice versa).
- [ ] OTP codes are single-use; the 6th wrong attempt invalidates the code.

## Out of scope

- The superadmin **UI** for configuring providers (task 8) and the login
  screen itself (task 9) — this task is engine + HTTP only.
- MFA/step-up beyond recording `auth_method` on the session.
