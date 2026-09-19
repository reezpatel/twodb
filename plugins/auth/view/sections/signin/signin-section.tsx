import { Button, Input } from "@twodb/ui";
import { useAuthSession } from "../../hooks/use-auth-session";
import { useSignin } from "./use-signin";

export function SigninSection() {
  const { invalidate } = useAuthSession();
  const { email, setEmail, signin, pending, error } = useSignin(invalidate);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) void signin();
        }}
        style={{
          width: 340,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 32,
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-xl)", color: "var(--ink)" }}>Sign in to twodb</h1>
          <p style={{ margin: 0, fontSize: "var(--text-md)", color: "var(--ink-3)" }}>New here? The same form creates your account with a passkey.</p>
        </div>
        <Input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
        <Button type="submit" disabled={pending}>
          {pending ? "Waiting for passkey…" : "Continue with passkey"}
        </Button>
        {error ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--danger-ink)" }} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
