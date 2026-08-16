import { useForm } from "@tanstack/react-form";
import { Link } from "react-router";
import { Button, Card, Input } from "@twodb/ui";
import { useAuthMethods, useRegisterMutation } from "./use-register.hook";
import { useNavigate } from "react-router";

export const RegisterScreen = () => {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: { name: "", identifier: "", password: "" },
    onSubmit: async ({ value }) => {
      await registerMut.mutateAsync({
        name: value.name.trim(),
        identifier: value.identifier.trim(),
        password: value.password,
      });
      navigate("/");
    },
  });

  const registerMut = useRegisterMutation();
  const { data: methodsData } = useAuthMethods();
  const showPassword = (methodsData?.methods ?? []).some(
    (m) => m.method === "password" && m.enabled,
  );

  return (
    <main>
      <style jsx>{`
        main {
          display: grid;
          place-items: center;
          min-height: 100dvh;
          padding: var(--space-5);
          background: var(--bg);
        }
        section {
          width: 100%;
          max-width: 380px;
          display: grid;
          gap: var(--space-4);
        }
        header {
          display: grid;
          gap: var(--space-1);
        }
        h1 {
          margin: 0;
          font-size: var(--text-2xl);
          font-weight: 650;
          line-height: 1.1;
        }
        p.lede {
          margin: 0;
          color: var(--ink-3);
        }
        form {
          display: grid;
          gap: var(--space-3);
        }
        form > div.toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
          padding-top: var(--space-2);
          border-top: 1px solid var(--line);
          color: var(--ink-3);
          font-size: var(--text-sm);
        }
        p.alert {
          margin: 0;
          padding: var(--space-2) var(--space-3);
          background: var(--danger-bg);
          color: var(--danger-ink);
          border-radius: var(--r-sm);
          font-size: var(--text-sm);
        }
      `}</style>
      <Card density="normal">
        <section>
          <header>
            <h1>Create your account</h1>
            <p className="lede">
              Pick an email or phone and a password to get started.
            </p>
          </header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="name">
              {(field) => (
                <Input
                  label="Your name"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange((e.target as HTMLInputElement).value)
                  }
                  required
                  autoFocus
                />
              )}
            </form.Field>
            <form.Field name="identifier">
              {(field) => (
                <Input
                  label="Email or phone"
                  type="text"
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange((e.target as HTMLInputElement).value)
                  }
                  required
                />
              )}
            </form.Field>
            {showPassword && (
              <form.Field name="password">
                {(field) => (
                  <Input
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
            {registerMut.error && (
              <p className="alert">
                {(registerMut.error as { message?: string }).message ??
                  "Something went wrong."}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={registerMut.isPending}
            >
              {registerMut.isPending ? "Creating…" : "Create account"}
            </Button>
            <div className="toggle">
              <span>Already have an account?</span>
              <Link to="/login">
                <Button variant="ghost" size="sm" type="button">
                  Sign in instead
                </Button>
              </Link>
            </div>
          </form>
        </section>
      </Card>
    </main>
  );
};
