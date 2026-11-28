// @twodb/twodb-shared-frontend — what every TwoDB app webapp imports.
//
//   <TwoDbAuthProvider>
//     <RequireTwoDbAuth>      // shows "Login using TwoDB" when signed out
//       <App />
//     </RequireTwoDbAuth>
//   </TwoDbAuthProvider>
//
// Sign-in is an internal OAuth flow (authorization code + PKCE) against the
// control plane; the result is a session token the gateway accepts as
// `Authorization: Bearer`, attached to gateway requests automatically.
export { TwoDbAuthProvider, useTwoDbAuth, type TwoDbAuth, type AuthStatus } from "./provider.js";
export { LoginWithTwoDbButton, RequireTwoDbAuth } from "./components.js";
export type { TwoDbAuthConfig, TwoDbUser } from "./client.js";
export { currentToken, appOrigin, authBaseUrl, consoleUrl } from "./client.js";
export { challengeFor, randomString } from "./pkce.js";
export { notifyApi, type AppNotification } from "./notify.js";
export { usePushSubscription, type PushPermission, type UsePushSubscription, type UsePushSubscriptionOptions } from "./pwa.js";
