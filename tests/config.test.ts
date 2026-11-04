import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
function probe(env: Record<string, string>) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "import {validateConfig} from './src/server/config.ts'; validateConfig();",
    ],
    { encoding: "utf8", env: { ...process.env, ...env } },
  );
}
test("production refuses demo bypass even with database credentials configured", () => {
  const r = probe({
    NODE_ENV: "production",
    DEMO_MODE: "true",
    DATABASE_URL: "postgresql://unused",
    NEON_AUTH_BASE_URL: "https://auth.example.test",
    APP_URL: "https://app.example.test",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /DEMO_MODE must be false/);
});
test("cloud mode fails closed when authentication is not configured", () => {
  const r = probe({
    NODE_ENV: "test",
    DEMO_MODE: "false",
    DATABASE_URL: "",
    NEON_AUTH_BASE_URL: "",
    VERCEL: "",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Configure DATABASE_URL/);
});
