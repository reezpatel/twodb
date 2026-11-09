import { Button } from "@twodb/blocks";

export interface LoginCardProps {
  pending: boolean;
  error: string | null;
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
      <Button disabled={props.pending} onClick={props.onSignIn}>
        Sign in with passkey
      </Button>
      <Button variant="secondary" disabled={props.pending} onClick={props.onRegister}>
        First time? Register a passkey
      </Button>
    </div>
  );
}
