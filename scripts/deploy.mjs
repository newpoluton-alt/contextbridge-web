import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
const env = parse(await readFile(new URL("../.env", import.meta.url), "utf8"));
env.APP_URL = env.PRODUCTION_APP_URL || env.APP_URL;
const required = [
  "OPENAI_API_KEY",
  "DATABASE_URL",
  "NEON_AUTH_BASE_URL",
  "APP_URL",
  "EXTENSION_IDS",
];
const missing = required.filter((k) => !env[k]);
if (missing.length)
  throw new Error(
    `Complete web/.env first: ${missing.join(", ")}. Values will be transferred automatically; do not paste them into Vercel.`,
  );
if (!env.APP_URL.startsWith("https://"))
  throw new Error("Set APP_URL to the production HTTPS URL before deployment.");
if (!env.EXTENSION_IDS.split(",").every((v) => /^[a-p]{32}$/.test(v)))
  throw new Error(
    "EXTENSION_IDS must contain the Chrome IDs of your installed extension.",
  );
const run = (args, value) =>
  new Promise((resolve, reject) => {
    const p = spawn("npx", ["--yes", "vercel@latest", ...args], {
      stdio: value === undefined ? "inherit" : ["pipe", "ignore", "pipe"],
      shell: false,
    });
    let error = "";
    if (value !== undefined) {
      p.stderr.on("data", (c) => {
        error += c;
      });
      p.stdin.on("error", () => {});
      p.stdin.end(value);
    }
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Vercel ${args.slice(0, 3).join(" ")} failed. ${value === undefined ? "Check the output above." : "Run npx vercel login and verify the linked project before retrying. Secret-transfer output was suppressed."}`,
            ),
          ),
    );
  });
// A deliberate first-time link makes the target concrete, without touching unrelated projects.
try {
  await readFile(new URL("../.vercel/project.json", import.meta.url));
} catch {
  console.log("Link this folder to your ContextBridge Vercel project.");
  await run(["link"]);
}
const publicValues = {
  OPENAI_MODEL: env.OPENAI_MODEL || "gpt-4.1-mini",
  OPENAI_EMBEDDING_MODEL:
    env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  NEON_AUTH_BASE_URL: env.NEON_AUTH_BASE_URL,
  APP_URL: env.APP_URL,
  CORS_ORIGINS: env.APP_URL,
  EXTENSION_IDS: env.EXTENSION_IDS,
  AI_DAILY_REQUEST_LIMIT: env.AI_DAILY_REQUEST_LIMIT || "60",
  AI_DAILY_TOKEN_LIMIT: env.AI_DAILY_TOKEN_LIMIT || "25000",
  DEMO_MODE: "false",
};
if (env.NEON_AUTH_JWKS_URL)
  publicValues.NEON_AUTH_JWKS_URL = env.NEON_AUTH_JWKS_URL;
for (const [key, value] of Object.entries(publicValues))
  await run(
    ["env", "add", key, "production", "--force", "--yes", "--type", "config"],
    value,
  );
for (const key of ["OPENAI_API_KEY", "DATABASE_URL"]) {
  await run(
    ["env", "add", key, "production", "--force", "--yes", "--type", "secret"],
    env[key],
  );
  console.log(`${key} securely transferred to production.`);
}
console.log(
  "Deploying the web project. Local .env files are excluded from upload.",
);
await run(["deploy", "--prod", "--yes"]);
