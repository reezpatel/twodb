import { useForm } from "@tanstack/react-form";
import { Button, Input } from "@twodb/ui";
import { AuthShell } from "../../components/auth-shell/auth-shell";
import { useAuthMethods, useLoginMutation } from "./use-login.hook";

export function LoginScreen() {
  const form = useForm({
    defaultValues: { identifier: "", password: "" },
    onSubmit: async ({ value }) => {
      await loginMut.mutateAsync({
        identifier: value.identifier.trim(),
        password: value.password,
      });
      window.location.assign("/");
    },
  });

  const loginMut = useLoginMutation();
  const { data: methodsData } = useAuthMethods();
  const showPassword = (methodsData?.methods ?? []).includes("password");

  return (
    <AuthShell
      title="Sign in to twodb"
      lede="Use the email or phone you signed up with."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="auth__ledger">
          <form.Field name="identifier">
            {(field) => (
              <Input
                size="lg"
                label="Email or phone"
                type="text"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange((e.target as HTMLInputElement).value)
                }
                required
                autoFocus
              />
            )}
          </form.Field>
          {showPassword && (
            <form.Field name="password">
              {(field) => (
                <Input
                  size="lg"
                  label="Password"
                  type="password"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange((e.target as HTMLInputElement).value)
                  }
                  required
                  minLength={8}
                />
              )}
            </form.Field>
          )}
        </div>
        {loginMut.error && (
          <p className="alert">
            {(loginMut.error as { message?: string }).message ??
              "Something went wrong."}
          </p>
        )}
        <div className="auth__actions">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loginMut.isPending}
          >
            {loginMut.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
      <div className="auth__switch-row">
        <span>New here?</span>
        <a href="/register">Create an account</a>
      </div>
    </AuthShell>
  );
}
