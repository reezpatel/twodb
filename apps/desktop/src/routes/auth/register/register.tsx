import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useRegister } from "./use-register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignInLayout } from "@/components/ui/sign-in-page";

export function RegisterPage() {
  const { form, error, signUpEnabled, settingsLoading } = useRegister();

  return (
    <SignInLayout>
      <div className="mb-8">
        <h1 className="text-foreground mb-2 text-3xl font-medium">Create account</h1>
        <p className="text-muted-foreground">
          Already have an account?{" "}
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

      {!settingsLoading && !signUpEnabled && (
        <div className="bg-muted mb-4 rounded-lg border p-3 text-sm">
          <p className="font-medium">Sign-up is disabled</p>
          <p className="text-muted-foreground mt-0.5 text-xs">New account registration has been turned off by the administrator.</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-6"
      >
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-3">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Ada Lovelace"
                className="px-4 py-3"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
              />
            </div>
          )}
        </form.Field>

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

        <form.Field name="password">
          {(field) => (
            <div className="flex flex-col gap-3">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm password</Label>
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
            <Button type="submit" className="w-full py-3" disabled={isSubmitting || !signUpEnabled}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Create account
            </Button>
          )}
        </form.Subscribe>
      </form>
    </SignInLayout>
  );
}
