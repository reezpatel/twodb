import { useForm } from "@tanstack/react-form";
import { Button, Card, Input } from "@twodb/ui";
import { useVerify } from "./use-verify.hook";
import { useTwoDbIdentity } from "../../provider/IdentityProvider";

export function VerifyScreen() {
  const { userName, sent, requestCode, confirm, error } = useVerify();
  const { signOut } = useTwoDbIdentity();

  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      await confirm.mutateAsync(value.code.trim());
    },
  });

  return (
    <main className="verify-screen">
      <style jsx>{`
        main.verify-screen {
          display: grid;
          place-items: center;
          min-height: 100dvh;
          padding: var(--space-5);
          background: var(--bg);
        }

        .verify-screen__card {
          width: 100%;
          max-width: 380px;
          display: grid;
          gap: var(--space-4);
        }

        .verify-screen__card header {
          display: grid;
          gap: var(--space-1);
        }

        .verify-screen__card h1 {
          margin: 0;
          font-size: var(--text-2xl);
          font-weight: 650;
          line-height: 1.1;
        }

        .verify-screen__card p.lede {
          margin: 0;
          color: var(--ink-3);
        }

        .verify-screen__card form {
          display: grid;
          gap: var(--space-3);
        }

        .verify-screen__card p.hint {
          margin: 0;
          color: var(--ink-3);
          font-size: var(--text-sm);
        }
      `}</style>
      <Card density="normal">
        <section className="verify-screen__card">
          <header>
            <h1>Confirm it's you</h1>
            <p className="lede">Welcome, {userName ?? "user"}.</p>
            <p className="lede">
              We sent a code to the address on file. Enter it to continue.
            </p>
          </header>
          <Button
            onClick={() => void requestCode.mutateAsync()}
            disabled={sent || requestCode.isPending}
            variant="secondary"
            type="button"
          >
            {sent
              ? "Code sent"
              : requestCode.isPending
                ? "Sending…"
                : "Send a code"}
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="code"
              validators={{
                onSubmit: ({ value }) =>
                  !value.trim() ? "Enter the code we sent" : undefined,
              }}
            >
              {(field) => (
                <Input
                  label="Code"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  error={field.state.meta.errors[0] ?? error ?? undefined}
                />
              )}
            </form.Field>
            <Button
              type="submit"
              variant="primary"
              disabled={confirm.isPending}
            >
              {confirm.isPending ? "Confirming…" : "Confirm"}
            </Button>
          </form>
          <p className="hint">
            You can only reach this screen — verify, or sign out — until
            confirmed.
          </p>
          <Button onClick={() => void signOut()} variant="ghost" type="button">
            Sign out
          </Button>
        </section>
      </Card>
    </main>
  );
}
