import { createAuthClient } from "@neon/neon-js/auth";
import { BetterAuthReactAdapter } from "@neon/neon-js/auth/react/adapters";

export function createClient(url: string) {
  const client = createAuthClient(url, {
    adapter: BetterAuthReactAdapter({
      fetchOptions: { credentials: "include" },
    }),
  });
  // @neon/auth 0.8.2 installs JWT and emailOTP plugins at runtime, but its
  // adapter declaration widens the plugin tuple and loses these documented APIs.
  // Keep the managed SDK (including its cookie/iframe handling) and type only
  // the two verified plugin methods that this app consumes.
  return client as typeof client & ManagedNeonMethods;
}
interface ManagedResult<T> {
  data: T | null;
  error: { message?: string } | null;
}
const freshAuthRequest = {
  fetchOptions: { headers: { "X-Force-Fetch": "true" } },
};
interface ManagedNeonMethods {
  token(
    options: typeof freshAuthRequest,
  ): Promise<ManagedResult<{ token: string }>>;
  emailOtp: {
    sendVerificationOtp(input: {
      email: string;
      type: "email-verification";
    }): Promise<ManagedResult<unknown>>;
    verifyEmail(input: {
      email: string;
      otp: string;
    }): Promise<ManagedResult<unknown>>;
  };
}
export type AuthClient = ReturnType<typeof createClient>;

export function getWorkspaceToken(client: AuthClient) {
  // The managed SDK shares a cache between /token and /get-session. Ask for
  // the JWT endpoint itself, since a cached session has a different shape.
  return client.token(freshAuthRequest);
}

export function getSignInSession(client: AuthClient) {
  // After a credential or verification change, read the current cookie session.
  return client.getSession(freshAuthRequest);
}
