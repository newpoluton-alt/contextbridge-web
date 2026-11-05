// Run with Node 24 and a local Chrome installation: node --test tests/auth-signin.browser.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

test("password sign-in using the installed managed Neon client", async (t) => {
  const app = await createServer({
    configFile: false,
    logLevel: "error",
    plugins: [react()],
    server: { host: "127.0.0.1", port: 0 },
  });
  await app.listen();
  t.after(() => app.close());
  const base = app.resolvedUrls.local[0];
  const browser = await chromium.launch({ channel: "chrome" });
  t.after(() => browser.close());

  async function attempt({
    emptySession = false,
    rejectWorkspace = false,
  } = {}) {
    const page = await browser.newPage();
    const errors = [];
    const calls = [];
    const workspaceTokens = [];
    let accepted = false;
    const user = {
      id: "verified-fixture",
      email: "learner@example.invalid",
      emailVerified: true,
      name: "Verified Reader",
    };
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/managed-auth/**", async (route) => {
      const action = new URL(route.request().url()).pathname.slice(
        "/managed-auth/".length,
      );
      calls.push(action);
      if (action === "sign-in/email") {
        accepted = true;
        return route.fulfill({
          json: { redirect: false, token: "opaque-session-fixture", user },
        });
      }
      if (action === "get-session") {
        return route.fulfill({
          body: JSON.stringify(
            accepted && !emptySession
              ? {
                  session: {
                    id: "fixture-session",
                    token: "opaque-session-fixture",
                  },
                  user,
                }
              : null,
          ),
          contentType: "application/json",
        });
      }
      if (action === "token")
        return route.fulfill({ json: { token: "workspace-jwt-fixture" } });
      throw new Error(`Unexpected auth fixture endpoint ${action}`);
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/config")
        return route.fulfill({
          json: {
            demo: false,
            authUrl: `${base}managed-auth`,
            storage: "neon",
            aiConfigured: false,
            appUrl: base,
          },
        });
      workspaceTokens.push(route.request().headers().authorization);
      if (rejectWorkspace)
        return route.fulfill({
          status: 401,
          json: { message: "Workspace access was refused." },
        });
      if (path === "/api/me") return route.fulfill({ json: user });
      if (path === "/api/settings")
        return route.fulfill({
          json: {
            name: user.name,
            learningLanguage: "English",
            translationLanguage: "English",
            mode: "guided",
            instructions: "",
            dailyGoal: 5,
          },
        });
      if (path === "/api/encounters" || path === "/api/chats")
        return route.fulfill({ json: { items: [] } });
      throw new Error(`Unexpected workspace fixture endpoint ${path}`);
    });
    await page.goto(base);
    await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("local-test-fixture");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    return { page, calls, workspaceTokens, errors, user };
  }

  await t.test(
    "verified sign-in opens the protected workspace with its JWT",
    async () => {
      const { page, calls, workspaceTokens, errors } = await attempt();
      try {
        await expect(
          page.getByRole("heading", { name: "Hello, Verified." }),
        ).toBeVisible();
        assert.ok(calls.includes("sign-in/email") && calls.includes("token"));
        assert.equal(workspaceTokens.length, 4);
        assert.deepEqual(
          [...new Set(workspaceTokens)],
          ["Bearer workspace-jwt-fixture"],
        );
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    },
  );
  await t.test(
    "a missing session after an accepted password gives a visible recovery message",
    async () => {
      const { page, workspaceTokens, errors, user } = await attempt({
        emptySession: true,
      });
      try {
        await expect(page.getByRole("alert")).toContainText(
          "browser could not open a sign-in session",
        );
        await expect(
          page.getByRole("textbox", { name: "Email address" }),
        ).toHaveValue(user.email);
        assert.deepEqual(workspaceTokens, []);
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    },
  );
  await t.test(
    "a denied workspace request keeps the sign-in form and explains the failure",
    async () => {
      const { page, errors, user } = await attempt({ rejectWorkspace: true });
      try {
        await expect(page.getByRole("alert")).toContainText(
          "Workspace access was refused.",
        );
        await expect(
          page.getByRole("textbox", { name: "Email address" }),
        ).toHaveValue(user.email);
        await expect(
          page.getByRole("button", { name: "Sign in", exact: true }),
        ).toBeEnabled();
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    },
  );
});
