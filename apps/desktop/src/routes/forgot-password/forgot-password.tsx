import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useForgotPassword } from "./use-forgot-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordPage() {
  const { form, error, sent } = useForgotPassword();

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>we'll email you a reset link</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sent ? (
            <>
              <p className="text-success text-sm">If that email exists, a reset link is on its way.</p>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Back to sign in</Link>
              </Button>
            </>
          ) : (
            <>
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
                className="flex flex-col gap-4"
              >
                <form.Field name="email">
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
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
                      Send reset link
                    </Button>
                  )}
                </form.Subscribe>
              </form>

              <Link to="/login" className="text-primary hover:underline text-sm">
                Back to sign in
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
