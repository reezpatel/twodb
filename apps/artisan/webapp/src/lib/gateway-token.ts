/** The per-login gateway token for artisan API calls and WS upgrades (?access_token=).
 *
 * It is the session token the shared TwoDbAuthProvider obtained from the console's login flow
 * (core/twodb-shared-frontend) — held by that provider, so there is no separate token exchange here.
 */
import { currentToken } from "@twodb/twodb-shared-frontend";

/** Returns the current session token; rejects when signed out (RequireTwoDbAuth normally prevents that). */
export async function gatewayToken(): Promise<string> {
  const token = currentToken();
  if (!token) throw new Error("not signed in");
  return token;
}

/** Authorization header for a gateway call. */
export async function gatewayAuthHeader(): Promise<{ authorization: string }> {
  return { authorization: `Bearer ${await gatewayToken()}` };
}
