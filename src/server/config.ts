import "dotenv/config";
export const production =
  process.env.NODE_ENV === "production" || !!process.env.VERCEL;
export const demo = process.env.DEMO_MODE === "true" && !production;
export const authUrl = (process.env.NEON_AUTH_BASE_URL || "").replace(
  /\/$/,
  "",
);
export const appUrl = process.env.APP_URL || "http://localhost:5173";
export function validateConfig() {
  if (production && process.env.DEMO_MODE === "true")
    throw new Error("DEMO_MODE must be false for deployment.");
  if (!demo && (!process.env.DATABASE_URL || !authUrl))
    throw new Error(
      "Configure DATABASE_URL and NEON_AUTH_BASE_URL, or explicitly enable local DEMO_MODE.",
    );
  if (production && !appUrl.startsWith("https://"))
    throw new Error("APP_URL must use HTTPS in production.");
}
