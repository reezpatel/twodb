import { Button, Input, Label } from "@twodb/blocks";

export interface LoginCardProps {
  pending: boolean;
  error: string | null;
  mode: "signin" | "register";
  email: string;
  onModeChange: (mode: "signin" | "register") => void;
  onEmailChange: (email: string) => void;
  onSignIn: () => void;
  onRegister: () => void;
}

/** Dumb/presentational only — no auth logic, just renders what useLogin() hands it. */
export function LoginCard(props: LoginCardProps) {
  return (
    <div className="twodb-login-card">
      <h1>TwoDB</h1>
      <p>Sign in with a passkey — no password, ever.</p>
      {props.error ? <p role="alert">{props.error}</p> : null}

      {props.mode === "register" ? (
        <>
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            value={props.email}
            onChange={(e) => props.onEmailChange(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email webauthn"
          />
          <Button disabled={props.pending} onClick={props.onRegister}>
            {props.pending ? "Waiting for authenticator…" : "Create account + passkey"}
          </Button>
          <Button variant="ghost" disabled={props.pending} onClick={() => props.onModeChange("signin")}>
            Back to sign in
          </Button>
        </>
      ) : (
        <>
          <Button disabled={props.pending} onClick={props.onSignIn}>
            {props.pending ? "Waiting for authenticator…" : "Sign in with passkey"}
          </Button>
          <Button variant="ghost" disabled={props.pending} onClick={() => props.onModeChange("register")}>
            First time? Register a passkey
          </Button>
        </>
      )}
    </div>
  );
}
