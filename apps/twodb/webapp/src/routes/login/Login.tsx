import { useLogin } from "./hooks/useLogin.js";
import { LoginCard } from "./partials/LoginCard.js";

/** Only calls its holding hook and renders a partial — no logic lives here. */
export function Login() {
  const { error, pending, signInWithPasskey, registerPasskey } = useLogin();
  return (
    <LoginCard
      error={error}
      pending={pending}
      onSignIn={signInWithPasskey}
      onRegister={() => registerPasskey("primary")}
    />
  );
}
