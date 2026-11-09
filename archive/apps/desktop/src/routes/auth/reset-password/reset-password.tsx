import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useResetPassword } from "./use-reset-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignInLayout } from "@/components/ui/sign-in-page";

export function ResetPasswordPage() {
  const { form, error, hasToken } = useResetPassword();

  return (
    <SignInLayout>
      <div className="mb-8">
        <h1 className="text-foreground mb-2 text-3xl font-medium">Choose a new password</h1>
        <p className="text-muted-foreground">
          Remember your password?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {error && (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      )}

      {hasToken && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-3">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="at least 8 characters"
                  className="px-4 py-3"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  minLength={8}
                  required
                />
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="flex flex-col gap-3">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="repeat your password"
                  className="px-4 py-3"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Reset password
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
    </SignInLayout>
  );
}
