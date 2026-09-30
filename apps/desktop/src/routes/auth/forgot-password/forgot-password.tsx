import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useForgotPassword } from "./use-forgot-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignInLayout } from "@/components/ui/sign-in-page";

export function ForgotPasswordPage() {
  const { form, error, sent } = useForgotPassword();

  return (
    <SignInLayout>
      <div className="mb-8">
        <h1 className="text-foreground mb-2 text-3xl font-medium">Reset password</h1>
        <p className="text-muted-foreground">
          Remember your password?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {sent ? (
        <>
          <p className="text-success mb-6 text-sm">If that email exists, a reset link is on its way.</p>
          <Button variant="outline" className="w-full py-3" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        </>
      ) : (
        <>
          {error && (
            <p className="text-destructive mb-4 text-sm" role="alert">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="flex flex-col gap-6"
          >
            <form.Field name="email">
              {(field) => (
                <div className="flex flex-col gap-3">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
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
                  Send reset link
                </Button>
              )}
            </form.Subscribe>
          </form>
        </>
      )}
    </SignInLayout>
  );
}
