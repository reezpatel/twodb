import { useState } from "react";
import { Link } from "react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useLogin } from "./use-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SignInLayout } from "@/components/ui/sign-in-page";

export function LoginPage() {
  const { form, error, signInWithPasskey } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SignInLayout>
      <div className="mb-8">
        <h1 className="text-foreground mb-2 text-3xl font-medium">Welcome back</h1>
        <p className="text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>

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

        <form.Field name="password">
          {(field) => (
            <div className="flex flex-col gap-3">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="px-4 py-3 pr-12"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:bg-muted absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="text-muted-foreground h-5 w-5" /> : <Eye className="text-muted-foreground h-5 w-5" />}
                </button>
              </div>
            </div>
          )}
        </form.Field>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-primary text-sm font-medium hover:underline">
            Forgot password?
          </Link>
        </div>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Sign In
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs uppercase">or</span>
        <Separator className="flex-1" />
      </div>

      <Button variant="outline" className="w-full py-3" onClick={signInWithPasskey}>
        Sign in with passkey
      </Button>
    </SignInLayout>
  );
}
