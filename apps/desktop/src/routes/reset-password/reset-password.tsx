import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useResetPassword } from "./use-reset-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordPage() {
  const { form, error, hasToken } = useResetPassword();

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Choose a new password</CardTitle>
          <CardDescription>pick something long and unique</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          {hasToken && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="flex flex-col gap-4"
            >
              <form.Field name="password">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="at least 8 characters"
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
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="repeat your password"
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="animate-spin" />}
                    Reset password
                  </Button>
                )}
              </form.Subscribe>
            </form>
          )}

          <Link to="/login" className="text-primary hover:underline text-sm">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
