// Run after building the extension: node --test tests/extension-connect.browser.mjs
// Uses the real extension/Neon client with a local fixture API. A temporary
// manifest pregrants localhost access, so Chrome's native permission prompt is
// deliberately outside this automated test. No production account or AI call.
import assert from "node:assert/strict";
import test from "node:test";
import { createServer as createHttpServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium, expect } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const extensionRoot = resolve(webRoot, "../browser-extension");
const extensionId = "dfpafpdmlhafhpknaijeeelhdpbkiogk";
const webUrl = "http://localhost:5173";
const apiUrl = "http://localhost:3000";

test("one-button extension account connection in a real browser", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "contextbridge-connect-"));
  let browser;
  let app;
  let server;
  t.after(async () => {
    await browser?.close();
    await app?.close();
    server?.closeAllConnections();
    if (server?.listening) await new Promise((accept) => server.close(accept));
    await rm(temporary, { recursive: true, force: true });
  });
  const extension = join(temporary, "extension");
  await cp(join(extensionRoot, "dist"), extension, { recursive: true });
  await cp(join(extensionRoot, "public"), extension, { recursive: true });
  const manifestPath = join(extension, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = ["http://localhost/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  const { build } = createRequire(join(extensionRoot, "package.json"))("esbuild");
  await build({
    absWorkingDir: extensionRoot,
    entryPoints: ["src/worker.ts", "src/panel.ts"],
    outdir: extension,
    bundle: true,
    minify: true,
    target: "chrome121",
    platform: "browser",
    format: "esm",
    define: {
      __API_URL__: JSON.stringify(apiUrl),
      __WEB_URL__: JSON.stringify(webUrl),
    },
  });

  const user = {
    id: "connection-fixture-owner",
    email: "reader@example.invalid",
    emailVerified: true,
    name: "Fixture Reader",
  };
  let signedIn = false;
  let verified = true;
  const codes = new Map();
  const tokens = new Map();
  const calls = [];
  let sequence = 0;
  let exchangeGate;
  let exchangeStarted;
  const settings = {
    name: user.name,
    learningLanguage: "English",
    translationLanguage: "English",
    mode: "guided",
    instructions: "",
    dailyGoal: 5,
  };
  server = createHttpServer(async (req, res) => {
    const path = new URL(req.url, apiUrl).pathname;
    const origin = req.headers.origin;
    if (origin === webUrl) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type,Authorization,X-Force-Fetch");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") return res.end();
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : {};
    calls.push({ path, method: req.method });
    const respond = (data, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    const currentUser = { ...user, emailVerified: verified };
    if (path === "/managed-auth/sign-in/email") {
      signedIn = true;
      return respond({ redirect: false, token: "opaque-test-session", user: currentUser });
    }
    if (path === "/managed-auth/sign-up/email") {
      signedIn = true;
      verified = false;
      return respond({ token: "opaque-test-session", user: { ...user, emailVerified: false } });
    }
    if (path === "/managed-auth/email-otp/send-verification-otp") return respond({ success: true });
    if (path === "/managed-auth/email-otp/verify-email") {
      verified = true;
      return respond({ status: true, token: "opaque-test-session", user });
    }
    if (path === "/managed-auth/sign-out") {
      signedIn = false;
      return respond({ success: true });
    }
    if (path === "/managed-auth/get-session")
      return respond(signedIn ? { session: { id: "test-session", token: "opaque-test-session" }, user: currentUser } : null);
    if (path === "/managed-auth/token")
      return signedIn ? respond({ token: "workspace-fixture-token" }) : respond({ message: "Sign in again." }, 401);
    if (path === "/api/config")
      return respond({ demo: false, authUrl: `${apiUrl}/managed-auth`, storage: "neon", aiConfigured: false, appUrl: webUrl });
    if (path === "/api/extension/exchange") {
      const owner = codes.get(body.code);
      codes.delete(body.code);
      if (!owner) return respond({ message: "Connection expired." }, 401);
      exchangeStarted?.();
      if (exchangeGate) await exchangeGate;
      const token = `cb_ext_fixture_${String(++sequence).padStart(24, "0")}`;
      tokens.set(token, owner);
      return respond({ token });
    }
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    const owner = bearer === "workspace-fixture-token" && signedIn && verified ? user.id : tokens.get(bearer);
    if (!owner) return respond({ message: "Your session expired. Please sign in again." }, 401);
    if (path === "/api/me") return respond({ ...user, id: owner, kind: bearer?.startsWith("cb_ext_") ? "extension" : "web" });
    if (path === "/api/extension/pair") {
      assert.equal(bearer, "workspace-fixture-token");
      const code = `fixture_code_${String(++sequence).padStart(24, "0")}`;
      codes.set(code, owner);
      return respond({ code, expiresAt: new Date(Date.now() + 300000).toISOString() });
    }
    if (path === "/api/extension/token" && req.method === "DELETE") {
      tokens.delete(bearer);
      return respond({ ok: true });
    }
    if (path === "/api/settings") return respond(settings);
    if (path === "/api/encounters" || path === "/api/chats") return respond({ items: [] });
    if (path === "/api/usage") return respond({ requests: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reservedTokens: 0, requestLimit: 60, tokenLimit: 25000 });
    respond({ message: `Unexpected fixture request ${path}` }, 404);
  });
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(3000, accept);
  });
  app = await createServer({
    root: webRoot,
    configFile: false,
    logLevel: "error",
    plugins: [react()],
    server: { host: "localhost", port: 5173, strictPort: true, watch: null, proxy: { "/api": apiUrl } },
  });
  await app.listen();
  browser = await chromium.launchPersistentContext(join(temporary, "profile"), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const errors = [];
  browser.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  const worker = browser.serviceWorkers().find((worker) => worker.url().startsWith(`chrome-extension://${extensionId}/`))
    || await browser.waitForEvent("serviceworker");
  assert.ok(worker.url().startsWith(`chrome-extension://${extensionId}/`));
  const panel = await browser.newPage();
  await panel.setViewportSize({ width: 380, height: 850 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html#settings`);
  const connect = panel.getByRole("button", { name: "Connect account", exact: true });
  await mkdir(join(webRoot, ".data"), { recursive: true });
  await panel.screenshot({ path: join(webRoot, ".data/extension-account-disconnected.png"), fullPage: true });

  async function openConnectionWebsite() {
    await panel.bringToFront();
    await expect(connect).toBeVisible();
    const nextPage = browser.waitForEvent("page", {
      predicate: (page) => !page.url().startsWith("chrome-extension://"),
    });
    await connect.click();
    const page = await nextPage;
    await page.waitForURL(`${webUrl}/?connect=extension*`);
    return page;
  }
  async function signIn(page) {
    await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("local-fixture-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  async function expectConnected(page) {
    await expect(page.getByRole("heading", { name: "Your extension is connected", exact: true })).toBeVisible();
    await expect(connect).toBeHidden();
    await expect(panel.locator("#account-card").getByRole("heading", { name: "Signed in", exact: true })).toBeVisible();
    await expect(panel.getByText(user.email, { exact: true })).toBeVisible();
    assert.ok(await panel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "account card fits a narrow side panel");
    await expect(page.getByRole("button", { name: /Connect extension|Connect installed extension/i })).toHaveCount(0);
    await panel.screenshot({ path: join(webRoot, ".data/extension-account-connected.png"), fullPage: true });
    await page.screenshot({ path: join(webRoot, ".data/web-extension-connected.png"), fullPage: true });
  }
  let website;
  let initialConnectionPassed = false;
  await t.test("one button opens sign-in and automatically connects the verified account", async () => {
    website = await openConnectionWebsite();
    await signIn(website);
    try { await expectConnected(website); }
    catch (error) {
      console.error("Connection fixture diagnostics", {
        website: await website.locator("body").innerText(),
        panel: await panel.locator("body").innerText(),
        calls, errors,
      });
      throw error;
    }
    assert.equal(calls.filter((call) => call.path === "/api/extension/exchange").length, 1);
    assert.ok(!new URL(website.url()).searchParams.has("connect"));
    initialConnectionPassed = true;
  });
  assert.ok(initialConnectionPassed, "initial connection must pass before testing its lifecycle");
  await t.test("another account cannot disconnect this browser's connected account", async () => {
    const result = await website.evaluate(({ extensionId }) => new Promise((accept) => {
      chrome.runtime.sendMessage(extensionId, { type: "CB_DISCONNECT", accountId: "different-fixture-owner" }, accept);
    }), { extensionId });
    assert.equal(result.ok, true);
    await expect(connect).toBeHidden();
    const status = await website.evaluate(({ extensionId, accountId }) => new Promise((accept) => {
      chrome.runtime.sendMessage(extensionId, { type: "CB_STATUS", accountId }, accept);
    }), { extensionId, accountId: user.id });
    assert.equal(status.status, "connected");
  });
  await t.test("website sign-out restores the extension's Connect account button", async () => {
    await website.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(website.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(connect).toBeVisible();
    await expect(panel.getByText(user.email, { exact: true })).toBeHidden();
    assert.equal(tokens.size, 0);
  });
  await t.test("signup and email verification preserve the automatic connection", async () => {
    await website.close();
    website = await openConnectionWebsite();
    await website.getByRole("button", { name: "New here? Create an account", exact: true }).click();
    await website.getByRole("textbox", { name: "Your name" }).fill(user.name);
    await website.getByRole("textbox", { name: "Email address" }).fill(user.email);
    await website.getByLabel("Password", { exact: true }).fill("local-fixture-password");
    await website.getByLabel("Confirm password", { exact: true }).fill("local-fixture-password");
    await website.getByRole("button", { name: "Create your account", exact: true }).click();
    await expect(website.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
    await expect(connect).toBeVisible();
    await website.getByRole("textbox", { name: "Verification code" }).fill("123456");
    await website.getByRole("button", { name: "Verify email", exact: true }).click();
    await expectConnected(website);
  });
  await t.test("a revoked token returns to the signed-out state without a page reload", async () => {
    tokens.clear();
    await panel.bringToFront();
    await panel.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(connect).toBeVisible();
    await expect(panel.getByText(user.email, { exact: true })).toBeHidden();
  });
  await t.test("sign-out during a delayed connection cannot restore the old account", async () => {
    await website.close();
    let finishExchange;
    exchangeGate = new Promise((accept) => { finishExchange = accept; });
    const started = new Promise((accept) => { exchangeStarted = accept; });
    website = await openConnectionWebsite();
    try {
      await started;
      await website.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(website.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
      finishExchange();
      exchangeGate = undefined;
      exchangeStarted = undefined;
      await expect(connect).toBeVisible();
      await expect.poll(() => tokens.size).toBe(0);
      assert.equal(await worker.evaluate(async () => Boolean((await chrome.storage.local.get("connection")).connection?.token)), false);
    } finally {
      finishExchange();
      exchangeGate = undefined;
      exchangeStarted = undefined;
    }
  });
  await t.test("reloading an expired website session signs the matching extension out", async () => {
    await website.close();
    website = await openConnectionWebsite();
    await signIn(website);
    await expectConnected(website);
    signedIn = false;
    await website.reload();
    await expect(website.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(connect).toBeVisible();
    await expect.poll(() => tokens.size).toBe(0);
  });
  await t.test("an older extension gets update guidance without minting a connection code", async () => {
    signedIn = true;
    const cleanBrowser = await chromium.launch({ channel: "chromium" });
    try {
      const page = await cleanBrowser.newPage();
      await page.addInitScript(() => {
        window.chrome ||= {};
        Object.defineProperty(window.chrome, "runtime", { configurable: true, value: {
          sendMessage(_id, _message, callback) { callback({ ok: false, error: "Unsupported connection request." }); },
        } });
      });
      const before = calls.filter((call) => call.path === "/api/extension/pair").length;
      await page.goto(`${webUrl}/?connect=extension#settings`);
      await expect(page.getByRole("heading", { name: "Update your extension", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Download updated extension", exact: true })).toBeVisible();
      assert.equal(calls.filter((call) => call.path === "/api/extension/pair").length, before);
      await expect(page.locator(".pair-code")).toHaveCount(0);
    } finally { await cleanBrowser.close(); }
  });
  await t.test("a browser without the extension shows installation help without pairing", async () => {
    const cleanBrowser = await chromium.launch({ channel: "chromium" });
    try {
      const page = await cleanBrowser.newPage();
      const before = calls.filter((call) => call.path === "/api/extension/pair").length;
      await page.goto(`${webUrl}/?connect=extension#settings`);
      await expect(page.getByText("Need to install the extension?", { exact: true })).toBeVisible();
      await page.getByText("Need to install the extension?", { exact: true }).click();
      await expect(page.getByRole("link", { name: "Download Chrome extension", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your extension is connected", exact: true })).toHaveCount(0);
      assert.equal(calls.filter((call) => call.path === "/api/extension/pair").length, before);
      await expect(page.locator(".pair-code")).toHaveCount(0);
    } finally { await cleanBrowser.close(); }
  });
  assert.deepEqual(errors, []);
  assert.ok(calls.every((call) => !/lookup|feedback|messages/.test(call.path)), "connection makes no AI calls");
});
