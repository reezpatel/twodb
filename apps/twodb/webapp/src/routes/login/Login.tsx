import { useLogin } from "./hooks/useLogin.js";
import { LoginCard } from "./partials/LoginCard.js";

/** Only calls its holding hook and renders a partial — no logic lives here. */
export function Login() {
  const { error, pending, mode, setMode, email, setEmail, signInWithPasskey, registerPasskey } = useLogin();
  return (
    <LoginCard
      error={error}
      pending={pending}
      mode={mode}
      email={email}
      onModeChange={setMode}
      onEmailChange={setEmail}
      onSignIn={signInWithPasskey}
      onRegister={registerPasskey}
    />
  );
}
