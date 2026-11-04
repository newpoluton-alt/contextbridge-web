import { createRemoteJWKSet, jwtVerify } from "jose";
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import { authUrl, demo } from "./config.js";
import { store } from "./store.js";
const jwks = authUrl
  ? createRemoteJWKSet(
      new URL(
        process.env.NEON_AUTH_JWKS_URL || `${authUrl}/.well-known/jwks.json`,
      ),
    )
  : undefined;
export interface Identity {
  id: string;
  name: string;
  email: string;
  kind: "demo" | "web" | "extension";
}
export function assertVerifiedAccount(
  profile: { emailVerified: boolean; banned: boolean } | undefined,
) {
  if (!profile || profile.banned)
    throw new UnauthorizedException(
      "This account is unavailable. Please sign in again.",
    );
  if (!profile.emailVerified)
    throw new ForbiddenException(
      "Verify your email before using your learning workspace.",
    );
}
async function account(id: string, kind: Identity["kind"]): Promise<Identity> {
  if (demo && id === "local-demo")
    return { id, name: "Reader", email: "", kind };
  const profile = await store.profile(id);
  assertVerifiedAccount(profile);
  return { id, name: profile!.name || "Reader", email: profile!.email, kind };
}
export async function identity(req: Request): Promise<Identity> {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) {
    if (demo)
      return { id: "local-demo", name: "Reader", email: "", kind: "demo" };
    throw new UnauthorizedException("Sign in to continue.");
  }
  if (bearer.startsWith("cb_ext_")) {
    const owner = await store.tokenOwner(bearer);
    if (!owner)
      throw new UnauthorizedException(
        "Reconnect the extension from your account settings.",
      );
    return account(owner, "extension");
  }
  if (!jwks)
    throw new UnauthorizedException("Authentication is not configured.");
  let id: string;
  try {
    const { payload } = await jwtVerify(bearer, jwks, {
      issuer: new URL(authUrl).origin,
      audience: new URL(authUrl).origin,
      algorithms: ["EdDSA"],
    });
    if (
      !payload.sub ||
      payload.banned === true ||
      payload.role !== "authenticated"
    )
      throw new Error("Unauthenticated identity");
    id = payload.sub;
  } catch {
    throw new UnauthorizedException(
      "Your session expired. Please sign in again.",
    );
  }
  return account(id, "web");
}
export function webOnly(who: Identity) {
  if (who.kind === "extension")
    throw new ForbiddenException("Pair extensions from the website.");
}
